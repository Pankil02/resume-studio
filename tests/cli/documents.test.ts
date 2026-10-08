import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertSafeDocumentPath,
  computeRevision,
  readDocument,
  initDocument,
  inspectDocument,
  validateDocument,
  DocumentIoError,
  MAX_FILE_BYTES,
} from '../../src/cli/documents.js';

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'resume-docs-test-'));
  try {
    fn(dir);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}

test('documents: rejects protected files and directories', () => {
  assert.throws(
    () => assertSafeDocumentPath('.env'),
    (err: unknown) => (err as DocumentIoError).code === 'PROTECTED_PATH'
  );
  assert.throws(
    () => assertSafeDocumentPath('.env.local'),
    (err: unknown) => (err as DocumentIoError).code === 'PROTECTED_PATH'
  );
  assert.throws(
    () => assertSafeDocumentPath('node_modules/resume.json'),
    (err: unknown) => (err as DocumentIoError).code === 'PROTECTED_DIRECTORY'
  );
  assert.throws(
    () => assertSafeDocumentPath('dist/web/resume.json'),
    (err: unknown) => (err as DocumentIoError).code === 'PROTECTED_DIRECTORY'
  );
  assert.throws(
    () => assertSafeDocumentPath('public/resume.json'),
    (err: unknown) => (err as DocumentIoError).code === 'PROTECTED_DIRECTORY'
  );
});

test('documents: rejects symlinks and non-regular files', () => {
  withTempDir((dir) => {
    const targetFile = join(dir, 'real.json');
    writeFileSync(targetFile, '{}');

    const linkFile = join(dir, 'symlink.json');
    symlinkSync(targetFile, linkFile);

    assert.throws(
      () => assertSafeDocumentPath(linkFile),
      (err: unknown) => (err as DocumentIoError).code === 'SYMLINK_FORBIDDEN'
    );

    assert.throws(
      () => assertSafeDocumentPath(dir),
      (err: unknown) => (err as DocumentIoError).code === 'NOT_REGULAR_FILE'
    );
  });
});

test('documents: init creates valid starter and refuses to overwrite existing file', () => {
  withTempDir((dir) => {
    const resumePath = join(dir, 'my-resume.json');

    const { filePath, revision } = initDocument({
      filePath: resumePath,
      template: 'classic',
      maxPages: 2,
    });

    assert.equal(existsSync(resumePath), true);
    assert.equal(typeof revision, 'string');
    assert.equal(revision.length, 64);

    // Refuse to clobber existing file
    assert.throws(
      () => initDocument({ filePath: resumePath }),
      (err: unknown) => (err as DocumentIoError).code === 'FILE_ALREADY_EXISTS'
    );

    // Validate the newly created starter
    const validation = validateDocument(resumePath);
    assert.equal(validation.ok, true);
    assert.equal(validation.revision, revision);

    // Inspect document
    const inspected = inspectDocument(resumePath);
    assert.equal(inspected.revision, revision);
    assert.equal(inspected.document.document.template, 'classic');
    assert.equal(inspected.document.document.maxPages, 2);
  });
});

test('documents: rejects oversized file > 128 KiB', () => {
  withTempDir((dir) => {
    const largePath = join(dir, 'large.json');
    const largeBuffer = Buffer.alloc(MAX_FILE_BYTES + 10, 32); // 128 KiB + 10 spaces
    writeFileSync(largePath, largeBuffer);

    assert.throws(
      () => readDocument(largePath),
      (err: unknown) => (err as DocumentIoError).code === 'FILE_TOO_LARGE'
    );
  });
});

test('documents: computeRevision is deterministic SHA-256', () => {
  const buf = Buffer.from('{"hello":"world"}\n', 'utf-8');
  const rev1 = computeRevision(buf);
  const rev2 = computeRevision(buf);
  assert.equal(rev1, rev2);
  assert.equal(rev1.length, 64);
});
