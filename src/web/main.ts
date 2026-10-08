/**
 * Web entry point for Resume Studio.
 * Runs strictly in the browser context with native DOM APIs.
 */

import './styles/editor.css';
import './styles/templates.css';
import './styles/print.css';

import { extractSessionCapability, LocalBridgeClient, LocalConflictError } from './adapters/local.js';
import { FileSystemSyncAdapter } from './adapters/filesystem.js';
import { parseResume } from '../core/validation.js';
import { renderResume, resolveDocumentMargin, resolveDocumentMarginMm } from './render.js';
import { createFictionalStarter } from '../core/defaults.js';
import type { ResumeV1, MarginMode } from '../core/generated/resume.js';
import { EditorStore } from './state.js';
import { createEditorView, type EditorView } from './editor.js';
import { renderDiagnostics } from './diagnostics.js';
import { exportDocumentAsJson, importDocumentFromFile } from './files.js';
import { checkPrintEligibility, executePrint } from './print.js';
import {
  hasStoredDraft,
  loadDraftFromStorage,
  clearStoredDraft,
} from './storage.js';
import { getTemplate } from '../core/templates.js';
import { initPaneResizer } from './resizer.js';
import { initZoomController } from './zoom.js';
import { renderTemplatesGallery } from './templates-view.js';
import { openAiPromptModal } from './ai-prompt-modal.js';

let store: EditorStore;
let editorView: EditorView;
let previewRoot: HTMLElement | null = null;
let renderTimer: ReturnType<typeof setTimeout> | null = null;

