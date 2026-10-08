import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseResume, validateResume } from '../../src/core/validation.js';

function loadJson(relPath: string): string {
  return readFileSync(resolve(relPath), 'utf-8');
}

test('schema: classic one-page example passes validation', () => {
  const json = loadJson('examples/classic-one-page.json');
  const result = parseResume(json);
  assert.equal(result.ok, true, `Validation failed: ${JSON.stringify(result.issues)}`);
  if (result.ok) {
    assert.equal(result.value.document.template, 'classic');
    assert.equal(result.value.document.maxPages, 1);
  }
});

test('schema: two-page example 1 passes validation', () => {
  const json = loadJson('examples/modern-two-page.json');
  const result = parseResume(json);
  assert.equal(result.ok, true, `Validation failed: ${JSON.stringify(result.issues)}`);
  if (result.ok) {
    assert.equal(result.value.document.template, 'classic');
    assert.equal(result.value.document.maxPages, 2);
  }
});

test('schema: two-page example 2 passes validation', () => {
  const json = loadJson('examples/executive-two-page.json');
  const result = parseResume(json);
  assert.equal(result.ok, true, `Validation failed: ${JSON.stringify(result.issues)}`);
  if (result.ok) {
    assert.equal(result.value.document.template, 'classic');
    assert.equal(result.value.document.maxPages, 2);
  }
});

test('schema: valid minimal document passes validation', () => {
  const json = loadJson('tests/fixtures/valid-minimal.json');
  const result = parseResume(json);
  assert.equal(result.ok, true, `Validation failed: ${JSON.stringify(result.issues)}`);
});

test('security: 128 KiB boundary check rejects oversized input', () => {
  const validJson = loadJson('tests/fixtures/valid-minimal.json');
  // Pad with harmless whitespace up to 131,073 bytes (> 128 KiB)
  const padding = ' '.repeat(131073 - validJson.length + 10);
  const oversized = validJson + padding;
  const result = parseResume(oversized);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'INPUT_TOO_LARGE'));
});

test('security: invalid JSON syntax fails cleanly', () => {
  const result = parseResume('{ invalid json: true, ');
  assert.equal(result.ok, false);
  assert.equal(result.issues[0]?.code, 'INVALID_JSON');
});

test('security: prototype pollution key in JSON fails safely', () => {
  const payload = '{"schemaVersion":1,"__proto__":{"polluted":true}}';
  const result = parseResume(payload);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'FORBIDDEN_PROPERTY'));
});

test('schema: rejects unknown properties at root and nested levels', () => {
  const json = loadJson('tests/fixtures/invalid-unknown-property.json');
  const result = parseResume(json);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code.includes('ADDITIONALPROPERTIES')));
});

test('schema: rejects unknown schema version', () => {
  const json = loadJson('tests/fixtures/invalid-unknown-version.json');
  const result = parseResume(json);
  assert.equal(result.ok, false);
});

test('semantics: rejects duplicate item IDs across document', () => {
  const json = loadJson('tests/fixtures/invalid-duplicate-ids.json');
  const result = parseResume(json);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'DUPLICATE_ID'));
});

test('semantics: rejects invalid section order membership', () => {
  const json = loadJson('tests/fixtures/invalid-section-order.json');
  const result = parseResume(json);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code.includes('SECTION') || i.code.includes('UNIQUEITEMS')));
});

test('semantics: rejects current role that contains end date', () => {
  const json = loadJson('tests/fixtures/invalid-dates-current-with-end.json');
  const result = parseResume(json);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'CURRENT_ROLE_HAS_END_DATE'));
});

test('semantics: rejects non-current role missing end date', () => {
  const json = loadJson('tests/fixtures/invalid-dates-non-current-missing-end.json');
  const result = parseResume(json);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'NON_CURRENT_ROLE_MISSING_END_DATE'));
});

