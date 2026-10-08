import { existsSync, lstatSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename, normalize } from 'node:path';
import { createHash } from 'node:crypto';
import { parseResume, type Issue, type Validation } from '../core/validation.js';
import { createBlankResume } from '../core/defaults.js';
import type { ResumeV1, TemplateId, MaxPages } from '../core/generated/resume.js';
import { FIELD_BOUNDS } from '../core/generated/guidance.js';

export const MAX_FILE_BYTES = FIELD_BOUNDS.maxInputBytes; // 131,072 bytes (128 KiB)

export class DocumentIoError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'DOCUMENT_IO_ERROR') {
    super(message);
    this.code = code;
    this.name = 'DocumentIoError';
  }
}

export class DocumentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentConflictError';
  }
}

const PROTECTED_NAME_PATTERNS = [
  /^\.env(\..+)?$/i,
  /^\.git$/i,
  /^\.ssh$/i,
  /^\.aws$/i,
  /^\.gnupg$/i,
];

const PROTECTED_DIR_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'dist-test',
  'public',
  '.git',
  '.ssh',
  '.aws',
  '.gnupg',
]);

/**
 * Validates whether a file path targets an allowed, non-protected, non-symlink location.
 */
export function assertSafeDocumentPath(filePath: string): string {
  const resolved = resolve(filePath);
  const normalized = normalize(resolved);
  const segments = normalized.split(/[\/\\]/);
  const base = basename(normalized);

  // Check file name against protected patterns (e.g. .env, .env.local)
  for (const pattern of PROTECTED_NAME_PATTERNS) {
    if (pattern.test(base)) {
      throw new DocumentIoError(
        `Access denied: protected file pattern '${base}' cannot be used as a resume document.`,
        'PROTECTED_PATH'
      );
    }
  }

  // Check path segments against protected directories
  for (const segment of segments) {
    if (PROTECTED_DIR_SEGMENTS.has(segment)) {
      throw new DocumentIoError(
        `Access denied: cannot read or write resume documents inside protected directory '${segment}'.`,
        'PROTECTED_DIRECTORY'
      );
    }
  }

  // If file exists, assert it is a regular file and NOT a symlink
  if (existsSync(normalized)) {
    const stat = lstatSync(normalized);
    if (stat.isSymbolicLink()) {
      throw new DocumentIoError(
        `Access denied: symlinks are forbidden for resume documents.`,
        'SYMLINK_FORBIDDEN'
      );
    }
    if (!stat.isFile()) {
      throw new DocumentIoError(
        `Path '${normalized}' is not a regular file.`,
        'NOT_REGULAR_FILE'
      );
    }
  }

  return normalized;
}

/**
 * Computes deterministic SHA-256 hex digest of exact file bytes.
 */
export function computeRevision(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export interface ReadDocumentResult {
  filePath: string;
  buffer: Buffer;
  text: string;
  revision: string;
  validation: Validation;
}

/**
 * Reads a resume document from disk with size checks, symlink checks, and SHA-256 hashing.
 */
export function readDocument(filePath: string): ReadDocumentResult {
  const targetPath = assertSafeDocumentPath(filePath);

  if (!existsSync(targetPath)) {
    throw new DocumentIoError(`File not found: '${targetPath}'`, 'FILE_NOT_FOUND');
  }

  const stat = lstatSync(targetPath);
  if (stat.isSymbolicLink()) {
    throw new DocumentIoError(
      `Access denied: symlinks are forbidden for resume documents.`,
      'SYMLINK_FORBIDDEN'
    );
  }
  if (!stat.isFile()) {
    throw new DocumentIoError(`Path '${targetPath}' is not a regular file.`, 'NOT_REGULAR_FILE');
  }

  if (stat.size > MAX_FILE_BYTES) {
    throw new DocumentIoError(
      `File size (${stat.size} bytes) exceeds maximum allowed ${MAX_FILE_BYTES} bytes (128 KiB).`,
      'FILE_TOO_LARGE'
    );
  }

  const buffer = readFileSync(targetPath);
  if (buffer.length > MAX_FILE_BYTES) {
    throw new DocumentIoError(
      `File size (${buffer.length} bytes) exceeds maximum allowed ${MAX_FILE_BYTES} bytes.`,
      'FILE_TOO_LARGE'
    );
  }

  const revision = computeRevision(buffer);
  const text = buffer.toString('utf-8');
  const validation = parseResume(text);

  return {
    filePath: targetPath,
    buffer,
    text,
    revision,
    validation,
  };
}

export interface InitDocumentOptions {
  filePath: string;
  template?: TemplateId;
  maxPages?: MaxPages;
}

/**
 * Initializes a new blank resume document. Refuses to overwrite existing files.
 */
export function initDocument(options: InitDocumentOptions): { filePath: string; revision: string } {
  const targetPath = assertSafeDocumentPath(options.filePath);

  if (existsSync(targetPath)) {
    throw new DocumentIoError(
      `Target file already exists: '${targetPath}'. init refuses to overwrite existing files.`,
      'FILE_ALREADY_EXISTS'
    );
  }

  const parentDir = dirname(targetPath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  const starter = createBlankResume(options.template || 'classic', options.maxPages || 1);
  const jsonContent = JSON.stringify(starter, null, 2) + '\n';
  const buffer = Buffer.from(jsonContent, 'utf-8');

  writeFileSync(targetPath, buffer, { mode: 0o644 });
  const revision = computeRevision(buffer);

  return { filePath: targetPath, revision };
}

/**
 * Inspects a document on disk and returns its revision and parsed document object.
 */
export function inspectDocument(filePath: string): { revision: string; document: ResumeV1 } {
  const result = readDocument(filePath);
  if (!result.validation.ok) {
    throw new DocumentIoError(
      `Cannot inspect invalid document. Run 'validate' to view issues.`,
      'INVALID_DOCUMENT'
    );
  }
  return {
    revision: result.revision,
    document: result.validation.value,
  };
}

/**
 * Validates a document on disk and returns validity, revision, and non-PII issues.
 */
export function validateDocument(filePath: string): { ok: boolean; revision: string; issues: Issue[] } {
  const result = readDocument(filePath);
  return {
    ok: result.validation.ok,
    revision: result.revision,
    issues: result.validation.issues,
  };
}
