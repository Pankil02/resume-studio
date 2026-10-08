import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAiResumePrompt,
  validateResume,
  createFictionalStarter,
} from '../../src/core/index.js';

test('ai-prompt: generates comprehensive prompt with default options', () => {
  const prompt = buildAiResumePrompt();

  assert.ok(prompt.includes('TASK: Generate Resume Studio JSON (schemaVersion 1)'));
  assert.ok(prompt.includes('"maxPages": 1'));
  assert.ok(prompt.includes('"template": "classic"'));
  assert.ok(prompt.includes('^[a-z][a-z0-9-]{1,47}$'));
  assert.ok(prompt.includes('YYYY-MM'));
  assert.ok(prompt.includes('["summary", "experience", "education", "projects", "skills", "certifications"]'));
});

test('ai-prompt: embedded example JSON strictly passes Resume Studio validation', () => {
  const prompt = buildAiResumePrompt({ targetPages: 2, template: 'classic', accent: 'navy' });

  // Extract the example JSON codeblock from the prompt
  const match = prompt.match(/## JSON SCHEMA STRUCTURE EXAMPLE[\s\S]*?```json\n([\s\S]*?)\n```/);
  assert.ok(match && match[1], 'Prompt must contain JSON structure example codeblock');

  const rawJson = match[1];
  const parsed = JSON.parse(rawJson);
  const val = validateResume(parsed);

  assert.equal(val.ok, true, `Prompt example JSON failed schema validation: ${JSON.stringify(val.issues)}`);
  assert.equal(parsed.document.maxPages, 2);
  assert.equal(parsed.document.template, 'classic');
  assert.equal(parsed.document.accent, 'navy');
});

test('ai-prompt: includes target role specification when provided', () => {
  const prompt = buildAiResumePrompt({
    targetRoleOrJobDescription: 'Staff Site Reliability Engineer with Kubernetes and Terraform expertise',
  });

  assert.ok(prompt.includes('## TARGET ROLE / JOB SPECIFICATION FOCUS'));
  assert.ok(prompt.includes('Staff Site Reliability Engineer with Kubernetes and Terraform expertise'));
});

test('ai-prompt: embeds existing resume draft as reference when provided', () => {
  const existingDoc = createFictionalStarter('classic', 2);
  const prompt = buildAiResumePrompt({
    referenceResume: existingDoc,
  });

  assert.ok(prompt.includes('## EXISTING RESUME DRAFT (SOURCE OF TRUTH)'));
  assert.ok(prompt.includes(existingDoc.profile.name));
  const firstExp = existingDoc.experience[0];
  if (firstExp) {
    assert.ok(prompt.includes(firstExp.employer));
  }
});

