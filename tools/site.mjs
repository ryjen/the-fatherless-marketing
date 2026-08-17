#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const CONTENT_TYPES = new Set([
  'page', 'book-summary', 'character-profile', 'world-note', 'great-age-note',
  'excerpt', 'quotation', 'news', 'faq', 'press', 'press-asset', 'site-asset',
]);
const DEPLOYABLE_STATES = new Set(['placeholder', 'approved', 'published']);
const ALLOWED_TIERS = new Set(['placeholder', 'premise', 'early-context', 'approved-excerpt']);
const ALLOWED_STATES = new Set(['placeholder', 'candidate', 'approved', 'published', 'withdrawn', 'superseded']);
const ALLOWED_REPLACEMENT = new Set(['current', 'withdrawn', 'superseded']);
const FILE_ASSET_TYPES = new Set(['press-asset', 'site-asset']);
const MEDIA_SUFFIXES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg', '.pdf']);
const TEXT_SUFFIXES = new Set(['.html', '.md', '.txt']);
const PUBLIC_TEXT_SUFFIXES = new Set(['.html', '.md', '.txt', '.json', '.yml', '.yaml', '.css', '.js', '.xml', '.svg']);
const CREATOR_CLASSES = new Set(['author-created', 'commissioned', 'generated', 'stock', 'public-domain', 'historical', 'contributor-owned']);
const METADATA_REVIEWS = new Set(['stripped', 'reviewed-retained']);
const FORBIDDEN_REPO_HASHES = new Set(['b2039a6916963fafa6c5f93fc6f90cfdbb2aa9fbb3cc7c2792f97a9661a23d6b']);
const SECRET_PATTERNS = [
  /BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
];
const DRAFT_PATTERN = /\b(?:TODO|FIXME|DRAFT|INTERNAL ONLY|DO NOT PUBLISH)\b/i;
const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

export class SiteError extends Error {}

function fail(message) {
  throw new SiteError(message);
}

