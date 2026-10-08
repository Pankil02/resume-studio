import type { ResumeV1, SectionId, TemplateId, MaxPages, AccentColor } from '../core/generated/resume.js';
import { validateResume, type Validation, type Issue } from '../core/validation.js';
import { getContentIssues } from '../core/content.js';
import type { LayoutResult } from './render.js';
import { saveDraftToStorage, isAutosaveEnabled, setAutosaveEnabled as persistAutosavePref } from './storage.js';

export interface EditorState {
  document: ResumeV1;
  sourceDocument: ResumeV1;
  sourceRevision?: string | undefined;
  dirty: boolean;
  validation: Validation;
  contentIssues: Issue[];
  layoutResult: LayoutResult | null;
  connection: 'hosted' | 'connecting' | 'connected' | 'conflict' | 'error';
  connectionMessage?: string | undefined;
  staleServerRevision?: string | undefined;
  autosaveEnabled: boolean;
}

export type StateListener = (state: EditorState) => void;

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function generateItemId(prefix: string): string {
  const cleanPrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^[^a-z]+/, '') || 'item';
  const rand = Math.random().toString(36).substring(2, 8);
  return `${cleanPrefix}-${rand}`.slice(0, 48);
}

export class EditorStore {
  private state: EditorState;
  private listeners: Set<StateListener> = new Set();

  constructor(initialDoc: ResumeV1, initialRevision?: string) {
    const val = validateResume(initialDoc);
    const issues = val.ok ? getContentIssues(initialDoc) : [];
    this.state = {
      document: deepClone(initialDoc),
      sourceDocument: deepClone(initialDoc),
      sourceRevision: initialRevision,
      dirty: false,
      validation: val,
      contentIssues: issues,
      layoutResult: null,
      connection: initialRevision ? 'connected' : 'hosted',
      autosaveEnabled: isAutosaveEnabled(),
    };
  }

  getState(): Readonly<EditorState> {
    return this.state;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const readonlyState = Object.freeze({ ...this.state });
    for (const listener of this.listeners) {
      try {
        listener(readonlyState);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }

  /**
   * Loads a document from external source (disk, import, storage).
   */
  loadDocument(doc: ResumeV1, revision?: string, markClean: boolean = true): void {
    const val = validateResume(doc);
    const issues = val.ok ? getContentIssues(doc) : [];
    this.state.document = deepClone(doc);
    if (markClean) {
      this.state.sourceDocument = deepClone(doc);
      this.state.sourceRevision = revision ?? this.state.sourceRevision;
      this.state.dirty = false;
      this.state.staleServerRevision = undefined;
    } else {
      this.state.dirty = JSON.stringify(this.state.document) !== JSON.stringify(this.state.sourceDocument);
    }
    this.state.validation = val;
    this.state.contentIssues = issues;
    if (this.state.autosaveEnabled && val.ok) {
      saveDraftToStorage(this.state.document);
    }
    this.emit();
  }

  /**
   * Applies mutations to the working document candidate.
   */
  updateDocument(mutator: (doc: ResumeV1) => void): void {
    const nextDoc = deepClone(this.state.document);
    mutator(nextDoc);

    const val = validateResume(nextDoc);
    const issues = val.ok ? getContentIssues(nextDoc) : [];
    const isDirty = JSON.stringify(nextDoc) !== JSON.stringify(this.state.sourceDocument);

    this.state.document = nextDoc;
    this.state.validation = val;
    this.state.contentIssues = issues;
    this.state.dirty = isDirty;

    if (this.state.autosaveEnabled && val.ok) {
      saveDraftToStorage(nextDoc);
    }

    this.emit();
  }

  /**
   * Sets the active layout calculation result.
   */
  setLayoutResult(layoutResult: LayoutResult | null): void {
    this.state.layoutResult = layoutResult;
    this.emit();
  }

  /**
   * Sets the connection status.
   */
  setConnection(
    status: EditorState['connection'],
    message?: string,
    staleRevision?: string
  ): void {
    this.state.connection = status;
    this.state.connectionMessage = message;
    if (staleRevision !== undefined) {
      this.state.staleServerRevision = staleRevision;
    }
    this.emit();
  }

  /**
   * Toggles opt-in device autosave.
   */
  setAutosave(enabled: boolean): void {
    persistAutosavePref(enabled);
    this.state.autosaveEnabled = enabled;
    if (enabled && this.state.validation.ok) {
      saveDraftToStorage(this.state.document);
    }
    this.emit();
  }

  /**
   * Marks document successfully saved to local bridge or file.
   */
  markSaved(newRevision: string): void {
    this.state.sourceDocument = deepClone(this.state.document);
    this.state.sourceRevision = newRevision;
    this.state.dirty = false;
    this.state.staleServerRevision = undefined;
    this.state.connection = 'connected';
    this.emit();
  }

  /**
   * Discards the active draft and restores the pristine source document.
   */
  discardDraft(): void {
    this.loadDocument(this.state.sourceDocument, this.state.sourceRevision, true);
  }
}
