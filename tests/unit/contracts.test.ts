import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankResume,
  createFictionalStarter,
  validateResume,
  countWords,
  countCodePoints,
  getContentMetrics,
  getContentIssues,
  listTemplates,
  getTemplate,
} from '../../src/core/index.js';

test('defaults: createBlankResume produces strictly valid ResumeV1', () => {
  const blank = createBlankResume('classic', 1, 'slate');
  const res = validateResume(blank);
  assert.equal(res.ok, true, `Blank resume failed validation: ${JSON.stringify(res.issues)}`);
});

test('defaults: createFictionalStarter produces strictly valid ResumeV1 with templates', () => {
  for (const template of ['classic', 'executive'] as const) {
    const starter = createFictionalStarter(template, 2, 'navy');
    const res = validateResume(starter);
    assert.equal(res.ok, true, `Starter failed for ${template}: ${JSON.stringify(res.issues)}`);
  }
});

test('metrics: countWords counts whitespace-separated words accurately', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords('One two three'), 3);
  assert.equal(countWords('  Leading  and   trailing   spaces  '), 4);
});

test('metrics: countCodePoints correctly calculates Unicode code points over surrogates and emoji', () => {
  // '🚀' is 1 code point but 2 UTF-16 code units (\uD83D\uDE80)
  const emojiStr = 'Hello 🚀 World';
  assert.equal(countCodePoints(emojiStr), 13);
  assert.equal(emojiStr.length, 14); // UTF-16 code units
});

test('content: editorial warnings never invalidate structurally sound resume', () => {
  const resume = createFictionalStarter();
  // Make the headline very short to trigger a warning
  resume.profile.headline = 'Dev';
  const res = validateResume(resume);
  assert.equal(res.ok, true, 'Validation must remain ok: true when only warnings exist');
  assert.ok(res.issues.some((i) => i.code === 'GUIDANCE_HEADLINE_WORD_COUNT'));
  assert.ok(res.issues.every((i) => i.severity === 'warning'));
});

test('templates: template registry returns defined metadata and caveats', () => {
  const templates = listTemplates();
  assert.equal(templates.length, 2);

  const classic = getTemplate('classic');
  assert.equal(classic.id, 'classic');
  assert.equal(classic.columns, 1);
  assert.equal(classic.atsOptimized, true);

  const executive = getTemplate('executive');
  assert.equal(executive.id, 'executive');
  assert.equal(executive.columns, 2);
  assert.equal(executive.atsOptimized, false);
  assert.ok(executive.readingOrderCaveat);
});