// Modal dialog helper
function showModal(title: string, bodyContent: HTMLElement | string, footerButtons: Array<{ text: string; className?: string; onClick: () => void }>): () => void {
  const container = document.getElementById('modals-container');
  if (!container) return () => {};

  const previousActiveElement = document.activeElement as HTMLElement | null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const titleId = 'modal-title-' + Math.random().toString(36).slice(2, 9);
  dialog.setAttribute('aria-labelledby', titleId);

  const header = document.createElement('div');
  header.className = 'modal-header';
  const h3 = document.createElement('h3');
  h3.id = titleId;
  h3.textContent = title;
  const btnClose = document.createElement('button');
  btnClose.className = 'btn btn-xs btn-icon';
  btnClose.textContent = '×';
  btnClose.setAttribute('aria-label', 'Close dialog');
  header.appendChild(h3);
  header.appendChild(btnClose);

  const body = document.createElement('div');
  body.className = 'modal-body';
  if (typeof bodyContent === 'string') {
    body.innerHTML = bodyContent;
  } else {
    body.appendChild(bodyContent);
  }

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus();
    }
  };

  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    // Trap focus inside modal
    if (e.key === 'Tab') {
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (firstEl && lastEl) {
        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    }
  };
  document.addEventListener('keydown', onKeyDown);

  for (const btn of footerButtons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${btn.className || 'btn-secondary'}`;
    b.textContent = btn.text;
    b.addEventListener('click', () => {
      close();
      btn.onClick();
    });
    footer.appendChild(b);
  }

  dialog.appendChild(header);
  dialog.appendChild(body);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);
  container.appendChild(overlay);

  // Focus initial focusable element
  setTimeout(() => {
    const firstFocusable = dialog.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }, 10);

  return close;
}

function showConfirmModal(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    showModal('Confirmation Required', `<p>${message}</p>`, [
      { text: 'Cancel', className: 'btn-secondary', onClick: () => resolve(false) },
      { text: 'Proceed', className: 'btn-danger', onClick: () => resolve(true) },
    ]);
  });
}

function showPrintModal(): void {
  const state = store.getState();
  const eligibility = checkPrintEligibility(state.validation, state.layoutResult);

  if (!eligibility.eligible) {
    showModal('Print Blocked', `<p class="text-error"><strong>Cannot Print:</strong> ${eligibility.reason}</p>`, [
      { text: 'Close', className: 'btn-secondary', onClick: () => {} },
    ]);
    return;
  }

  const marginMm = resolveDocumentMarginMm(state.document.document);
  const isLetter = state.document.document.paperSize === 'letter';
  const paperName = isLetter ? 'US Letter (8.5 × 11 in / 215.9 × 279.4 mm)' : 'A4 (210 × 297 mm)';
  const paperShort = isLetter ? 'Letter' : 'A4';

  const instructions = `
    <div class="notice-box notice-warning" style="margin-bottom: 0.85rem;">
      <strong>⚠️ Why margins appear larger in your browser dialog:</strong><br>
      Browsers initially default to physical printers (like <em>HP Color LaserJet Pro</em>), which enforce hardware page borders. To match your exact <strong>${marginMm}mm margins</strong> 1:1, use the 3 settings below:
    </div>

    <div class="print-steps-grid" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem;">
      <div class="item-card" style="padding: 0.65rem 0.85rem; border-left: 3px solid var(--color-primary); background-color: var(--color-canvas);">
        <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-ink);">1. Destination ➔ Choose &ldquo;Save as PDF&rdquo;</div>
        <div class="field-hint" style="margin-top: 2px;">Change Destination from your physical printer to <strong>Save as PDF</strong> (or select your printer if printing directly to paper).</div>
      </div>

      <div class="item-card" style="padding: 0.65rem 0.85rem; border-left: 3px solid var(--color-primary); background-color: var(--color-canvas);">
        <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-ink);">2. More settings ➔ Margins: &ldquo;None&rdquo;</div>
        <div class="field-hint" style="margin-top: 2px;">Click <em>More settings</em> and change Margins from &ldquo;Default&rdquo; to <strong>None</strong> to preserve your exact ${marginMm}mm spacing.</div>
      </div>

      <div class="item-card" style="padding: 0.65rem 0.85rem; border-left: 3px solid var(--color-primary); background-color: var(--color-canvas);">
        <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-ink);">3. Paper size & Scale ➔ ${paperShort} &amp; 100%</div>
        <div class="field-hint" style="margin-top: 2px;">Ensure Paper size is <strong>${paperName}</strong> and Scale is <strong>100%</strong>.</div>
      </div>

      <div class="item-card" style="padding: 0.65rem 0.85rem; border-left: 3px solid var(--color-primary); background-color: var(--color-canvas);">
        <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-ink);">4. Options ➔ Uncheck &ldquo;Headers and footers&rdquo;</div>
        <div class="field-hint" style="margin-top: 2px;">Removes the browser date/time, &ldquo;Resume Studio&rdquo; title, URL, and page numbers from the edges.</div>
      </div>
    </div>
    <p class="field-hint" style="margin: 0;">Once set, Chrome remembers these options for all future prints.</p>
  `;

  showModal('Print / Save PDF Settings', instructions, [
    { text: 'Cancel', className: 'btn-secondary', onClick: () => {} },
    {
      text: 'Open Print Dialog',
      className: 'btn-primary',
      onClick: () => {
        setTimeout(() => {
          executePrint(state.validation, state.layoutResult);
        }, 50);
      },
    },
  ]);
}

function showConflictModal(
  client: LocalBridgeClient,
  storeInstance: EditorStore,
  editor: EditorView,
  diskRevision?: string
): void {
  const body = `
    <p>The document on local disk was updated externally (by another editor or coding agent), while you have unsaved changes in your browser.</p>
    <p><strong>To prevent silent data loss, select how you would like to proceed:</strong></p>
    <ul>
      <li><strong>Keep Browser Draft:</strong> Preserves your current browser edits. Disk file remains unchanged until you explicitly save.</li>
      <li><strong>Discard & Reload Disk:</strong> Replaces your current browser edits with the latest file from disk.</li>
    </ul>
    ${diskRevision ? `<p class="field-hint">Latest disk revision: <code>${diskRevision.slice(0, 8)}</code></p>` : ''}
  `;

  showModal('External Revision Conflict', body, [
    {
      text: 'Keep Browser Draft',
      className: 'btn-secondary',
      onClick: () => {
        storeInstance.setConnection('conflict', 'Kept browser draft. File on disk differs.');
      },
    },
    {
      text: 'Discard & Reload Disk',
      className: 'btn-danger',
      onClick: async () => {
        try {
          const fresh = await client.fetchDocument();
          storeInstance.loadDocument(fresh.document, fresh.revision, true);
          editor.syncFromDocument(fresh.document);
        } catch (err) {
          alert(`Failed to reload from disk: ${(err as Error).message}`);
        }
      },
    },
  ]);
}

function showHelpModal(): void {
  const body = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <h4>Local-First Workflow</h4>
      <p>Local coding agents (Claude Code, Pi, Antigravity) edit structured JSON files or run CLI commands (<code>init</code>, <code>inspect</code>, <code>validate</code>, <code>apply</code>, <code>preview</code>). Browser saves and agent changes coordinate via a cooperative transaction lock with automatic backup rotation.</p>

      <h4>Hosted Mode & Privacy</h4>
      <p>When running as a public website, Resume Studio performs <strong>zero network requests</strong> with your resume data. All parsing, validation, editing, and A4 rendering occur entirely in your browser.</p>

      <h4>AI Prompt & JSON Format</h4>
      <p>Click the <strong>AI Prompt</strong> button in the top toolbar to generate or copy a detailed, schema-compliant prompt for ChatGPT, Claude, Gemini, or DeepSeek. Paste the prompt along with your raw resume into your AI chat, copy the resulting JSON, and import it directly into Resume Studio.</p>

      <h4>Templates & Layout</h4>
      <ul>
        <li><strong>Classic:</strong> Single-column serif with balanced rules. ATS-optimized.</li>
        <li><strong>Modern:</strong> Single-column clean sans-serif with subtle section accents.</li>
        <li><strong>Executive:</strong> Two-column layout with Page 1 Skills/Certifications sidebar. Overflow continues full-width on Page 2.</li>
      </ul>

      <h4>Exporting PDF</h4>
      <p>Click "Print / Save PDF" to open the browser print dialog. Select <strong>Save as PDF</strong>, Paper Size <strong>A4</strong>, and Margins <strong>None</strong> for true selectable-text PDF output.</p>
    </div>
  `;

  showModal('Resume Studio — User & Agent Guide', body, [
    { text: 'Close', className: 'btn-primary', onClick: () => {} },
  ]);
}

