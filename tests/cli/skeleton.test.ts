import test from 'node:test';
import assert from 'node:assert/strict';

test('skeleton cli test: environment sanity', () => {
  assert.equal(typeof process.version, 'string');
});
