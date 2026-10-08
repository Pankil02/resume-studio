import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  acquireFileLock,
  rotateAndCreateBackup,
  applyDocumentTransaction,
  LockTimeoutError,
  MAX_BACKUPS,
} from '../../src/cli/locks.js';
import {
  initDocument,
  readDocument,
  computeRevision,
  DocumentConflictError,
  DocumentIoError,
} from '../../src/cli/documents.js';
import { createBlankResume } from '../../src/core/defaults.js';

function withTempDir(fn: (dir: string) => Promise<void> | void): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'resume-tx-test-'));
  const cleanup = () => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  };

  const res = fn(dir);
  if (res instanceof Promise) {
    return res.finally(cleanup);
  }
  cleanup();
  return Promise.resolve();
}

test('locks: acquire and release file lock', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'test.json');
    writeFileSync(file, '{}');

    const lock = await acquireFileLock(file, 1000);
    assert.equal(existsSync(`${file}.lock`), true);

    // Another acquire should time out while lock is held
    await assert.rejects(
      async () => acquireFileLock(file, 200),
      (err: unknown) => err instanceof LockTimeoutError
    );

    // Release lock
    lock.release();
    assert.equal(existsSync(`${file}.lock`), false);

    // Now acquiring again should succeed immediately
    const lock2 = await acquireFileLock(file, 500);
    lock2.release();
  });
});

test('locks: rotateAndCreateBackup creates bounded backups up to 10', async () => {
  await withTempDir((dir) => {
    const file = join(dir, 'resume.json');
    writeFileSync(file, 'initial content');

    // Create 12 backups sequentially
    for (let i = 1; i <= 12; i++) {
      writeFileSync(file, `content revision ${i}`);
      rotateAndCreateBackup(file);
    }

    // Verify .bak.1 through .bak.10 exist
    for (let i = 1; i <= MAX_BACKUPS; i++) {
      assert.equal(existsSync(`${file}.bak.${i}`), true);
    }

    // Verify .bak.11 does not exist (strictly bounded to 10)
    assert.equal(existsSync(`${file}.bak.11`), false);

    // Verify .bak.1 has the most recent previous content ("content revision 12")
    const bak1Content = readFileSync(`${file}.bak.1`, 'utf-8');
    assert.equal(bak1Content, 'content revision 12');
  });
});

test('locks: applyDocumentTransaction succeeds and creates backup', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'resume.json');
    const { revision: initialRev } = initDocument({ filePath: file, template: 'classic', maxPages: 1 });

    const candidateDoc = createBlankResume('classic', 1);
    candidateDoc.document.title = 'Updated Title by Transaction';
    candidateDoc.profile.name = 'Updated Name';
    const candidateContent = JSON.stringify(candidateDoc, null, 2) + '\n';

    const result = await applyDocumentTransaction({
      targetPath: file,
      candidateContent,
      expectedRevision: initialRev,
    });

    assert.equal(result.ok, true);
    assert.equal(result.previousRevision, initialRev);
    assert.notEqual(result.revision, initialRev);

    // Verify target file has updated content
    const updated = readDocument(file);
    assert.equal(updated.revision, result.revision);
    assert.equal(updated.validation.ok, true);
    if (updated.validation.ok) {
      assert.equal(updated.validation.value.profile.name, 'Updated Name');
    }

    // Verify backup .bak.1 exists and has initial revision
    assert.equal(existsSync(`${file}.bak.1`), true);
    const bakRev = computeRevision(readFileSync(`${file}.bak.1`));
    assert.equal(bakRev, initialRev);
  });
});

test('locks: apply rejects stale revision and preserves target file', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'resume.json');
    const { revision: initialRev } = initDocument({ filePath: file, template: 'classic', maxPages: 1 });

    const candidateDoc = createBlankResume('classic', 1);
    candidateDoc.profile.name = 'Should Never Be Written';
    const candidateContent = JSON.stringify(candidateDoc, null, 2) + '\n';

    const wrongRev = '0'.repeat(64);

    await assert.rejects(
      async () =>
        applyDocumentTransaction({
          targetPath: file,
          candidateContent,
          expectedRevision: wrongRev,
        }),
      (err: unknown) => err instanceof DocumentConflictError
    );

    // Target file is unchanged
    const doc = readDocument(file);
    assert.equal(doc.revision, initialRev);
    assert.equal(doc.validation.ok, true);
    if (doc.validation.ok) {
      assert.equal(doc.validation.value.profile.name, 'Full Name');
    }
  });
});

test('locks: apply rejects invalid candidate before modifying disk', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'resume.json');
    const { revision: initialRev } = initDocument({ filePath: file });

    const invalidCandidate = '{"broken": json}';

    await assert.rejects(
      async () =>
        applyDocumentTransaction({
          targetPath: file,
          candidateContent: invalidCandidate,
          expectedRevision: initialRev,
        }),
      (err: unknown) => (err as DocumentIoError).code === 'INVALID_CANDIDATE'
    );

    // File unchanged
    const doc = readDocument(file);
    assert.equal(doc.revision, initialRev);
  });
});

test('locks: concurrent cooperative writers serialize and second writer detects conflict', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'resume.json');
    const { revision: initialRev } = initDocument({ filePath: file });

    // Writer A candidate
    const docA = createBlankResume('classic', 1);
    docA.profile.name = 'Writer A Update';
    const contentA = JSON.stringify(docA, null, 2) + '\n';

    // Writer B candidate (based on same initialRev)
    const docB = createBlankResume('classic', 1);
    docB.profile.name = 'Writer B Update';
    const contentB = JSON.stringify(docB, null, 2) + '\n';

    // Writer A applies first
    const resA = await applyDocumentTransaction({
      targetPath: file,
      candidateContent: contentA,
      expectedRevision: initialRev,
    });
    assert.equal(resA.ok, true);

    // Writer B attempts apply with initialRev (now stale!)
    await assert.rejects(
      async () =>
        applyDocumentTransaction({
          targetPath: file,
          candidateContent: contentB,
          expectedRevision: initialRev,
        }),
      (err: unknown) => err instanceof DocumentConflictError
    );

    // Target file preserved as Writer A's update
    const current = readDocument(file);
    assert.equal(current.revision, resA.revision);
    assert.equal(current.validation.ok, true);
    if (current.validation.ok) {
      assert.equal(current.validation.value.profile.name, 'Writer A Update');
    }
  });
});

test('locks: external uncooperative edit causes revision conflict on next apply', async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, 'resume.json');
    const { revision: initialRev } = initDocument({ filePath: file });

    // External editor directly overwrites file
    const docExternal = createBlankResume('classic', 1);
    docExternal.profile.name = 'External Editor Direct Edit';
    writeFileSync(file, JSON.stringify(docExternal, null, 2) + '\n');

    // Agent tries to apply candidate with initialRev
    const candidateDoc = createBlankResume('classic', 1);
    candidateDoc.profile.name = 'Agent Edit';
    const candidateContent = JSON.stringify(candidateDoc, null, 2) + '\n';

    await assert.rejects(
      async () =>
        applyDocumentTransaction({
          targetPath: file,
          candidateContent,
          expectedRevision: initialRev,
        }),
      (err: unknown) => err instanceof DocumentConflictError
    );
  });
});
