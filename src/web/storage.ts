import type { ResumeV1 } from '../core/generated/resume.js';
import { parseResume } from '../core/validation.js';

const DRAFT_STORAGE_KEY = 'resume-studio:v1:draft';
const AUTOSAVE_KEY = 'resume-studio:v1:autosave-enabled';

/**
 * Checks whether device autosave is explicitly enabled.
 * Default is strictly FALSE.
 */
export function isAutosaveEnabled(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(AUTOSAVE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Updates the device autosave preference.
 */
export function setAutosaveEnabled(enabled: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (enabled) {
      window.localStorage.setItem(AUTOSAVE_KEY, 'true');
    } else {
      window.localStorage.removeItem(AUTOSAVE_KEY);
    }
  } catch {
    // Storage access blocked or denied
  }
}

/**
 * Saves a draft to localStorage if autosave is enabled.
 * Returns true if saved successfully, false otherwise.
 */
export function saveDraftToStorage(doc: ResumeV1): boolean {
  if (!isAutosaveEnabled()) {
    return false;
  }
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const json = JSON.stringify(doc);
    window.localStorage.setItem(DRAFT_STORAGE_KEY, json);
    return true;
  } catch {
    // Graceful fallback to memory on quota error or restricted environment
    return false;
  }
}

/**
 * Checks whether a stored draft exists in localStorage.
 */
export function hasStoredDraft(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return !!window.localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return false;
  }
}

/**
 * Loads and validates a draft from localStorage.
 * Returns the parsed ResumeV1 if valid, or null if missing or invalid.
 */
export function loadDraftFromStorage(): ResumeV1 | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const result = parseResume(raw);
    if (result.ok) {
      return result.value;
    }
    // Stored draft is invalid or corrupted; do not return corrupted data
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears the stored draft from localStorage.
 */
export function clearStoredDraft(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Storage access blocked
  }
}