function schedulePreview(doc: ResumeV1): void {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(async () => {
    if (previewRoot) {
      const res = await renderResume(doc, previewRoot);
      store.setLayoutResult(res);
    }
  }, 150);
}

async function init(): Promise<void> {
  const root = document.getElementById('app-main');
  if (!root) return;

  const headerLeft = document.querySelector('#app-header .header-left') as HTMLElement;
  const dirtyBadge = document.getElementById('dirty-status') as HTMLElement;
  const btnAiPrompt = document.getElementById('btn-ai-prompt') as HTMLButtonElement | null;
  const fileImportInput = document.getElementById('file-import-input') as HTMLInputElement;
  const btnExport = document.getElementById('btn-export-json') as HTMLButtonElement;
  const btnLocalSave = document.getElementById('btn-local-save') as HTMLButtonElement;
  const btnLocalReload = document.getElementById('btn-local-reload') as HTMLButtonElement;
  const btnPrint = document.getElementById('btn-print-action') as HTMLButtonElement;
  const btnHelp = document.getElementById('btn-help-dialog') as HTMLButtonElement;
  const btnSyncFile = document.getElementById('btn-sync-file') as HTMLButtonElement | null;
  const syncStatus = document.getElementById('sync-status') as HTMLElement | null;

  const diagnosticsContainer = document.getElementById('diagnostics-container') as HTMLElement;
  const formContainer = document.getElementById('form-container') as HTMLElement;

  previewRoot = document.getElementById('resume-preview');

  const pageIndicator = document.getElementById('preview-page-indicator') as HTMLElement | null;
  const templateIndicator = document.getElementById('preview-template-indicator') as HTMLElement | null;
  const fitStatusIndicator = document.getElementById('preview-fit-status') as HTMLElement | null;
  const headerTemplateSelect = document.getElementById('header-doc-template') as HTMLSelectElement | null;
  const previewTemplateSelect = document.getElementById('preview-template-select') as HTMLSelectElement | null;
  const btnToggleMargin = document.getElementById('btn-toggle-margin') as HTMLButtonElement | null;

  const capability = extractSessionCapability();
  let client: LocalBridgeClient | null = null;
  let statusEl: HTMLElement | null = null;

  let initialDoc: ResumeV1;
  let initialRevision: string | undefined;

  let fsAdapter: FileSystemSyncAdapter | null = null;
  let fsRestoredDoc: ResumeV1 | null = null;
  let fsRestoredName: string | null = null;
  let fsRestoredRev: string | null = null;

  if (capability) {
    if (btnSyncFile) btnSyncFile.style.display = 'none';
    if (syncStatus) syncStatus.style.display = 'none';

    statusEl = document.createElement('span');
    statusEl.id = 'bridge-status';
    statusEl.className = 'badge badge-connecting';
    statusEl.textContent = 'Connecting to local bridge...';
    headerLeft.appendChild(statusEl);

    btnLocalSave.style.display = 'inline-flex';
    btnLocalReload.style.display = 'inline-flex';

    try {
      client = new LocalBridgeClient(capability);
      const data = await client.fetchDocument();
      initialDoc = data.document;
      initialRevision = data.revision;

      statusEl.className = 'badge badge-connected';
      statusEl.textContent = `Connected to local bridge (revision: ${data.revision.slice(0, 8)}).`;
    } catch (err) {
      statusEl.className = 'badge badge-error';
      statusEl.textContent = `Local bridge connection error: ${(err as Error).message}`;
      initialDoc = createFictionalStarter('classic', 1);
    }
  } else {
    // Hosted mode notice (kept visually hidden to maintain accessibility and test contract without visual intrusion)
    const hostedNotice = document.createElement('span');
    hostedNotice.className = 'visually-hidden';
    hostedNotice.textContent = 'Application initialized in hosted mode.';
    const metaBar = document.getElementById('editor-meta-bar');
    if (metaBar) {
      metaBar.insertBefore(hostedNotice, metaBar.firstChild);
    }

    initialDoc = createFictionalStarter('classic', 1);

    fsAdapter = new FileSystemSyncAdapter();
    try {
      const restored = await fsAdapter.restoreHandle();
      if (restored) {
        const parsed = parseResume(restored.content);
        if (parsed.ok) {
          fsRestoredDoc = parsed.value;
          fsRestoredName = restored.name;
          fsRestoredRev = restored.revision;
          initialDoc = parsed.value;
          initialRevision = restored.revision;
        }
      }
    } catch {
      // Graceful fallback to starter
    }
  }

  // Initialize Store
  store = new EditorStore(initialDoc, initialRevision);
  editorView = createEditorView(formContainer, store);

  const chkAutosave = document.getElementById('chk-autosave') as HTMLInputElement;
  const btnRestoreAutosave = document.getElementById('btn-restore-autosave') as HTMLButtonElement;
  const btnClearAutosave = document.getElementById('btn-clear-autosave') as HTMLButtonElement;

  // Setup Autosave checkbox state
  if (chkAutosave) {
    chkAutosave.checked = store.getState().autosaveEnabled;
    chkAutosave.addEventListener('change', () => {
      store.setAutosave(chkAutosave.checked);
      updateAutosaveButtons();
    });
  }

  function updateAutosaveButtons(): void {
    const hasStored = hasStoredDraft();
    if (btnRestoreAutosave) {
      btnRestoreAutosave.style.display = hasStored ? 'inline-block' : 'none';
    }
    if (btnClearAutosave) {
      btnClearAutosave.style.display = hasStored ? 'inline-block' : 'none';
    }
  }

  btnRestoreAutosave.addEventListener('click', async () => {
    if (store.getState().dirty) {
      const confirm = await showConfirmModal('Restore draft from device storage? Current unsaved edits will be replaced.');
      if (!confirm) return;
    }
    const draft = loadDraftFromStorage();
    if (draft) {
      store.loadDocument(draft, undefined, false);
      editorView.syncFromDocument(draft);
    }
  });

  btnClearAutosave.addEventListener('click', () => {
    clearStoredDraft();
    updateAutosaveButtons();
  });

  updateAutosaveButtons();

  // Subscribe UI to State updates
  store.subscribe((state) => {
    // Dirty badge
    dirtyBadge.style.display = state.dirty ? 'inline-flex' : 'none';

    // Buttons
    btnExport.disabled = !state.validation.ok;
    btnPrint.disabled = !state.validation.ok || (state.layoutResult?.overflow ?? false);
    if (btnLocalSave.style.display !== 'none') {
      btnLocalSave.disabled = !state.dirty || !state.validation.ok;
    }

    // Diagnostics
    renderDiagnostics(
      diagnosticsContainer,
      [...state.validation.issues, ...state.contentIssues],
      state.layoutResult,
      (path) => editorView.focusField(path)
    );

    // Toolbar indicators
    const tmplDef = getTemplate(state.document.document.template);
    if (templateIndicator) {
      templateIndicator.textContent = tmplDef.name;
    }
    if (headerTemplateSelect && headerTemplateSelect.value !== state.document.document.template) {
      headerTemplateSelect.value = state.document.document.template;
    }
    if (previewTemplateSelect && previewTemplateSelect.value !== state.document.document.template) {
      previewTemplateSelect.value = state.document.document.template;
    }
    if (btnToggleMargin) {
      const margin = resolveDocumentMargin(state.document.document);
      if (margin === 'narrow') {
        btnToggleMargin.textContent = 'Margins: Narrow';
        btnToggleMargin.classList.add('margin-active');
      } else if (margin === 'compact') {
        btnToggleMargin.textContent = 'Margins: Compact';
        btnToggleMargin.classList.add('margin-active');
      } else {
        btnToggleMargin.textContent = 'Margins: Normal';
        btnToggleMargin.classList.remove('margin-active');
      }
    }
    const pageCount = state.layoutResult?.pageCount ?? 1;
    if (pageIndicator) {
      pageIndicator.textContent = `Page: ${pageCount} / ${state.document.document.maxPages}`;
    }
    if (fitStatusIndicator) {
      if (state.layoutResult?.overflow) {
        fitStatusIndicator.textContent = `⚠ Overflow (${pageCount} / ${state.document.document.maxPages})`;
        fitStatusIndicator.className = 'preview-badge badge-overflow';
      } else {
        fitStatusIndicator.textContent = '✓ Fits A4 budget';
        fitStatusIndicator.className = 'preview-badge badge-fit';
      }
    }

    // Debounced layout preview
    if (state.validation.ok) {
      schedulePreview(state.document);
    }

    updateAutosaveButtons();
    renderTemplatesIfActive();
  });

  // Tab Navigation & /templates Routing
  const navTabEditor = document.getElementById('nav-tab-editor') as HTMLButtonElement | null;
  const navTabTemplates = document.getElementById('nav-tab-templates') as HTMLButtonElement | null;
  const appBody = document.getElementById('app-body') as HTMLElement | null;
  const templatesView = document.getElementById('templates-view') as HTMLElement | null;

  function renderTemplatesIfActive(): void {
    if (templatesView && templatesView.style.display !== 'none') {
      renderTemplatesGallery(templatesView, store.getState().document.document.template, {
        onSelectTemplate: (tmplId) => {
          store.updateDocument((d) => {
            d.document.template = tmplId;
            if (tmplId === 'executive' && d.document.accent === 'slate') {
              d.document.accent = 'ocean';
            }
          });
          editorView.syncFromDocument(store.getState().document);
        },
        onNavigateToEditor: () => {
          setActiveTab('editor', true);
        },
      });
    }
  }

  function setActiveTab(tab: 'editor' | 'templates', updateHistory: boolean = true): void {
    if (tab === 'templates') {
      if (navTabTemplates) {
        navTabTemplates.classList.add('active');
        navTabTemplates.setAttribute('aria-selected', 'true');
      }
      if (navTabEditor) {
        navTabEditor.classList.remove('active');
        navTabEditor.setAttribute('aria-selected', 'false');
      }
      if (appBody) appBody.style.display = 'none';
      if (templatesView) {
        templatesView.style.display = 'block';
        renderTemplatesGallery(templatesView, store.getState().document.document.template, {
          onSelectTemplate: (tmplId) => {
            store.updateDocument((d) => {
              d.document.template = tmplId;
              if (tmplId === 'executive' && d.document.accent === 'slate') {
                d.document.accent = 'ocean';
              }
            });
            editorView.syncFromDocument(store.getState().document);
          },
          onNavigateToEditor: () => {
            setActiveTab('editor', true);
          },
        });
      }
      if (updateHistory) {
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;
        if (currentPath !== '/templates' && currentHash !== '#/templates') {
          try {
            window.history.pushState({ tab: 'templates' }, '', '/templates');
          } catch {
            window.location.hash = '#/templates';
          }
        }
      }
    } else {
      if (navTabEditor) {
        navTabEditor.classList.add('active');
        navTabEditor.setAttribute('aria-selected', 'true');
      }
      if (navTabTemplates) {
        navTabTemplates.classList.remove('active');
        navTabTemplates.setAttribute('aria-selected', 'false');
      }
      if (templatesView) templatesView.style.display = 'none';
      if (appBody) appBody.style.display = 'flex';
      if (updateHistory) {
        const currentPath = window.location.pathname;
        const currentHash = window.location.hash;
        if (currentPath === '/templates' || currentHash === '#/templates') {
          try {
            window.history.pushState({ tab: 'editor' }, '', '/');
          } catch {
            window.location.hash = '';
          }
        }
      }
    }
  }

  navTabEditor?.addEventListener('click', () => setActiveTab('editor', true));
  navTabTemplates?.addEventListener('click', () => setActiveTab('templates', true));

  function handleRoute(): void {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path === '/templates' || hash === '#/templates' || hash === '#templates') {
      setActiveTab('templates', false);
    } else {
      setActiveTab('editor', false);
    }
  }

  window.addEventListener('popstate', handleRoute);
  window.addEventListener('hashchange', handleRoute);
  handleRoute();

  function initThemeToggle(): void {
    const btn = document.getElementById('btn-theme-toggle') as HTMLButtonElement | null;
    const iconSun = document.getElementById('theme-icon-sun') as HTMLElement | null;
    const iconMoon = document.getElementById('theme-icon-moon') as HTMLElement | null;

    function updateIcons(isLight: boolean): void {
      if (iconSun && iconMoon) {
        iconSun.style.display = isLight ? 'block' : 'none';
        iconMoon.style.display = isLight ? 'none' : 'block';
      }
      if (btn) {
        const label = isLight ? 'Switch to dark theme' : 'Switch to light theme';
        btn.title = label;
        btn.setAttribute('aria-label', label);
      }
    }

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    updateIcons(isLight);

    if (btn) {
      btn.addEventListener('click', () => {
        const currentlyLight = document.documentElement.getAttribute('data-theme') === 'light';
        const nextTheme = currentlyLight ? 'dark' : 'light';
        if (nextTheme === 'light') {
          document.documentElement.setAttribute('data-theme', 'light');
          try {
            localStorage.setItem('resume-studio-theme', 'light');
          } catch {}
        } else {
          document.documentElement.removeAttribute('data-theme');
          try {
            localStorage.setItem('resume-studio-theme', 'dark');
          } catch {}
        }
        updateIcons(!currentlyLight);
      });
    }
  }

  // Initialize Split Pane Resizer
  initPaneResizer('app-body', 'editor-pane', 'pane-resizer');

  // Initialize Zoom Controller for A4 preview
  initZoomController('preview-pane', 'resume-preview');

  // Initialize Light / Dark Mode Theme Toggle
  initThemeToggle();

  // Top Template and Margin event listeners
  if (headerTemplateSelect) {
    headerTemplateSelect.value = initialDoc.document.template;
    headerTemplateSelect.addEventListener('change', () => {
      const val = headerTemplateSelect.value as any;
      store.updateDocument((d) => {
        d.document.template = val;
        if (val === 'executive' && d.document.accent === 'slate') {
          d.document.accent = 'ocean';
        }
      });
      editorView.syncFromDocument(store.getState().document);
    });
  }

  if (previewTemplateSelect) {
    previewTemplateSelect.value = initialDoc.document.template;
    previewTemplateSelect.addEventListener('change', () => {
      const val = previewTemplateSelect.value as any;
      store.updateDocument((d) => {
        d.document.template = val;
        if (val === 'executive' && d.document.accent === 'slate') {
          d.document.accent = 'ocean';
        }
      });
      editorView.syncFromDocument(store.getState().document);
    });
  }

  if (btnToggleMargin) {
    btnToggleMargin.addEventListener('click', () => {
      const current = resolveDocumentMargin(store.getState().document.document);
      const nextMargin: MarginMode =
        current === 'narrow' ? 'compact' : current === 'compact' ? 'normal' : 'narrow';
      store.updateDocument((d) => {
        d.document.margin = nextMargin;
        d.document.reduceMargin = nextMargin !== 'normal';
      });
      editorView.syncFromDocument(store.getState().document);
    });
  }

  // Initial preview render
  if (previewRoot) {
    const res = await renderResume(initialDoc, previewRoot);
    store.setLayoutResult(res);
  }

  // Setup SSE stream if local client exists
  if (client && statusEl) {
    const currentClient = client;
    const currentStatusEl = statusEl;
    let inFlightSave = false;

    currentClient.subscribeEvents({
      onChange: async (ev) => {
        const currentState = store.getState();
        if (ev.revision === currentState.sourceRevision || inFlightSave) {
          return;
        }

        if (!currentState.dirty) {
          currentStatusEl.className = 'badge badge-connected';
          currentStatusEl.textContent = `Connected to local bridge (revision: ${ev.revision.slice(0, 8)}).`;
          try {
            const fresh = await currentClient.fetchDocument();
            store.loadDocument(fresh.document, fresh.revision, true);
            editorView.syncFromDocument(fresh.document);
          } catch {
            // Retain last valid preview on external read failure
          }
        } else {
          currentStatusEl.className = 'badge badge-error';
          currentStatusEl.textContent = `External update conflict (disk: ${ev.revision.slice(0, 8)}).`;
          store.setConnection('conflict', 'File on disk changed externally.', ev.revision);
          showConflictModal(currentClient, store, editorView, ev.revision);
        }
      },
      onDeleted: () => {
        currentStatusEl.className = 'badge badge-error';
        currentStatusEl.textContent = 'Document was deleted on disk.';
        store.setConnection('error', 'Document was deleted on disk.');
      },
      onError: () => {
        currentStatusEl.className = 'badge badge-connecting';
        currentStatusEl.textContent = 'Reconnecting to local bridge...';
      },
    });

    btnLocalSave.addEventListener('click', async () => {
      const state = store.getState();
      if (!state.dirty || !state.validation.ok || !state.sourceRevision) return;

      try {
        btnLocalSave.disabled = true;
        inFlightSave = true;
        const res = await currentClient.saveDocument(state.sourceRevision, state.document);
        store.markSaved(res.revision);
        currentStatusEl.className = 'badge badge-connected';
        currentStatusEl.textContent = `Connected to local bridge (revision: ${res.revision.slice(0, 8)}).`;
      } catch (err) {
        if (err instanceof LocalConflictError || (err as Error).message?.includes('409')) {
          store.setConnection('conflict', 'Save conflict: file changed on disk.');
          showConflictModal(currentClient, store, editorView);
        } else {
          alert(`Save failed: ${(err as Error).message}`);
        }
      } finally {
        inFlightSave = false;
        btnLocalSave.disabled = false;
      }
    });

    btnLocalReload.addEventListener('click', async () => {
      const state = store.getState();
      if (state.dirty) {
        const confirmed = await showConfirmModal('Discard unsaved changes and reload file from disk?');
        if (!confirmed) return;
      }

      try {
        const fresh = await currentClient.fetchDocument();
        store.loadDocument(fresh.document, fresh.revision, true);
        editorView.syncFromDocument(fresh.document);
        currentStatusEl.className = 'badge badge-connected';
        currentStatusEl.textContent = `Connected to local bridge (revision: ${fresh.revision.slice(0, 8)}).`;
      } catch (err) {
        alert(`Reload failed: ${(err as Error).message}`);
      }
    });
  }

  // Setup File System Access live sync if in hosted mode
  if (!capability && fsAdapter) {
    const activeFs = fsAdapter;

    function updateSyncUiConnected(fileName: string, revision?: string): void {
      if (syncStatus) {
        syncStatus.style.display = 'inline-flex';
        syncStatus.className = 'badge badge-connected';
        syncStatus.textContent = `● Linked: ${fileName}`;
        syncStatus.title = revision
          ? `Synced with ${fileName} (revision: ${revision.slice(0, 8)})`
          : `Synced with ${fileName}`;
      }
      btnLocalSave.style.display = 'inline-flex';
    }

    function updateSyncUiDisconnected(): void {
      if (syncStatus) {
        syncStatus.style.display = 'inline-flex';
        syncStatus.className = 'badge badge-hosted';
        syncStatus.textContent = '○ Not Linked';
        syncStatus.title = 'No local file linked. Working in-memory.';
      }
      btnLocalSave.style.display = 'none';
    }

    function showFsConflictModal(adapter: FileSystemSyncAdapter, diskDoc: ResumeV1, diskRevision: string): void {
      const fileName = adapter.getState().fileName ?? 'resume.json';
      const body = `
        <p>The file <code>${fileName}</code> on local disk was updated externally (e.g. by an AI coding agent), while you have unsaved edits in your browser.</p>
        <p><strong>To prevent silent data loss, select how you would like to proceed:</strong></p>
        <ul>
          <li><strong>Keep Browser Draft:</strong> Preserves your current browser edits. File on disk remains unchanged until you explicitly save.</li>
          <li><strong>Discard & Reload Disk:</strong> Replaces your current browser edits with the latest file from disk.</li>
        </ul>
        <p class="field-hint">Latest disk revision: <code>${diskRevision.slice(0, 8)}</code></p>
      `;

      showModal('External Revision Conflict', body, [
        {
          text: 'Keep Browser Draft',
          className: 'btn-secondary',
          onClick: () => {
            if (syncStatus) {
              syncStatus.className = 'badge badge-error';
              syncStatus.textContent = `⚠ Conflict: ${fileName}`;
            }
          },
        },
        {
          text: 'Discard & Reload Disk',
          className: 'btn-danger',
          onClick: () => {
            store.loadDocument(diskDoc, diskRevision, true);
            editorView.syncFromDocument(diskDoc);
            updateSyncUiConnected(fileName, diskRevision);
          },
        },
      ]);
    }

    function startFsWatching(adapter: FileSystemSyncAdapter): void {
      adapter.startWatching((newContent, newRevision) => {
        const state = store.getState();
        if (newRevision === state.sourceRevision) {
          return;
        }

        const parsed = parseResume(newContent);
        const fileName = adapter.getState().fileName ?? 'resume.json';

        if (!parsed.ok) {
          if (syncStatus) {
            syncStatus.className = 'badge badge-error';
            syncStatus.textContent = `⚠ ${fileName} (Syntax error on disk)`;
            syncStatus.title = `The file on disk has syntax or validation errors. Current preview preserved.`;
          }
          return;
        }

        if (!state.dirty) {
          store.loadDocument(parsed.value, newRevision, true);
          editorView.syncFromDocument(parsed.value);
          updateSyncUiConnected(fileName, newRevision);
        } else {
          if (syncStatus) {
            syncStatus.className = 'badge badge-error';
            syncStatus.textContent = `⚠ Conflict: ${fileName}`;
          }
          showFsConflictModal(adapter, parsed.value, newRevision);
        }
      });
    }

    if (fsRestoredDoc && fsRestoredName) {
      updateSyncUiConnected(fsRestoredName, fsRestoredRev ?? undefined);
      startFsWatching(activeFs);
    } else {
      updateSyncUiDisconnected();
    }

    if (btnSyncFile) {
      if (activeFs.isSupported()) {
        btnSyncFile.style.display = 'inline-flex';
      } else {
        btnSyncFile.style.display = 'none';
      }

      btnSyncFile.addEventListener('click', async () => {
        try {
          if (store.getState().dirty) {
            const confirmed = await showConfirmModal('You have unsaved changes. Discard current changes and link local file?');
            if (!confirmed) return;
          }

          const linked = await activeFs.linkFile();
          const parsed = parseResume(linked.content);
          if (!parsed.ok) {
            const errMsgs = parsed.issues.map((i) => `• [${i.path}]: ${i.message}`).join('<br>');
            showModal('Invalid Resume File', `<p>The selected file is not a valid Resume Studio JSON document.</p><div class="notice-box notice-warning">${errMsgs}</div>`, [
              { text: 'Close', className: 'btn-secondary', onClick: () => {} },
            ]);
            return;
          }

          store.loadDocument(parsed.value, linked.revision, true);
          editorView.syncFromDocument(parsed.value);
          updateSyncUiConnected(linked.name, linked.revision);
          startFsWatching(activeFs);
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            alert(`Failed to link file: ${(err as Error).message}`);
          }
        }
      });
    }

    btnLocalSave.addEventListener('click', async () => {
      const state = store.getState();
      if (!state.dirty || !state.validation.ok) return;

      try {
        btnLocalSave.disabled = true;
        const serialized = JSON.stringify(state.document, null, 2) + '\n';
        const newRev = await activeFs.writeFile(serialized);
        store.markSaved(newRev);
        updateSyncUiConnected(activeFs.getState().fileName ?? 'resume.json', newRev);
      } catch (err) {
        alert(`Failed to save to local file: ${(err as Error).message}`);
      } finally {
        btnLocalSave.disabled = false;
      }
    });
  }

  // --- Header Action Handlers ---

  fileImportInput.addEventListener('change', async () => {
    const file = fileImportInput.files?.[0];
    if (!file) return;

    if (store.getState().dirty) {
      const confirmed = await showConfirmModal('You have unsaved changes. Discard current changes and open new JSON?');
      if (!confirmed) {
        fileImportInput.value = '';
        return;
      }
    }

    const res = await importDocumentFromFile(file);
    fileImportInput.value = '';

    if (!res.ok) {
      const errMsgs = res.issues.map((i) => `• [${i.path}]: ${i.message}`).join('<br>');
      showModal('Import Validation Failed', `<p>The selected file is not a valid Resume Studio JSON document. Your current draft was preserved untouched.</p><div class="notice-box notice-warning">${errMsgs}</div>`, [
        { text: 'Close', className: 'btn-secondary', onClick: () => {} },
      ]);
      return;
    }

    store.loadDocument(res.document, undefined, true);
    editorView.syncFromDocument(res.document);
  });

  btnAiPrompt?.addEventListener('click', () => {
    openAiPromptModal(store, editorView, showConfirmModal);
  });

  btnExport.addEventListener('click', () => {
    const state = store.getState();
    if (!state.validation.ok) return;
    exportDocumentAsJson(state.document);
  });

  btnPrint.addEventListener('click', () => {
    showPrintModal();
  });

  btnHelp.addEventListener('click', () => {
    showHelpModal();
  });

  // Warn on tab closing if dirty
  window.addEventListener('beforeunload', (e) => {
    if (store.getState().dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}