test('semantics: rejects chronological date inversion (start > end)', () => {
  const json = loadJson('tests/fixtures/invalid-dates-inverted.json');
  const result = parseResume(json);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'INVALID_DATE_RANGE'));
});

test('security: rejects unsafe URL protocols (javascript, file, data)', () => {
  const json = loadJson('tests/fixtures/invalid-bad-url-protocol.json');
  const result = parseResume(json);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'UNSAFE_URL_PROTOCOL'));
});

test('security: rejects embedded credentials in URLs', () => {
  const json = loadJson('tests/fixtures/invalid-url-credentials.json');
  const result = parseResume(json);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'URL_CREDENTIALS_FORBIDDEN'));
});

test('semantics: rejects whitespace-only string values', () => {
  const json = loadJson('tests/fixtures/invalid-whitespace-only.json');
  const result = parseResume(json);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'WHITESPACE_ONLY'));
});

test('security: rejects NUL and unsafe control characters', () => {
  const base = JSON.parse(loadJson('tests/fixtures/valid-minimal.json'));
  base.profile.name = 'John\0Doe';
  const result = validateResume(base);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'NUL_CHARACTER_FORBIDDEN'));
});

test('privacy: errors never echo raw input PII values', () => {
  const base = JSON.parse(loadJson('tests/fixtures/valid-minimal.json'));
  const privateName = 'SecretCandidateNameThatMustNotBeLeaked';
  base.profile.name = `${privateName}\0`; // triggers NUL error
  const result = validateResume(base);
  assert.equal(result.ok, false);
  const errorOutput = JSON.stringify(result.issues);
  assert.equal(errorOutput.includes(privateName), false);
});

test('security: allows safe image data URL in experience icon', () => {
  const base = JSON.parse(loadJson('tests/fixtures/valid-minimal.json'));
  base.experience = [
    {
      id: 'exp-1',
      employer: 'Bakery Co',
      role: 'Head Baker',
      start: '2022-01',
      current: true,
      icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      bullets: ['Baked artisan breads daily according to high standards.'],
    },
  ];
  const result = validateResume(base);
  assert.equal(result.ok, true);
});

test('security: rejects unsafe protocol or script in experience icon', () => {
  const base = JSON.parse(loadJson('tests/fixtures/valid-minimal.json'));
  base.experience = [
    {
      id: 'exp-1',
      employer: 'Bakery Co',
      role: 'Head Baker',
      start: '2022-01',
      current: true,
      icon: 'javascript:alert(1)',
      bullets: ['Baked artisan breads daily according to high standards.'],
    },
  ];
  const result = validateResume(base);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'UNSAFE_IMAGE_PROTOCOL'));
});

test('security: rejects non-image mime type in experience icon data URL', () => {
  const base = JSON.parse(loadJson('tests/fixtures/valid-minimal.json'));
  base.experience = [
    {
      id: 'exp-1',
      employer: 'Bakery Co',
      role: 'Head Baker',
      start: '2022-01',
      current: true,
      icon: 'data:text/html;<script>alert(1)</script>',
      bullets: ['Baked artisan breads daily according to high standards.'],
    },
  ];
  const result = validateResume(base);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'UNSAFE_IMAGE_PROTOCOL' || i.code === 'UNSAFE_IMAGE_MIME' || i.code === 'UNSAFE_IMAGE_CONTENT'));
});

test('schema: accepts valid paperSize options (a4, letter)', () => {
  const base = JSON.parse(loadJson('tests/fixtures/valid-minimal.json'));
  base.document.paperSize = 'letter';
  const resultLetter = validateResume(base);
  assert.equal(resultLetter.ok, true);

  base.document.paperSize = 'a4';
  const resultA4 = validateResume(base);
  assert.equal(resultA4.ok, true);
});

test('schema: rejects invalid paperSize value', () => {
  const base = JSON.parse(loadJson('tests/fixtures/valid-minimal.json'));
  base.document.paperSize = 'legal';
  const result = validateResume(base);
  assert.equal(result.ok, false);
});
