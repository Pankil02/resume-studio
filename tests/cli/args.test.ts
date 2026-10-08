import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, CliUsageError } from '../../src/cli/args.js';

test('args: help and version flags', () => {
  assert.deepEqual(parseArgs(['-h']), { kind: 'help' });
  assert.deepEqual(parseArgs(['--help']), { kind: 'help' });
  assert.deepEqual(parseArgs([]), { kind: 'help' });
  assert.deepEqual(parseArgs(['-v']), { kind: 'version' });
  assert.deepEqual(parseArgs(['--version']), { kind: 'version' });
});

test('args: init command parsing & validation', () => {
  const cmd1 = parseArgs(['init', '--file', 'resume.json']);
  assert.equal(cmd1.kind, 'init');
  if (cmd1.kind === 'init') {
    assert.equal(cmd1.file, 'resume.json');
    assert.equal(cmd1.template, 'classic');
    assert.equal(cmd1.maxPages, 1);
    assert.equal(cmd1.json, false);
  }

  const cmd2 = parseArgs(['init', '--file', 'resume.json', '--template', 'classic', '--max-pages', '2', '--json']);
  if (cmd2.kind === 'init') {
    assert.equal(cmd2.template, 'classic');
    assert.equal(cmd2.maxPages, 2);
    assert.equal(cmd2.json, true);
  }

  assert.throws(() => parseArgs(['init']), /Missing required option: --file/);
  assert.throws(() => parseArgs(['init', '--file', 'x', '--template', 'unknown']), /Invalid template/);
  assert.throws(() => parseArgs(['init', '--file', 'x', '--template', 'modern']), /Invalid template/);
  assert.throws(() => parseArgs(['init', '--file', 'x', '--max-pages', '3']), /Invalid --max-pages/);
});

test('args: inspect command parsing & validation', () => {
  const cmd = parseArgs(['inspect', '--file', 'test.json', '--json']);
  assert.equal(cmd.kind, 'inspect');
  if (cmd.kind === 'inspect') {
    assert.equal(cmd.file, 'test.json');
    assert.equal(cmd.json, true);
  }
  assert.throws(() => parseArgs(['inspect']), /Missing required option: --file/);
});

test('args: validate command parsing & validation', () => {
  const cmd = parseArgs(['validate', '--file', 'test.json']);
  assert.equal(cmd.kind, 'validate');
  if (cmd.kind === 'validate') {
    assert.equal(cmd.file, 'test.json');
    assert.equal(cmd.json, false);
  }
  assert.throws(() => parseArgs(['validate']), /Missing required option: --file/);
});

test('args: apply command parsing & validation', () => {
  const validHash = 'a'.repeat(64);
  const cmd = parseArgs([
    'apply',
    '--file',
    'my-resume.json',
    '--from',
    'candidate.json',
    '--expected-revision',
    validHash,
    '--json',
  ]);
  assert.equal(cmd.kind, 'apply');
  if (cmd.kind === 'apply') {
    assert.equal(cmd.file, 'my-resume.json');
    assert.equal(cmd.from, 'candidate.json');
    assert.equal(cmd.expectedRevision, validHash);
    assert.equal(cmd.json, true);
  }

  assert.throws(
    () => parseArgs(['apply', '--file', 'x', '--from', 'y']),
    /Missing required option: --expected-revision/
  );
  assert.throws(
    () => parseArgs(['apply', '--file', 'x', '--expected-revision', validHash]),
    /Missing required option: --from/
  );
  assert.throws(
    () => parseArgs(['apply', '--file', 'x', '--from', 'y', '--expected-revision', 'invalid-hash']),
    /Invalid --expected-revision/
  );
});

test('args: preview command parsing & validation', () => {
  const cmd = parseArgs(['preview', '--file', 'my-resume.json', '--port', '8080', '--open']);
  assert.equal(cmd.kind, 'preview');
  if (cmd.kind === 'preview') {
    assert.equal(cmd.file, 'my-resume.json');
    assert.equal(cmd.port, 8080);
    assert.equal(cmd.open, true);
  }

  assert.throws(() => parseArgs(['preview']), /Missing required option: --file/);
  assert.throws(() => parseArgs(['preview', '--file', 'x', '--port', '99999']), /Invalid --port/);
});

test('args: templates and guidance commands', () => {
  assert.equal(parseArgs(['templates', '--json']).kind, 'templates');
  assert.equal(parseArgs(['guidance']).kind, 'guidance');
});

test('args: rejects unknown commands and unexpected flags', () => {
  assert.throws(() => parseArgs(['foo']), /Unrecognized command: 'foo'/);
  assert.throws(() => parseArgs(['init', '--file', 'x', '--unexpected']), /Unrecognized option: --unexpected/);
  assert.throws(() => parseArgs(['init', '--file', 'a', '--file', 'b']), /Conflicting duplicate option: --file/);
  assert.throws(() => parseArgs(['init', '--file', 'a', 'extra-arg']), /Unexpected positional argument/);
});
