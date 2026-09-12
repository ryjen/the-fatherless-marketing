#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CANONICAL_ORIGIN = "https://eoa.ryanjennin.gs";
const RETIRED_ORIGIN = "https://fatherless.ryanjennin.gs";
const TEXT_SUFFIXES = new Set([".html", ".xml", ".md", ".txt", ".json", ".yml", ".yaml"]);

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function fail(errors, message) {
  errors.push(message);
}

function htmlMetadata(errors, file, source) {
  const canonical = source.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] ?? null;
  if (canonical && !canonical.startsWith(`${CANONICAL_ORIGIN}/`)) {
    fail(errors, `${relative(file)}: canonical URL must use ${CANONICAL_ORIGIN}`);
  }

  const ogUrl = source.match(/<meta\s+property="og:url"\s+content="([^"]+)"/i)?.[1] ?? null;
  if (canonical && ogUrl && canonical !== ogUrl) {
    fail(errors, `${relative(file)}: og:url must match canonical URL`);
  }
}

const errors = [];
for (const file of walkFiles(path.join(ROOT, "src"))) {
  if (!TEXT_SUFFIXES.has(path.extname(file).toLowerCase())) continue;
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(RETIRED_ORIGIN)) fail(errors, `${relative(file)}: retired public origin detected`);
  if (file.endsWith(".html")) htmlMetadata(errors, file, source);
}

const deployment = path.join(ROOT, "docs", "deployment.md");
if (fs.existsSync(deployment) && fs.readFileSync(deployment, "utf8").includes(RETIRED_ORIGIN)) {
  fail(errors, "docs/deployment.md: retired deployment origin detected");
}

const expectedCanonicals = new Map([
  ["src/books/age-of-embers/index.html", `${CANONICAL_ORIGIN}/books/age-of-embers/`],
  ["src/books/the-fatherless/index.html", `${CANONICAL_ORIGIN}/books/the-fatherless/`],
  ["src/books/neurion/index.html", `${CANONICAL_ORIGIN}/books/neurion/`],
  ["src/books/age-of-forms/index.html", `${CANONICAL_ORIGIN}/books/age-of-forms/`],
  ["src/books/prequel/index.html", `${CANONICAL_ORIGIN}/books/age-of-embers/`],
  ["src/books/sequel/index.html", `${CANONICAL_ORIGIN}/books/neurion/`],
]);

for (const [file, expected] of expectedCanonicals) {
  const absolute = path.join(ROOT, ...file.split("/"));
  if (!fs.existsSync(absolute)) {
    fail(errors, `${file}: expected public book page is missing`);
    continue;
  }
  const source = fs.readFileSync(absolute, "utf8");
  const canonical = source.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] ?? null;
  if (canonical !== expected) fail(errors, `${file}: expected canonical ${expected}, found ${canonical ?? "<missing>"}`);
}

const sitemapPath = path.join(ROOT, "src", "sitemap.xml");
if (fs.existsSync(sitemapPath)) {
  const sitemap = fs.readFileSync(sitemapPath, "utf8");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  for (const url of urls) {
    if (!url.startsWith(`${CANONICAL_ORIGIN}/`)) fail(errors, `src/sitemap.xml: non-canonical origin ${url}`);
    if (/\/books\/(?:prequel|original|sequel)\//.test(url)) fail(errors, `src/sitemap.xml: legacy book route must not be canonical: ${url}`);
  }
}

if (errors.length) {
  console.error(`Canonical-origin validation failed with ${errors.length} issue(s):`);
  for (const error of [...new Set(errors)].sort()) console.error(`  - ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Canonical-origin validation passed: ${CANONICAL_ORIGIN}`);
}