function readJson(root, relative) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  } catch (error) {
    fail(`invalid ${relative}: ${error.message}`);
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function nonempty(value, field, artifactId) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string: ${artifactId}`);
  return value.trim();
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function containsForbiddenRepo(text) {
  const regex = /(?=([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+))/gi;
  for (const match of text.matchAll(regex)) {
    if (FORBIDDEN_REPO_HASHES.has(sha256(Buffer.from(match[1].toLowerCase())))) return true;
  }
  return false;
}

function normalizedRepoPath(raw) {
  if (typeof raw !== 'string' || !raw || raw.includes('\\') || path.posix.isAbsolute(raw)) {
    fail(`manifest path must be normalized and repository-relative: ${raw}`);
  }
  const normalized = path.posix.normalize(raw);
  const parts = raw.split('/');
  if (normalized !== raw || parts.some(part => !part || part === '.' || part === '..')) {
    fail(`manifest path must be normalized and repository-relative: ${raw}`);
  }
  if (!['src', 'staging'].includes(parts[0])) fail(`manifest path must live under src/ or staging/: ${raw}`);
  return raw;
}

function validateCanonical(value, artifactId, contentType) {
  const canonical = nonempty(value, 'canonical_url', artifactId);
  if (!canonical.startsWith('/')) fail(`canonical_url must be root-relative: ${artifactId}`);
  if (canonical.includes('?') || canonical.includes('#') || canonical.slice(1).includes('//')) {
    fail(`canonical_url must not contain query, fragment, or duplicate separators: ${artifactId}`);
  }
  if (canonical.split('/').some(part => part === '.' || part === '..')) {
    fail(`canonical_url must not contain traversal segments: ${artifactId}`);
  }
  if (FILE_ASSET_TYPES.has(contentType)) {
    if (!/^\/[a-z0-9._~/-]+$/.test(canonical)) fail(`asset canonical_url must use lowercase safe characters: ${artifactId}`);
    if (canonical.endsWith('/')) fail(`asset canonical_url must identify a file: ${artifactId}`);
  } else if (!/^\/(?:[a-z0-9-]+\/)*$/.test(canonical)) {
    fail(`reader canonical_url must be lowercase, hyphenated, extensionless, and end with '/': ${artifactId}`);
  }
  return canonical;
}

function mediaMetadataMarkers(file) {
  const data = fs.readFileSync(file);
  const suffix = path.extname(file).toLowerCase();
  const markers = new Set();
  const includes = value => data.includes(Buffer.from(value));
  if ((suffix === '.jpg' || suffix === '.jpeg') && includes('Exif\0\0')) markers.add('EXIF');
  else if (suffix === '.png') {
    for (const marker of ['tEXt', 'zTXt', 'iTXt', 'eXIf']) if (includes(marker)) markers.add(marker);
  } else if (suffix === '.webp') {
    if (includes('EXIF')) markers.add('EXIF');
    if (includes('XMP ')) markers.add('XMP');
  } else if (suffix === '.avif') {
    const lowered = data.toString('latin1').toLowerCase();
    if (lowered.includes('exif')) markers.add('EXIF');
    if (lowered.includes('xmp')) markers.add('XMP');
  } else if (suffix === '.gif' && data.includes(Buffer.from([0x21, 0xfe]))) markers.add('comment-extension');
  else if (suffix === '.svg' && data.toString('utf8').toLowerCase().includes('<metadata')) markers.add('metadata-element');
  else if (suffix === '.pdf') {
    const lowered = data.toString('latin1').toLowerCase();
    for (const marker of ['/author', '/creator', '/producer', '/subject', '/keywords', '<x:xmpmeta']) {
      if (lowered.includes(marker)) markers.add(marker);
    }
  }
  return [...markers].sort();
}

function walkFiles(root) {
  const results = [];
  if (!fs.existsSync(root)) return results;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(file));
    else if (entry.isFile()) results.push(file);
  }
  return results;
}

function validatePublicText(root) {
  const explicit = ['README.md', 'RIGHTS.md', 'CONTRIBUTING.md', 'public-manifest.json']
    .map(relative => path.join(root, relative))
    .filter(file => fs.existsSync(file));
  const discovered = ['src', 'docs', path.join('.github', 'workflows')]
    .flatMap(relative => walkFiles(path.join(root, relative)))
    .filter(file => PUBLIC_TEXT_SUFFIXES.has(path.extname(file).toLowerCase()));
  for (const file of [...new Set([...explicit, ...discovered])]) {
    const value = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (containsForbiddenRepo(value)) fail(`private repository identifier detected: ${relative}`);
    for (const pattern of SECRET_PATTERNS) if (pattern.test(value)) fail(`secret-like material detected: ${relative}`);
  }
  for (const file of walkFiles(path.join(root, 'src'))) {
    if (TEXT_SUFFIXES.has(path.extname(file).toLowerCase()) && DRAFT_PATTERN.test(fs.readFileSync(file, 'utf8'))) {
      fail(`draft marker detected in public source: ${path.relative(root, file).split(path.sep).join('/')}`);
    }
  }
}

export function validateSource(root = process.cwd()) {
  const manifest = readJson(root, 'public-manifest.json');
  if (manifest.schema_version !== 1) fail('unsupported manifest schema');
  if (!Array.isArray(manifest.artifacts)) fail('manifest artifacts must be a list');

  const required = new Set([
    'id', 'path', 'title', 'summary', 'content_type', 'spoiler_tier', 'approval_state',
    'rights_status', 'provenance_class', 'publication_date', 'canonical_url',
    'checksum_sha256', 'replacement_status',
  ]);
  const seenIds = new Set();
  const seenCanonicals = new Set();
  const entriesByPath = new Map();

  for (const artifact of manifest.artifacts) {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) fail('manifest artifact must be an object');
    const missing = [...required].filter(field => !(field in artifact));
    if (missing.length) fail(`manifest entry missing fields: ${missing.sort().join(', ')}`);

    const artifactId = nonempty(artifact.id, 'id', 'artifact');
    if (seenIds.has(artifactId)) fail(`invalid or duplicate artifact id: ${artifactId}`);
    seenIds.add(artifactId);
    nonempty(artifact.title, 'title', artifactId);
    nonempty(artifact.summary, 'summary', artifactId);
    nonempty(artifact.rights_status, 'rights_status', artifactId);
    nonempty(artifact.provenance_class, 'provenance_class', artifactId);

    if (!CONTENT_TYPES.has(artifact.content_type)) fail(`unsupported public content_type: ${artifactId}/${artifact.content_type}`);
    if (!ALLOWED_TIERS.has(artifact.spoiler_tier)) fail(`publicly forbidden spoiler tier: ${artifact.spoiler_tier}`);
    if (!ALLOWED_STATES.has(artifact.approval_state)) fail(`invalid approval state: ${artifact.approval_state}`);
    if (!ALLOWED_REPLACEMENT.has(artifact.replacement_status)) fail(`invalid replacement status: ${artifact.replacement_status}`);

    const expectedReplacement = artifact.approval_state === 'withdrawn'
      ? 'withdrawn'
      : artifact.approval_state === 'superseded' ? 'superseded' : 'current';
    if (artifact.replacement_status !== expectedReplacement) {
      fail(`approval/replacement state mismatch for ${artifactId}: ${artifact.approval_state}/${artifact.replacement_status}`);
    }

    if (artifact.approval_state === 'published') {
      if (!isIsoDate(artifact.publication_date)) fail(`publication_date must use YYYY-MM-DD: ${artifactId}`);
    } else if (artifact.publication_date !== null) {
      fail(`publication_date must be null until published: ${artifactId}`);
    }

    const repoPath = normalizedRepoPath(artifact.path);
    if (entriesByPath.has(repoPath)) fail(`duplicate manifest path: ${repoPath}`);
    entriesByPath.set(repoPath, artifact);
    const diskPath = path.join(root, ...repoPath.split('/'));
    if (!fs.existsSync(diskPath) || !fs.statSync(diskPath).isFile()) fail(`manifest path missing: ${repoPath}`);

    const inSrc = repoPath.startsWith('src/');
    if (inSrc && !DEPLOYABLE_STATES.has(artifact.approval_state)) fail(`non-publishable artifact must not live under src/: ${repoPath}`);
    const deployable = inSrc && DEPLOYABLE_STATES.has(artifact.approval_state) && artifact.replacement_status === 'current';
    if (deployable) {
      const canonical = validateCanonical(artifact.canonical_url, artifactId, artifact.content_type);
      if (seenCanonicals.has(canonical)) fail(`duplicate canonical_url: ${canonical}`);
      seenCanonicals.add(canonical);
    } else if (artifact.canonical_url !== null) {
      fail(`non-deployable artifact must not claim canonical_url: ${artifactId}`);
    }

    if ((artifact.content_type === 'excerpt' || artifact.content_type === 'quotation') && artifact.spoiler_tier !== 'approved-excerpt') {
      fail(`${artifact.content_type} requires approved-excerpt spoiler tier: ${artifactId}`);
    }

    const checksum = artifact.checksum_sha256;
    if (artifact.approval_state === 'approved' || artifact.approval_state === 'published') {
      if (typeof checksum !== 'string' || !/^[0-9a-f]{64}$/.test(checksum)) fail(`approved artifact requires sha256: ${artifactId}`);
      if (sha256(fs.readFileSync(diskPath)) !== checksum) fail(`checksum mismatch for ${artifactId}`);
    } else if (checksum !== null && (typeof checksum !== 'string' || !/^[0-9a-f]{64}$/.test(checksum))) {
      fail(`invalid sha256 for ${artifactId}`);
    }

    if (MEDIA_SUFFIXES.has(path.extname(diskPath).toLowerCase())) {
      for (const field of ['creator_class', 'rights_basis', 'attribution_required', 'metadata_review']) {
        if (!(field in artifact)) fail(`media provenance fields missing for ${artifactId}: ${field}`);
      }
      if (!CREATOR_CLASSES.has(artifact.creator_class)) fail(`invalid creator_class: ${artifactId}`);
      nonempty(artifact.rights_basis, 'rights_basis', artifactId);
      if (typeof artifact.attribution_required !== 'boolean') fail(`attribution_required must be boolean: ${artifactId}`);
      if (artifact.attribution_required) nonempty(artifact.attribution_text, 'attribution_text', artifactId);
      if (!METADATA_REVIEWS.has(artifact.metadata_review)) fail(`invalid metadata_review: ${artifactId}`);
      if (artifact.metadata_review === 'reviewed-retained') nonempty(artifact.metadata_retention_reason, 'metadata_retention_reason', artifactId);
      else {
        const markers = mediaMetadataMarkers(diskPath);
        if (markers.length) fail(`embedded metadata present despite stripped status for ${artifactId}: ${markers.join(', ')}`);
      }
    }

    const serialized = JSON.stringify(artifact).toLowerCase();
    if (containsForbiddenRepo(serialized)) fail(`private repository reference detected in ${artifactId}`);
    for (const forbidden of ['private_issue', 'private_path', 'private_revision']) {
      if (serialized.includes(forbidden)) fail(`private provenance field/reference detected in ${artifactId}`);
    }
  }

  for (const file of walkFiles(path.join(root, 'src'))) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (!entriesByPath.has(relative)) fail(`unmanifested deployable source: ${relative}`);
    if (TEXT_SUFFIXES.has(path.extname(file).toLowerCase())) {
      const words = fs.readFileSync(file, 'utf8').match(/\b[\p{L}\p{N}’'-]+\b/gu) ?? [];
      if (words.length >= 8000) {
        const entry = entriesByPath.get(relative);
        if (entry.spoiler_tier !== 'approved-excerpt' || !new Set(['approved', 'published']).has(entry.approval_state)) {
          fail(`suspicious manuscript-scale text import: ${relative} (${words.length} words)`);
        }
      }
    }
  }

  validatePublicText(root);
  return { manifest, entriesByPath };
}

function publishablePaths(root) {
  const { entriesByPath } = validateSource(root);
  return [...entriesByPath.entries()]
    .filter(([raw, artifact]) => raw.startsWith('src/') && DEPLOYABLE_STATES.has(artifact.approval_state))
    .map(([raw]) => raw)
    .sort();
}

export async function build(root = process.cwd()) {
  const paths = publishablePaths(root);
  const dist = path.join(root, 'dist');
  await fsp.rm(dist, { recursive: true, force: true });
  await fsp.mkdir(dist, { recursive: true });
  for (const sourceRel of paths) {
    const target = path.join(dist, ...sourceRel.split('/').slice(1));
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.copyFile(path.join(root, ...sourceRel.split('/')), target);
  }
  console.log(`Built dist/ from ${paths.length} manifest-backed artifact(s).`);
}

function parseAttributes(raw) {
  const attrs = new Map();
  const regex = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of raw.matchAll(regex)) attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  return attrs;
}

function resourceSummary(html) {
  const resources = new Set();
  const external = new Set();
  const stylesheets = [];
  let blockingScripts = 0;
  const regex = /<(link|script|img|source|video|audio)\b([^>]*)>/gi;
  for (const match of html.matchAll(regex)) {
    const tag = match[1].toLowerCase();
    const attrs = parseAttributes(match[2]);
    const urls = [];
    if (tag === 'link' && (attrs.get('rel') ?? '').toLowerCase().split(/\s+/).includes('stylesheet')) {
      if (attrs.get('href')) {
        urls.push(attrs.get('href'));
        stylesheets.push(attrs.get('href'));
      }
    } else if (tag === 'script' && attrs.get('src')) {
      urls.push(attrs.get('src'));
      if (!attrs.has('defer') && !attrs.has('async') && (attrs.get('type') ?? '').toLowerCase() !== 'module') blockingScripts += 1;
    } else if (['img', 'source', 'video', 'audio'].includes(tag)) {
      for (const field of ['src', 'poster']) if (attrs.get(field)) urls.push(attrs.get(field));
      for (const candidate of (attrs.get('srcset') ?? '').split(',')) {
        const url = candidate.trim().split(/\s+/, 1)[0];
        if (url) urls.push(url);
      }
    }
    for (const url of urls) {
      resources.add(url);
      if (/^(?:https?:)?\/\//i.test(url)) external.add(url);
    }
  }
  return { resources, external, stylesheets, blockingScripts };
}

export function validatePerformance(root = process.cwd()) {
  const budget = readJson(root, 'performance-budget.json');
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) fail('missing dist/; build before checking performance budgets');
  const stylesDir = path.join(dist, 'styles');
  const cssFiles = fs.existsSync(stylesDir) ? fs.readdirSync(stylesDir).filter(name => name.endsWith('.css')).map(name => path.join(stylesDir, name)) : [];
  const cssBytes = cssFiles.reduce((total, file) => total + fs.statSync(file).size, 0);
  if (cssBytes > budget.max_css_bytes) fail(`CSS budget exceeded: ${cssBytes} > ${budget.max_css_bytes}`);

  const htmlFiles = walkFiles(dist).filter(file => file.endsWith('.html')).sort();
  if (!htmlFiles.length) fail('no built HTML pages found');
  for (const file of htmlFiles) {
    const relative = path.relative(dist, file).split(path.sep).join('/');
    const size = fs.statSync(file).size;
    if (size > budget.max_html_bytes) fail(`HTML budget exceeded for ${relative}: ${size} > ${budget.max_html_bytes}`);
    const summary = resourceSummary(fs.readFileSync(file, 'utf8'));
    if (summary.resources.size > budget.max_initial_requests) fail(`request budget exceeded for ${relative}: ${summary.resources.size} > ${budget.max_initial_requests}`);
    if (summary.external.size > budget.max_external_requests) fail(`external request budget exceeded for ${relative}: ${[...summary.external].sort().join(', ')}`);
    if (summary.blockingScripts > budget.max_render_blocking_scripts) fail(`render-blocking script budget exceeded for ${relative}: ${summary.blockingScripts}`);
    for (const href of summary.stylesheets) {
      const filename = new URL(href, 'https://example.invalid/').pathname.split('/').pop();
      if (!/^[a-z0-9-]+\.v\d+\.css$/.test(filename)) fail(`stylesheet is not cache-versioned on ${relative}: ${href}`);
    }
  }
  console.log(`Performance budgets passed for ${htmlFiles.length} HTML page(s); CSS=${cssBytes} bytes.`);
}

export function validateHeroMedia(root = process.cwd()) {
  const pages = [
    'src/index.html',
    'src/books/prequel/index.html',
    'src/books/the-fatherless/index.html',
    'src/books/sequel/index.html',
  ];
  const combined = pages.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  if (combined.includes('-hero.svg')) fail('public pages must not reference retired vector hero assets');
  for (const name of ['age-of-embers-hero.webp', 'fatherless-original-hero.webp', 'neurion-hero.webp']) {
    if (!combined.includes(name)) fail(`public pages must reference ${name}`);
    if (!fs.existsSync(path.join(root, 'src', 'media', 'heroes', name))) fail(`missing production hero: ${name}`);
  }
  if (fs.existsSync(path.join(root, 'staging', 'raster-seed'))) fail('retired staging/raster-seed must remain absent');
  for (const name of ['trilogy-overview-hero.svg', 'age-of-embers-hero.svg', 'fatherless-original-hero.svg', 'neurion-hero.svg']) {
    if (fs.existsSync(path.join(root, 'src', 'media', 'heroes', name))) fail(`retired vector hero restored: ${name}`);
  }
}

export function validateDist(root = process.cwd()) {
  const expected = new Map(publishablePaths(root).map(source => [source.split('/').slice(1).join('/'), path.join(root, ...source.split('/'))]));
  const dist = path.join(root, 'dist');
  if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) fail('missing dist/');
  const actual = new Map(walkFiles(dist).map(file => [path.relative(dist, file).split(path.sep).join('/'), file]));
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort(), 'dist contents differ from manifest');
  for (const [relative, source] of expected) {
    if (!fs.readFileSync(actual.get(relative)).equals(fs.readFileSync(source))) fail(`dist artifact differs from source: ${relative}`);
  }
  const index = path.join(dist, 'index.html');
  const html = fs.readFileSync(index, 'utf8');
  if (!/<html[^>]*\blang=/i.test(html)) fail('index.html missing lang attribute');
  if (!/<meta[^>]*name=["']viewport["']/i.test(html)) fail('index.html missing viewport metadata');
  if (!/<title>[^<]+<\/title>/i.test(html)) fail('index.html missing non-empty title');
  if ((html.match(/<h1(?:\s[^>]*)?>/gi) ?? []).length !== 1) fail('index.html must contain exactly one h1');
  validatePerformance(root);
  validateHeroMedia(root);
  console.log('Manifest, publication-boundary, performance, and hero-media validation passed.');
}

export async function generateResponsiveMedia(input, outputDir, basename, requested = [480, 960, 1440]) {
  if (!input || !outputDir || !basename) fail('media generation requires input, output directory, and basename');
  const widthsRequested = requested.map(Number).filter(width => Number.isInteger(width) && width > 0);
  if (!widthsRequested.length) fail('media generation requires at least one positive width');
  await fsp.mkdir(outputDir, { recursive: true });
  const metadata = await sharp(input, { failOn: 'warning' }).rotate().metadata();
  if (!metadata.width || !metadata.height) fail('source image dimensions unavailable');
  const widths = [...new Set(widthsRequested.map(width => Math.min(width, metadata.width)))].sort((a, b) => a - b);
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
  return { source: path.basename(input), outputs };
}

async function fetchWithRetries(url, options = {}, attempts = 12) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 2_000));
    }
  }
  throw new SiteError(`failed to fetch deployed URL after retries: ${url}: ${lastError?.message ?? 'unknown error'}`);
}

export async function verifyOrigin(rawUrl) {
  const baseUrl = new URL(rawUrl);
  if (baseUrl.protocol !== 'https:') fail(`site base URL must use HTTPS: ${rawUrl}`);
  const base = new URL(baseUrl.href.endsWith('/') ? baseUrl.href : `${baseUrl.href}/`);
  for (const route of ['', 'books/', 'characters/', 'world/', 'news/', 'about/']) {
    const url = new URL(route, base);
    const response = await fetchWithRetries(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
    const body = await response.text();
    if (!/(?:<!doctype html>|<html[ >])/i.test(body)) fail(`deployed route is not HTML: ${url}`);
    if (!body.toLowerCase().includes('the fatherless')) fail(`deployed route is missing the public-site identity marker: ${url}`);
  }
  const css = await (await fetchWithRetries(new URL('styles/base.v1.css', base), { headers: BROWSER_HEADERS, redirect: 'follow' })).text();
  if (!css.includes('--text:')) fail('deployed base stylesheet is missing expected visual tokens');
  console.log(`Verified deployed Pages origin: ${base.href}`);
}

export async function verifyCloudflare(rawUrl) {
  const baseUrl = new URL(rawUrl);
  if (baseUrl.protocol !== 'https:') fail(`Cloudflare verification requires an HTTPS URL: ${rawUrl}`);
  const base = new URL(baseUrl.href.endsWith('/') ? baseUrl.href : `${baseUrl.href}/`);
  const host = base.host;

  const home = await fetchWithRetries(base, { headers: BROWSER_HEADERS, redirect: 'follow' }, 3);
  const homeUrl = new URL(home.url);
  if (homeUrl.protocol !== 'https:' || homeUrl.host !== host) fail(`Cloudflare HTTPS response escaped the canonical host: ${home.url}`);
  const homeBody = await home.text();
  if (!homeBody.toLowerCase().includes('the fatherless')) fail(`Cloudflare HTTPS response is missing the public-site identity marker: ${base.href}`);
  if (!home.headers.get('cf-ray')) fail(`Cloudflare proxy header cf-ray is missing for ${base.href}`);

  const httpUrl = `http://${host}/`;
  const httpResponse = await fetch(httpUrl, { headers: BROWSER_HEADERS, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  if (![301, 302, 307, 308].includes(httpResponse.status)) fail(`Cloudflare HTTP endpoint did not return a redirect: ${httpUrl}`);
  const location = httpResponse.headers.get('location');
  if (!location) fail('Cloudflare HTTP redirect is missing Location');
  const redirect = new URL(location, httpUrl);
  if (redirect.protocol !== 'https:' || redirect.host !== host) fail(`Cloudflare HTTP redirect does not target HTTPS on the canonical host: ${location}`);

  const cssResponse = await fetchWithRetries(new URL('styles/base.v1.css', base), { headers: BROWSER_HEADERS, redirect: 'follow' }, 3);
  const cssUrl = new URL(cssResponse.url);
  if (cssUrl.protocol !== 'https:' || cssUrl.host !== host || cssUrl.pathname !== '/styles/base.v1.css') {
    fail(`Cloudflare stylesheet response escaped the canonical host: ${cssResponse.url}`);
  }
  const css = await cssResponse.text();
  if (!css.includes('--text:')) fail('Cloudflare-served stylesheet is stale or missing expected visual tokens');

  console.log(`Verified Cloudflare edge: ${base.href}`);
  console.log(`Effective HTTPS URL: ${home.url}`);
  console.log(`HTTPS server: ${home.headers.get('server') ?? '<not present>'}`);
  console.log(`Home CF-Cache-Status: ${home.headers.get('cf-cache-status') ?? '<not present>'}`);
  console.log(`CSS CF-Cache-Status: ${cssResponse.headers.get('cf-cache-status') ?? '<not present>'}`);
}

export async function pagesState() {
  const token = process.env.GH_TOKEN;
  const repository = process.env.GH_REPOSITORY;
  if (!token || !repository) fail('GH_TOKEN and GH_REPOSITORY are required');
  const response = await fetch(`https://api.github.com/repos/${repository}/pages`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'the-fatherless-marketing-ci',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) fail('GitHub Pages is disabled. In Settings > Pages > Build and deployment, set Source to GitHub Actions.');
  if (!response.ok) fail(`Unexpected GitHub Pages API status: ${response.status}: ${await response.text()}`);
  const body = await response.json();
  if (body.build_type !== 'workflow') {
    const source = body.source ?? {};
    fail(`GitHub Pages is using legacy branch publishing (${source.branch ?? '?'}:${source.path ?? '?'}). Set Source to GitHub Actions.`);
  }
  const customDomain = body.cname ?? '';
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `custom_domain=${customDomain}\n`);
  console.log(`GitHub Pages source is workflow; custom domain: ${customDomain || '<none>'}`);
  return customDomain;
}

function mimeType(file) {
  return ({
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8',
  })[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

export function createStaticServer(root, prefix = '/') {
  const normalizedPrefix = `/${prefix.replace(/^\/+|\/+$/g, '')}${prefix === '/' ? '' : '/'}`.replace('//', '/');
  const absoluteRoot = path.resolve(root);
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith(normalizedPrefix)) {
        response.writeHead(404); response.end('Not found'); return;
      }
      let relative = decodeURIComponent(url.pathname.slice(normalizedPrefix.length));
      if (!relative || relative.endsWith('/')) relative += 'index.html';
      const file = path.resolve(absoluteRoot, relative);
      if (file !== absoluteRoot && !file.startsWith(`${absoluteRoot}${path.sep}`)) {
        response.writeHead(403); response.end('Forbidden'); return;
      }
      const data = await fsp.readFile(file);
      response.writeHead(200, { 'content-type': mimeType(file), 'cache-control': 'no-store' });
      response.end(data);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500);
      response.end(error?.code === 'ENOENT' ? 'Not found' : 'Server error');
    }
  });
}

