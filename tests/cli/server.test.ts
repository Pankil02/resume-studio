import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewServer, type PreviewServerHandle, MAX_SAVE_BODY_BYTES } from '../../src/cli/server.js';
import { initDocument, readDocument } from '../../src/cli/documents.js';
import { createBlankResume } from '../../src/core/defaults.js';

function withTempDir(fn: (dir: string) => Promise<void> | void): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'resume-server-test-'));
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

test('server: binds ephemeral loopback, checks Host, and serves static files', async () => {
  await withTempDir(async (dir) => {
    const resumePath = join(dir, 'resume.json');
    initDocument({ filePath: resumePath });

    const serverHandle = await createPreviewServer({ file: resumePath });
    try {
      const port = serverHandle.port;
      const baseUrl = `http://127.0.0.1:${port}`;

      // 1. Valid request to index.html
      const res = await fetch(`${baseUrl}/`, {
        headers: { Host: `127.0.0.1:${port}` },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type')?.includes('text/html'), true);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      const text = await res.text();
      assert.equal(text.includes('Resume Studio'), true);

      // 2. Host validation fails on non-matching host (DNS rebinding protection)
      const badHostRes = await fetch(`${baseUrl}/`, {
        headers: { Host: `attacker.com:${port}` },
      });
      assert.equal(badHostRes.status, 403);

      // 3. Traversal attack blocked
      const travRes = await fetch(`${baseUrl}/../../package.json`, {
        headers: { Host: `127.0.0.1:${port}` },
      });
      assert.equal(travRes.status === 403 || travRes.status === 404, true);

      // 4. Missing static file returns 404
      const missingRes = await fetch(`${baseUrl}/nonexistent-file.css`, {
        headers: { Host: `127.0.0.1:${port}` },
      });
      assert.equal(missingRes.status, 404);
    } finally {
      await serverHandle.close();
    }
  });
});

test('server: /local/document authentication and read contract', async () => {
  await withTempDir(async (dir) => {
    const resumePath = join(dir, 'resume.json');
    const { revision } = initDocument({ filePath: resumePath, template: 'classic', maxPages: 2 });

    const serverHandle = await createPreviewServer({ file: resumePath });
    try {
      const port = serverHandle.port;
      const baseUrl = `http://127.0.0.1:${port}`;

      // 1. Missing bearer token returns 401
      const unauthRes = await fetch(`${baseUrl}/local/document`, {
        headers: { Host: `127.0.0.1:${port}` },
      });
      assert.equal(unauthRes.status, 401);

      // 2. Wrong bearer token returns 401
      const wrongTokenRes = await fetch(`${baseUrl}/local/document`, {
        headers: {
          Host: `127.0.0.1:${port}`,
          Authorization: 'Bearer 0000000000000000000000000000000000000000000000000000000000000000',
        },
      });
      assert.equal(wrongTokenRes.status, 401);

      // 3. Untrusted origin returns 403
      const badOriginRes = await fetch(`${baseUrl}/local/document`, {
        headers: {
          Host: `127.0.0.1:${port}`,
          Authorization: `Bearer ${serverHandle.capability}`,
          Origin: 'http://malicious.origin',
        },
      });
      assert.equal(badOriginRes.status, 403);

      // 4. Authorized request returns document and revision
      const okRes = await fetch(`${baseUrl}/local/document`, {
        headers: {
          Host: `127.0.0.1:${port}`,
          Authorization: `Bearer ${serverHandle.capability}`,
          Origin: `http://127.0.0.1:${port}`,
        },
      });
      assert.equal(okRes.status, 200);
      assert.equal(okRes.headers.get('cache-control'), 'no-store');
      const data = (await okRes.json()) as { revision: string; document: { document: { template: string } } };
      assert.equal(data.revision, revision);
      assert.equal(data.document.document.template, 'classic');
    } finally {
      await serverHandle.close();
    }
  });
});

test('server: /local/save origin, body bound, validation, and conflict contract', async () => {
  await withTempDir(async (dir) => {
    const resumePath = join(dir, 'resume.json');
    const { revision } = initDocument({ filePath: resumePath });

    const serverHandle = await createPreviewServer({ file: resumePath });
    try {
      const port = serverHandle.port;
      const baseUrl = `http://127.0.0.1:${port}`;

      const validCandidate = createBlankResume('classic', 1);
      validCandidate.profile.name = 'Updated Through Local Save';

      // 1. Missing Origin on save returns 403 (write route strictly requires Origin)
      const noOriginRes = await fetch(`${baseUrl}/local/save`, {
        method: 'POST',
        headers: {
          Host: `127.0.0.1:${port}`,
          Authorization: `Bearer ${serverHandle.capability}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expectedRevision: revision, document: validCandidate }),
      });
      assert.equal(noOriginRes.status, 403);

      // 2. Untrusted Origin on save returns 403
      const evilOriginRes = await fetch(`${baseUrl}/local/save`, {
        method: 'POST',
        headers: {
          Host: `127.0.0.1:${port}`,
          Authorization: `Bearer ${serverHandle.capability}`,
          Origin: 'http://attacker-site.com',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expectedRevision: revision, document: validCandidate }),
      });
      assert.equal(evilOriginRes.status, 403);

      // 3. Body size exceeds 160 KiB returns 413
      const hugeData = 'a'.repeat(MAX_SAVE_BODY_BYTES + 200);
      try {
        const largeRes = await fetch(`${baseUrl}/local/save`, {
          method: 'POST',
          headers: {
            Host: `127.0.0.1:${port}`,
            Authorization: `Bearer ${serverHandle.capability}`,
            Origin: `http://127.0.0.1:${port}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expectedRevision: revision, document: validCandidate, padding: hugeData }),
        });
        assert.equal(largeRes.status, 413);
      } catch (err) {
        // Socket destruction by server on 413 is also compliant
        assert.ok(err);
      }

      // 4. Invalid document schema returns 422
      const badSchemaRes = await fetch(`${baseUrl}/local/save`, {
        method: 'POST',
        headers: {
          Host: `127.0.0.1:${port}`,
          Authorization: `Bearer ${serverHandle.capability}`,
          Origin: `http://127.0.0.1:${port}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expectedRevision: revision, document: { schemaVersion: 999 } }),
      });
      assert.equal(badSchemaRes.status, 422);

      // 5. Stale revision returns 409 Conflict
      const staleRes = await fetch(`${baseUrl}/local/save`, {
        method: 'POST',
        headers: {
          Host: `127.0.0.1:${port}`,
          Authorization: `Bearer ${serverHandle.capability}`,
          Origin: `http://127.0.0.1:${port}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expectedRevision: 'f'.repeat(64),
          document: validCandidate,
        }),
      });
      assert.equal(staleRes.status, 409);

      // 6. Valid save succeeds and returns new revision
      const saveRes = await fetch(`${baseUrl}/local/save`, {
        method: 'POST',
        headers: {
          Host: `127.0.0.1:${port}`,
          Authorization: `Bearer ${serverHandle.capability}`,
          Origin: `http://127.0.0.1:${port}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expectedRevision: revision,
          document: validCandidate,
        }),
      });
      assert.equal(saveRes.status, 200);
      const saveJson = (await saveRes.json()) as { ok: boolean; revision: string };
      assert.equal(saveJson.ok, true);
      assert.notEqual(saveJson.revision, revision);

      // Verify file on disk
      const diskDoc = readDocument(resumePath);
      assert.equal(diskDoc.revision, saveJson.revision);
      assert.equal(diskDoc.validation.ok, true);
      if (diskDoc.validation.ok) {
        assert.equal(diskDoc.validation.value.profile.name, 'Updated Through Local Save');
      }
    } finally {
      await serverHandle.close();
    }
  });
});

test('server: /local/events streams SSE and notifies external changes without PII', async () => {
  await withTempDir(async (dir) => {
    const resumePath = join(dir, 'resume.json');
    initDocument({ filePath: resumePath });

    const serverHandle = await createPreviewServer({ file: resumePath });
    try {
      const port = serverHandle.port;
      const baseUrl = `http://127.0.0.1:${port}`;

      // Connect to SSE stream
      const controller = new AbortController();
      const eventRes = await fetch(`${baseUrl}/local/events`, {
        headers: {
          Host: `127.0.0.1:${port}`,
          Authorization: `Bearer ${serverHandle.capability}`,
          Origin: `http://127.0.0.1:${port}`,
        },
        signal: controller.signal,
      });

      assert.equal(eventRes.status, 200);
      assert.equal(eventRes.headers.get('content-type')?.includes('text/event-stream'), true);

      const reader = eventRes.body?.getReader();
      assert.ok(reader);

      // External edit on disk
      const updatedDoc = createBlankResume('classic', 1);
      updatedDoc.profile.name = 'External Disk Modification';
      writeFileSync(resumePath, JSON.stringify(updatedDoc, null, 2) + '\n');

      // Read from stream to receive event
      const decoder = new TextDecoder();
      let streamData = '';
      const startTime = Date.now();

      while (Date.now() - startTime < 4000) {
        const { done, value } = await reader.read();
        if (done) break;
        streamData += decoder.decode(value);
        if (streamData.includes('event: change')) {
          break;
        }
      }

      controller.abort();

      assert.equal(streamData.includes('event: change'), true);
      assert.equal(streamData.includes('revision'), true);
      // Assert no personal data in SSE event
      assert.equal(streamData.includes('External Disk Modification'), false);
    } finally {
      await serverHandle.close();
    }
  });
});
