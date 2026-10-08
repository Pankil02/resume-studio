import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../../src/cli/main.js';
import { createBlankResume } from '../../src/core/defaults.js';

function withTempDir(fn: (dir: string) => Promise<void> | void): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'resume-cmd-test-'));
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

// Helper to capture stdout and stderr during runCli
async function captureRunCli(argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = ((chunk: unknown) => {
    stdout += String(chunk);
    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: unknown) => {
    stderr += String(chunk);
    return true;
  }) as typeof process.stderr.write;

  try {
    const code = await runCli(argv);
    return { code, stdout, stderr };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

test('cli: help and version exit 0 with clean text', async () => {
  const helpRes = await captureRunCli(['--help']);
  assert.equal(helpRes.code, 0);
  assert.match(helpRes.stdout, /Resume Studio CLI/);

  const verRes = await captureRunCli(['--version']);
  assert.equal(verRes.code, 0);
  assert.match(verRes.stdout, /^0\.1\.0\n/);
});

test('cli: templates and guidance output JSON envelopes', async () => {
  const tmplRes = await captureRunCli(['templates', '--json']);
  assert.equal(tmplRes.code, 0);
  const tmplData = JSON.parse(tmplRes.stdout);
  assert.equal(Array.isArray(tmplData.templates), true);
  assert.equal(tmplData.templates.length, 2);

  const guideRes = await captureRunCli(['guidance', '--json']);
  assert.equal(guideRes.code, 0);
  const guideData = JSON.parse(guideRes.stdout);
  assert.equal(typeof guideData.bounds.maxInputBytes, 'number');
  assert.equal(typeof guideData.guidance.summary.recommendedMaxChars, 'number');
});

test('cli: init, inspect, validate, and apply workflow end-to-end', async () => {
  await withTempDir(async (dir) => {
    const resumePath = join(dir, 'my-resume.json');
    const candidatePath = join(dir, 'candidate.json');

    // 1. init
    const initRes = await captureRunCli(['init', '--file', resumePath, '--template', 'classic', '--json']);
    assert.equal(initRes.code, 0);
    const initJson = JSON.parse(initRes.stdout);
    assert.equal(initJson.ok, true);
    assert.equal(typeof initJson.revision, 'string');
    const r0 = initJson.revision;

    // 2. inspect
    const inspRes = await captureRunCli(['inspect', '--file', resumePath, '--json']);
    assert.equal(inspRes.code, 0);
    const inspJson = JSON.parse(inspRes.stdout);
    assert.equal(inspJson.revision, r0);
    assert.equal(inspJson.document.document.template, 'classic');

    // 3. validate valid file
    const valRes = await captureRunCli(['validate', '--file', resumePath, '--json']);
    assert.equal(valRes.code, 0);
    const valJson = JSON.parse(valRes.stdout);
    assert.equal(valJson.ok, true);
    assert.equal(valJson.revision, r0);

    // 4. prepare candidate file
    const candidateDoc = createBlankResume('classic', 1);
    candidateDoc.profile.name = 'Updated by CLI Apply';
    writeFileSync(candidatePath, JSON.stringify(candidateDoc, null, 2) + '\n');

    // 5. apply with matching revision
    const applyRes = await captureRunCli([
      'apply',
      '--file',
      resumePath,
      '--from',
      candidatePath,
      '--expected-revision',
      r0,
      '--json',
    ]);
    assert.equal(applyRes.code, 0);
    const applyJson = JSON.parse(applyRes.stdout);
    assert.equal(applyJson.ok, true);
    assert.notEqual(applyJson.revision, r0);
    const r1 = applyJson.revision;

    // 6. apply with now-stale revision r0 -> must exit 3 (conflict)
    const staleRes = await captureRunCli([
      'apply',
      '--file',
      resumePath,
      '--from',
      candidatePath,
      '--expected-revision',
      r0,
      '--json',
    ]);
    assert.equal(staleRes.code, 3);
    const staleJson = JSON.parse(staleRes.stdout);
    assert.equal(staleJson.ok, false);
    assert.equal(staleJson.conflict, true);

    // 7. validate invalid file -> exits 2
    const invalidPath = join(dir, 'invalid.json');
    writeFileSync(invalidPath, '{"schemaVersion": 999}\n');
    const invValRes = await captureRunCli(['validate', '--file', invalidPath, '--json']);
    assert.equal(invValRes.code, 2);
    const invValJson = JSON.parse(invValRes.stdout);
    assert.equal(invValJson.ok, false);
    assert.equal(invValJson.issues.length > 0, true);
  });
});

test('cli: usage errors exit with code 1', async () => {
  const res1 = await captureRunCli(['unknown-command']);
  assert.equal(res1.code, 1);
  assert.match(res1.stderr, /Error:/);

  const res2 = await captureRunCli(['init']);
  assert.equal(res2.code, 1);
  assert.match(res2.stderr, /Missing required option: --file/);
});
