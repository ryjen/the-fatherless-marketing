#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbidden = /\bRome\b|\bRomans?\b/gi;
const suffixes = new Set(['.html', '.md', '.txt', '.json', '.yml', '.yaml', '.xml']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && suffixes.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

const files = [
  ...walk(path.join(root, 'src')),
  ...walk(path.join(root, 'docs')),
  ...['README.md', 'RIGHTS.md', 'CONTRIBUTING.md', 'public-manifest.json']
    .map(file => path.join(root, file))
    .filter(fs.existsSync),
];

const failures = [];
for (const file of [...new Set(files)].sort()) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    forbidden.lastIndex = 0;
    for (const match of line.matchAll(forbidden)) {
      failures.push(`${path.relative(root, file)}:${index + 1}: forbidden public term ${match[0]}`);
    }
  });
}

if (failures.length) {
  console.error('Public setting-language validation failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('Use Aurelia, Aurelian, the Republic, the Senate, or a generic civic description instead.');
  process.exit(1);
}

console.log('Public setting-language validation passed: historical inspiration remains implicit.');
