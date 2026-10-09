import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { catalogPathFor, buildIndex } from '../src/index-layer/index.js';

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-repo-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'config.js'), 'export function parseConfig() {}\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'generated/\n');
  fs.mkdirSync(path.join(dir, 'generated'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'generated', 'bundle.js'), 'parseConfig generated\n');
  return dir;
}

test('catalog lives outside the target repository', () => {
  const dir = makeRepo();
  const dbPath = catalogPathFor(dir);
  assert.ok(!dbPath.startsWith(dir), `catalog must not be inside repo: ${dbPath}`);
});

test('CQE_CATALOG_DB overrides the catalog location', () => {
  const prev = process.env.CQE_CATALOG_DB;
  process.env.CQE_CATALOG_DB = '/tmp/cqe-explicit-catalog.db';
  try {
    assert.strictEqual(catalogPathFor('/some/repo'), '/tmp/cqe-explicit-catalog.db');
  } finally {
    if (prev === undefined) delete process.env.CQE_CATALOG_DB;
    else process.env.CQE_CATALOG_DB = prev;
  }
});

test('buildIndex writes no artifacts into the target repository', () => {
  const dir = makeRepo();
  buildIndex(dir);
  assert.ok(!fs.existsSync(path.join(dir, '.cqe')), '.cqe must not be created in the repo');
  const tracked = fs.readdirSync(dir).sort();
  assert.deepStrictEqual(tracked, ['generated', 'src', '.gitignore'].sort());
});
