#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

function usage() {
  console.error('usage: node scripts/generate-responsive-media.mjs <input> <output-dir> <basename> [widths...]');
  process.exit(2);
}

const [, , input, outputDir, basename, ...widthArgs] = process.argv;
if (!input || !outputDir || !basename) usage();

const requested = (widthArgs.length ? widthArgs : ['480', '960', '1440'])
  .map(Number)
  .filter(width => Number.isInteger(width) && width > 0);
if (!requested.length) usage();

await fs.mkdir(outputDir, { recursive: true });
const image = sharp(input, { failOn: 'warning' }).rotate();
const metadata = await image.metadata();
if (!metadata.width || !metadata.height) throw new Error('source image dimensions unavailable');

const widths = [...new Set(requested.map(width => Math.min(width, metadata.width)))].sort((a, b) => a - b);
const outputs = [];
for (const width of widths) {
  for (const format of ['avif', 'webp']) {
    const filename = `${basename}.${width}w.${format}`;
    const target = path.join(outputDir, filename);
    let pipeline = sharp(input, { failOn: 'warning' }).rotate().resize({ width, withoutEnlargement: true });
    pipeline = format === 'avif' ? pipeline.avif({ quality: 58, effort: 5 }) : pipeline.webp({ quality: 76, effort: 5 });
    const info = await pipeline.toFile(target);
    outputs.push({ filename, width: info.width, height: info.height, format: info.format });
  }
}

process.stdout.write(`${JSON.stringify({ source: path.basename(input), outputs }, null, 2)}\n`);
