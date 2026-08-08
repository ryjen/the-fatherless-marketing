import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fatherless-media-'));
try {
  const result = spawnSync(process.execPath, [
    path.join(root, 'scripts/generate-responsive-media.mjs'),
    path.join(root, 'tests/fixtures/responsive-source.svg'),
    tmp,
    'fixture',
    '480',
    '960',
    '1440',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const files = (await fs.readdir(tmp)).sort();
  assert.deepEqual(files, [
    'fixture.1200w.avif',
    'fixture.1200w.webp',
    'fixture.480w.avif',
    'fixture.480w.webp',
    'fixture.960w.avif',
    'fixture.960w.webp',
  ]);

  for (const file of files) {
    const metadata = await sharp(path.join(tmp, file)).metadata();
    assert.ok(metadata.width && metadata.width <= 1200);
    assert.ok(metadata.height && metadata.height <= 800);
    if (file.endsWith('.avif')) assert.equal(metadata.format, 'heif');
    if (file.endsWith('.webp')) assert.equal(metadata.format, 'webp');
  }
  console.log('Responsive media generation passed.');
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
