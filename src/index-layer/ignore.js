#!/usr/bin/env node
/**
 * engine/index-layer/ignore.js — minimal .gitignore matcher (stdlib only).
 * Soporta: comentarios, negación (!), anclaje (/..., o patrones con /),
 * patrones solo-directorio (trailing /), globs (*, ?, **).
 * Regla: el último patrón que matchea decide (git semantics).
 */
import fs from 'node:fs';
import path from 'node:path';

function globToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i++;
      } else {
        re += '[^/]*';
      }
    } else if (ch === '?') {
      re += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(ch)) {
      re += `\\${ch}`;
    } else {
      re += ch;
    }
  }
  return new RegExp(`^${re}$`);
}

export function parseGitignore(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const base = path.dirname(filePath);
  const rules = [];
  for (const line of raw.split(/\r?\n/)) {
    let pat = line.trim();
    if (!pat || pat.startsWith('#')) continue;
    let negate = false;
    if (pat.startsWith('!')) {
      negate = true;
      pat = pat.slice(1);
    }
    let dirOnly = false;
    if (pat.endsWith('/')) {
      dirOnly = true;
      pat = pat.slice(0, -1);
    }
    const anchored = pat.startsWith('/') || pat.includes('/');
    if (pat.startsWith('/')) pat = pat.slice(1);
    if (!pat) continue;
    const body = anchored ? globToRegExp(pat) : new RegExp(`(^|/)${globToRegExp(pat).source.replace(/^\^|\$$/g, '')}$`);
    rules.push({ negate, dirOnly, base, re: body });
  }
  return rules;
}

export function isIgnored(absPath, isDir, rules) {
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    const rel = path.relative(rule.base, absPath).split(path.sep).join('/');
    if (!rel || rel.startsWith('..')) continue;
    if (rule.re.test(rel)) ignored = !rule.negate;
  }
  return ignored;
}
