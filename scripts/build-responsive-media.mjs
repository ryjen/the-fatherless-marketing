#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifest = JSON.parse(await fs.readFile(path.join(root, "public-manifest.json"), "utf8"));

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

let count = 0;
for (const artifact of manifest.artifacts ?? []) {
  const derivatives = artifact.responsive_derivatives;
  if (!Array.isArray(derivatives) || derivatives.length === 0) continue;

  const input = path.join(root, artifact.path);
  for (const derivative of derivatives) {
    const output = path.join(root, "dist", derivative.path);
    await fs.mkdir(path.dirname(output), { recursive: true });

    let pipeline = sharp(input, { failOn: "warning" })
      .rotate()
      .resize({ width: derivative.width, withoutEnlargement: true });

    if (derivative.format === "avif") {
      pipeline = pipeline.avif({ quality: 58, effort: 5 });
    } else if (derivative.format === "webp") {
      pipeline = pipeline.webp({ quality: 76, effort: 5 });
    } else {
      throw new Error(`unsupported responsive derivative format: ${derivative.format}`);
    }

    const info = await pipeline.toFile(output);
    if (info.width !== derivative.width || info.height !== derivative.height) {
      throw new Error(`unexpected responsive dimensions for ${derivative.path}: ${info.width}x${info.height}`);
    }

    const bytes = await fs.readFile(output);
    const actual = sha256(bytes);
    if (actual !== derivative.checksum_sha256) {
      throw new Error(`responsive derivative checksum mismatch for ${derivative.path}: ${actual}`);
    }
    count += 1;
  }
}

console.log(`Built and verified ${count} responsive media derivative(s).`);
