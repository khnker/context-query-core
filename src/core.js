import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { runCQP, runIntent, clearCache as globalClearCache } from './engine.js';

function scopedBase(repoRoot) {
  const hash = crypto.createHash('sha1').update(repoRoot).digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), 'context-query-core', hash);
}

export function createEngine(config = {}) {
  const repoRoot = path.resolve(config.repoRoot || config.root || process.cwd());
  const cacheDir = config.cacheDir ? path.resolve(config.cacheDir) : path.join(scopedBase(repoRoot), 'cache');
  const indexDir = config.indexDir ? path.resolve(config.indexDir) : path.join(scopedBase(repoRoot), 'index');
  const budget = config.budget || null;

  // No filesystem writes at construction time: creating an instance must not
  // modify the target repository or any other location.

  return {
    repoRoot,
    cacheDir,
    indexDir,
    budget,
    async query(queryText, opts = {}) {
      const mergedOpts = {
        ...opts,
        root: repoRoot,
        repoRoot,
        cacheDir,
        indexDir,
        budget: opts.budget || budget,
      };

      const trimmed = String(queryText ?? '').trim();
      const isCqp = /^(FIND|SEARCH|SELECT|LIST)\b/i.test(trimmed);

      if (isCqp) {
        return runCQP(trimmed, mergedOpts);
      }
      return runIntent(trimmed, mergedOpts);
    },
    clearCache() {
      globalClearCache();
    },
    dispose() {
      // stateless: nothing to release
    },
  };
}

export { runCQP, runIntent };
