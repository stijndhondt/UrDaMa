// Runs `ng test` once for every project in angular.json that has at least one spec file.
// (The Angular unit-test builder refuses projects without tests, so empty libraries are skipped.)
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const workspace = JSON.parse(readFileSync('angular.json', 'utf8'));
const ng = join('node_modules', '@angular', 'cli', 'bin', 'ng.js');

const hasSpec = (dir) =>
  readdirSync(dir).some((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? hasSpec(path) : name.endsWith('.spec.ts');
  });

const i18n = spawnSync(process.execPath, [join('scripts', 'check-i18n.mjs')], { stdio: 'inherit' });
if (i18n.status !== 0) process.exit(i18n.status ?? 1);

for (const [name, project] of Object.entries(workspace.projects)) {
  if (!hasSpec(project.root)) {
    console.log(`- ${name}: no tests yet, skipped`);
    continue;
  }
  const run = spawnSync(process.execPath, [ng, 'test', name, '--watch=false'], {
    stdio: 'inherit',
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
