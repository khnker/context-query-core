import test from 'node:test';
import assert from 'node:assert';
import { createEngine } from '../index.js';

test('createEngine initializes with repoRoot and runs query without throwing', async () => {
  const engine = createEngine({ repoRoot: process.cwd() });
  assert.strictEqual(typeof engine.query, 'function');
  assert.strictEqual(typeof engine.clearCache, 'function');
  assert.strictEqual(typeof engine.dispose, 'function');

  // Test a simple intent query or CQP
  const res = await engine.query('FIND definitions OF symbol createEngine');
  assert.ok(res);
  assert.ok(Array.isArray(res.results) || res.plan);
});