export async function runBrowserSmoke(root = process.cwd()) {
  const server = createStaticServer(path.join(root, 'dist'), '/the-fatherless-marketing/');
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(4173, '127.0.0.1', resolve);
  });
  try {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(command, ['playwright', 'test', 'tests/browser-smoke.spec.js', '--reporter=line'], {
      cwd: root,
      env: { ...process.env, SITE_BASE_URL: 'http://127.0.0.1:4173/the-fatherless-marketing/' },
      stdio: 'inherit',
    });
    const status = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', code => resolve(code ?? 1));
    });
    if (status !== 0) fail(`Playwright browser smoke failed with exit ${status}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function cli() {
  const [command = 'validate', ...args] = process.argv.slice(2);
  const root = process.cwd();
  if (command === 'source') {
    validateSource(root); validateHeroMedia(root); console.log('Public source publication boundary passed.');
  } else if (command === 'build') await build(root);
  else if (command === 'validate') validateDist(root);
  else if (command === 'media') {
    const [input, outputDir, basename, ...widths] = args;
    console.log(JSON.stringify(await generateResponsiveMedia(input, outputDir, basename, widths.length ? widths : [480, 960, 1440]), null, 2));
  } else if (command === 'origin') await verifyOrigin(args[0]);
  else if (command === 'cloudflare') await verifyCloudflare(args[0]);
  else if (command === 'pages-state') await pagesState();
  else if (command === 'browser') await runBrowserSmoke(root);
  else if (command === 'serve') {
    const [directory = 'dist', portRaw = '4173', prefix = '/'] = args;
    const server = createStaticServer(path.resolve(root, directory), prefix);
    const port = Number(portRaw);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    console.log(`Serving ${directory} on http://127.0.0.1:${port}${prefix}`);
  } else fail(`unknown command: ${command}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch(error => {
    console.error(`site tooling failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
