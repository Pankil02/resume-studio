import type { ResumeV1 } from '../core/generated/resume.js';
import { parseResume, type Issue } from '../core/validation.js';

const MAX_BYTES = 131072; // 128 KiB hard limit

/**
 * Sanitizes a document title for safe filename usage.
 */
export function sanitizeFilename(title: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  return sanitized || 'resume';
}

export type ImportResult =
  | { ok: true; document: ResumeV1; issues: Issue[] }
  | { ok: false; issues: Issue[] };

/**
 * Imports and strictly validates a JSON file from user file input.
 */
export async function importDocumentFromFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      issues: [
        {
          code: 'OVERSIZED_INPUT',
          severity: 'error',
          path: '/',
          message: `File size (${file.size} bytes) exceeds maximum limit of 128 KiB (${MAX_BYTES} bytes).`,
        },
      ],
    };
  }

  let text: string;
  try {
    text = await file.text();
  } catch (err) {
    return {
      ok: false,
      issues: [
        {
          code: 'FILE_READ_ERROR',
          severity: 'error',
          path: '/',
          message: `Could not read file: ${(err as Error).message}`,
        },
      ],
    };
  }

  const parsed = parseResume(text);
  if (!parsed.ok) {
    return {
      ok: false,
      issues: parsed.issues,
    };
  }

  return {
    ok: true,
    document: parsed.value,
    issues: parsed.issues,
  };
}

/**
 * Imports and strictly validates a JSON string (e.g. from clipboard or paste input).
 */
export function importDocumentFromText(text: string): ImportResult {
  const parsed = parseResume(text);
  if (!parsed.ok) {
    return {
      ok: false,
      issues: parsed.issues,
    };
  }

  return {
    ok: true,
    document: parsed.value,
    issues: parsed.issues,
  };
}

/**
 * Exports a valid resume document as a formatted JSON file download.
 * Cleans up temporary Blob URLs immediately.
 */
export function exportDocumentAsJson(doc: ResumeV1): void {
  const filename = `${sanitizeFilename(doc.document.title)}.json`;
  const json = JSON.stringify(doc, null, 2) + '\n';
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
}
