import {
  existsSync,
  mkdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  renameSync,
  rmSync,
  chmodSync,
} from 'node:fs';
import { resolve, normalize, basename } from 'node:path';
import {
  assertSafeDocumentPath,
  computeRevision,
  readDocument,
  DocumentConflictError,
  DocumentIoError,
  MAX_FILE_BYTES,
} from './documents.js';
import { parseResume, type Validation } from '../core/validation.js';

export const MAX_BACKUPS = 10;
export const LOCK_TIMEOUT_MS = 5000;
export const LOCK_POLL_MS = 50;

export class LockTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockTimeoutError';
  }
}

// In-process mutex queue per normalized file path
const inProcessQueues = new Map<string, Promise<unknown>>();

async function enqueueInProcess<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const current = inProcessQueues.get(filePath) || Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((r) => {
    release = r;
  });
  inProcessQueues.set(filePath, next);

  try {
    await current;
    return await fn();
  } finally {
    release!();
    if (inProcessQueues.get(filePath) === next) {
      inProcessQueues.delete(filePath);
    }
  }
}

export interface LockHandle {
  lockDir: string;
  release: () => void;
}

/**
 * Attempts to acquire an atomic directory lock for the given target file.
 */
export async function acquireFileLock(
  targetPath: string,
  timeoutMs: number = LOCK_TIMEOUT_MS
): Promise<LockHandle> {
  const normalized = normalize(resolve(targetPath));
  const lockDir = `${normalized}.lock`;
  const startTime = Date.now();

  while (true) {
    try {
      mkdirSync(lockDir);
      // Successfully created lock directory
      const ownerPath = `${lockDir}/owner.json`;
      const ownerInfo = JSON.stringify({ pid: process.pid, createdAt: Date.now() });
      try {
        writeFileSync(ownerPath, ownerInfo, { mode: 0o600 });
      } catch {
        // Non-critical if writing owner metadata fails
      }

      return {
        lockDir,
        release: () => {
          try {
            if (existsSync(ownerPath)) {
              unlinkSync(ownerPath);
            }
          } catch {
            // Ignore
          }
          try {
            if (existsSync(lockDir)) {
              rmSync(lockDir, { recursive: true, force: true });
            }
          } catch {
            // Ignore
          }
        },
      };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'EEXIST') {
        if (Date.now() - startTime >= timeoutMs) {
          throw new LockTimeoutError(
            `Timed out after ${timeoutMs}ms waiting to acquire cooperative lock on '${basename(targetPath)}'.`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
      } else {
        throw new DocumentIoError(
          `Failed to acquire lock on '${basename(targetPath)}': ${(err as Error).message}`,
          'LOCK_ERROR'
        );
      }
    }
  }
}

/**
 * Rotates bounded backups for a document (.bak.1 ... .bak.10) and copies current target to .bak.1.
 */
export function rotateAndCreateBackup(targetPath: string): void {
  // 1. Prune oldest backup if it exists
  const maxBak = `${targetPath}.bak.${MAX_BACKUPS}`;
  if (existsSync(maxBak)) {
    try {
      unlinkSync(maxBak);
    } catch {
      // Ignore cleanup error
    }
  }

  // 2. Shift older backups down (.bak.9 -> .bak.10, ..., .bak.1 -> .bak.2)
  for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
    const src = `${targetPath}.bak.${i}`;
    const dest = `${targetPath}.bak.${i + 1}`;
    if (existsSync(src)) {
      try {
        renameSync(src, dest);
      } catch {
        // Ignore rename error
      }
    }
  }

  // 3. Copy current target file to .bak.1 with restricted mode 0o600
  const bak1 = `${targetPath}.bak.1`;
  copyFileSync(targetPath, bak1);
  try {
    chmodSync(bak1, 0o600);
  } catch {
    // Mode setting best effort
  }
}

export interface ApplyOptions {
  targetPath: string;
  candidateContent: string;
  expectedRevision: string;
}

export interface ApplyResult {
  ok: true;
  revision: string;
  previousRevision: string;
}

/**
 * Executes an atomic, cooperative document write transaction:
 * 1. Validates candidate content.
 * 2. In-process mutex + cooperative directory lock.
 * 3. Fresh-read target file and verify revision against expectedRevision.
 * 4. Write candidate to restricted sibling temp file (mode 0o600).
 * 5. Create bounded backup (.bak.1 ... .bak.10).
 * 6. Atomically replace target with temp file.
 * 7. Clean up temp file on failure and release lock.
 */
export async function applyDocumentTransaction(options: ApplyOptions): Promise<ApplyResult> {
  const { targetPath, candidateContent, expectedRevision } = options;

  // 1. First validate candidate BEFORE acquiring locks or mutating filesystem
  const candidateBytes = Buffer.byteLength(candidateContent, 'utf-8');
  if (candidateBytes > MAX_FILE_BYTES) {
    throw new DocumentIoError(
      `Candidate content size (${candidateBytes} bytes) exceeds maximum allowed ${MAX_FILE_BYTES} bytes.`,
      'CANDIDATE_TOO_LARGE'
    );
  }

  const validation = parseResume(candidateContent);
  if (!validation.ok) {
    const err = new DocumentIoError(
      `Candidate resume failed validation. Run 'validate' to view issues.`,
      'INVALID_CANDIDATE'
    );
    (err as unknown as { validation: Validation }).validation = validation;
    throw err;
  }

  const safeTarget = assertSafeDocumentPath(targetPath);

  // 2. Execute within in-process queue + cooperative directory lock
  return enqueueInProcess(safeTarget, async () => {
    const lock = await acquireFileLock(safeTarget);
    let tempPath: string | null = null;

    try {
      // 3. Fresh-read target file
      const currentDoc = readDocument(safeTarget);
      const currentRevision = currentDoc.revision;

      // Check revision match
      if (currentRevision !== expectedRevision) {
        throw new DocumentConflictError(
          `Revision conflict: expected revision '${expectedRevision}' does not match current source revision '${currentRevision}'.`
        );
      }

      // 4. Create sibling temporary file in the same directory
      const randSuffix = Math.random().toString(36).slice(2, 8);
      tempPath = `${safeTarget}.tmp.${process.pid}.${Date.now()}.${randSuffix}`;

      writeFileSync(tempPath, candidateContent, { mode: 0o600 });

      // 5. Create bounded backup (.bak.1)
      rotateAndCreateBackup(safeTarget);

      // 6. Atomically replace target file with temp file
      renameSync(tempPath, safeTarget);
      tempPath = null; // Successfully moved

      const newBuffer = Buffer.from(candidateContent, 'utf-8');
      const newRevision = computeRevision(newBuffer);

      return {
        ok: true,
        revision: newRevision,
        previousRevision: currentRevision,
      };
    } finally {
      if (tempPath && existsSync(tempPath)) {
        try {
          unlinkSync(tempPath);
        } catch {
          // Ignore temp cleanup error
        }
      }
      lock.release();
    }
  });
}
