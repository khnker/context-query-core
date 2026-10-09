import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseGitignore, isIgnored } from '../src/index-layer/ignore.js';

function rulesFor(dir, content) {
  const gi = path.join(dir, '.gitignore');
  fs.writeFileSync(gi, content);
  return parseGitignore(gi);
}

test('ignores a directory pattern at any depth', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-ignore-'));
  const rules = rulesFor(dir, 'generated/\n');
  assert.ok(isIgnored(path.join(dir, 'generated'), true, rules));
  assert.ok(!isIgnored(path.join(dir, 'src'), true, rules));
});

test('ignores extension globs but not unrelated files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-ignore-'));
  const rules = rulesFor(dir, '*.log\n');
  assert.ok(isIgnored(path.join(dir, 'a.log'), false, rules));
  assert.ok(!isIgnored(path.join(dir, 'a.js'), false, rules));
});

test('honors negation with last-match-wins', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-ignore-'));
  const rules = rulesFor(dir, '*.log\n!keep.log\n');
  assert.ok(isIgnored(path.join(dir, 'a.log'), false, rules));
  assert.ok(!isIgnored(path.join(dir, 'keep.log'), false, rules));
});

test('anchored root pattern only matches at the root', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-ignore-'));
  const rules = rulesFor(dir, '/build\n');
  assert.ok(isIgnored(path.join(dir, 'build'), true, rules));
  assert.ok(!isIgnored(path.join(dir, 'src', 'build'), true, rules));
});
