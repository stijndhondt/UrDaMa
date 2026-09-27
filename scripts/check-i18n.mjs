// Checks the translations (Slice 1 spec: everything visible exists in English and Dutch):
// both files have the same keys, and every literal translation key in the code exists.
// Keys built at run time ('tools.' + name) are checked by their fixed prefix.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const flat = (tree, prefix = '') =>
  Object.entries(tree).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null ? flat(v, key) : [key];
  });

const read = (lang) =>
  new Set(flat(JSON.parse(readFileSync(`projects/web/public/i18n/${lang}.json`, 'utf8'))));
const en = read('en');
const nl = read('nl');
const problems = [];
for (const k of en) if (!nl.has(k)) problems.push(`missing in nl.json: ${k}`);
for (const k of nl) if (!en.has(k)) problems.push(`missing in en.json: ${k}`);

const PREFIXES = [
  'app',
  'tools',
  'editor',
  'panel',
  'commands',
  'invariants',
  'warnings',
  'quantities',
  'levels',
  'view3d',
  'project',
  'history',
  'file',
  'common',
  'rooms',
  'areas',
  'changes',
  'contextMenu',
];
const literal = new RegExp(`['\`]((?:${PREFIXES.join('|')})\\.[A-Za-z0-9_.]+)['\`]`, 'g');
const sources = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
for (const file of sources('projects')) {
  for (const [, key] of readFileSync(file, 'utf8').matchAll(literal)) {
    const dynamic = key.endsWith('.');
    const known = dynamic ? [...en].some((k) => k.startsWith(key)) : en.has(key);
    if (!known) problems.push(`unknown key ${key} in ${file}`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`i18n: ${en.size} keys in English and Dutch, every key used in the code exists`);
