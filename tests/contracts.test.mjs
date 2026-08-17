import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { build, generateResponsiveMedia, validateSource } from '../tools/site.mjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function fixture() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'fatherless-publication-'));
  await fsp.mkdir(path.join(root, 'src'), { recursive: true });
  await fsp.mkdir(path.join(root, 'staging'), { recursive: true });
  await fsp.writeFile(path.join(root, 'src', 'index.html'), '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Test</title></head><body><h1>Test</h1></body></html>');
  return root;
}

function artifact(overrides = {}) {
  return {
    id: 'home',
    path: 'src/index.html',
    title: 'Home',
    summary: 'Public home page.',
    content_type: 'page',
    spoiler_tier: 'placeholder',
    approval_state: 'placeholder',
    rights_status: 'repository-authored',
    provenance_class: 'public-native',
    publication_date: null,
    canonical_url: '/',
    checksum_sha256: null,
    replacement_status: 'current',
    ...overrides,
  };
}

function manifest(root, entries) {
  fs.writeFileSync(path.join(root, 'public-manifest.json'), JSON.stringify({ schema_version: 1, artifacts: entries }));
}

async function withFixture(callback) {
  const root = await fixture();
  try { await callback(root); } finally { await fsp.rm(root, { recursive: true, force: true }); }
}

test('valid placeholder page passes the combined public content model', async () => {
  await withFixture(async root => {
    manifest(root, [artifact()]);
    validateSource(root);
  });
});

test('missing reader metadata is rejected', async () => {
  await withFixture(async root => {
    const entry = artifact();
    delete entry.summary;
    manifest(root, [entry]);
    assert.throws(() => validateSource(root), /manifest entry missing fields/);
  });
});

test('duplicate canonical URL is rejected', async () => {
  await withFixture(async root => {
    await fsp.writeFile(path.join(root, 'src', 'about.html'), '<html></html>');
    manifest(root, [artifact(), artifact({ id: 'about', path: 'src/about.html', title: 'About' })]);
    assert.throws(() => validateSource(root), /duplicate canonical_url/);
  });
});

test('publication dates are strict and published-only', async () => {
  await withFixture(async root => {
    manifest(root, [artifact({ approval_state: 'published', publication_date: 'soon' })]);
    assert.throws(() => validateSource(root), /publication_date must use YYYY-MM-DD/);
    manifest(root, [artifact({ publication_date: '2026-08-08' })]);
    assert.throws(() => validateSource(root), /publication_date must be null until published/);
  });
});

test('candidate content cannot claim a canonical URL', async () => {
  await withFixture(async root => {
    await fsp.writeFile(path.join(root, 'staging', 'candidate.md'), 'candidate');
    manifest(root, [artifact({ path: 'staging/candidate.md', approval_state: 'candidate' })]);
    assert.throws(() => validateSource(root), /non-deployable artifact must not claim canonical_url/);
  });
});

test('excerpt requires approved-excerpt tier', async () => {
  await withFixture(async root => {
    manifest(root, [artifact({ content_type: 'excerpt', spoiler_tier: 'premise' })]);
    assert.throws(() => validateSource(root), /excerpt requires approved-excerpt/);
  });
});

test('canonical URL syntax remains strict', async () => {
  await withFixture(async root => {
    manifest(root, [artifact({ canonical_url: '/?draft=1' })]);
    assert.throws(() => validateSource(root), /canonical_url must not contain query/);
    manifest(root, [artifact({ canonical_url: '/Books/' })]);
    assert.throws(() => validateSource(root), /reader canonical_url must be lowercase/);
  });
});

test('manifest path traversal and unmanifested public files are rejected', async () => {
  await withFixture(async root => {
    await fsp.writeFile(path.join(root, 'outside.txt'), 'x');
    manifest(root, [artifact({ path: 'src/../outside.txt' })]);
    assert.throws(() => validateSource(root), /normalized and repository-relative/);

    await fsp.writeFile(path.join(root, 'src', 'leak.html'), '<p>unreviewed</p>');
    manifest(root, [artifact()]);
    assert.throws(() => validateSource(root), /unmanifested deployable source/);
  });
});

test('withdrawn content cannot remain deployable and replacement state must agree', async () => {
  await withFixture(async root => {
    manifest(root, [artifact({ approval_state: 'withdrawn', replacement_status: 'withdrawn', canonical_url: null })]);
    assert.throws(() => validateSource(root), /non-publishable artifact must not live under src/);
    manifest(root, [artifact({ approval_state: 'withdrawn', replacement_status: 'current', canonical_url: null })]);
    assert.throws(() => validateSource(root), /approval\/replacement state mismatch/);
  });
});

test('approved artifact checksum must match exact bytes', async () => {
  await withFixture(async root => {
    manifest(root, [artifact({ approval_state: 'approved', checksum_sha256: '0'.repeat(64) })]);
    assert.throws(() => validateSource(root), /checksum mismatch/);
  });
});

test('media provenance requires attribution and metadata decisions', async () => {
  await withFixture(async root => {
    await fsp.writeFile(path.join(root, 'src', 'image.jpg'), Buffer.from('plain-jpeg-like-data'));
    manifest(root, [
      artifact(),
      artifact({
        id: 'image', path: 'src/image.jpg', content_type: 'site-asset', canonical_url: '/image.jpg',
        creator_class: 'stock', rights_basis: 'licensed', attribution_required: true, metadata_review: 'stripped',
      }),
    ]);
    assert.throws(() => validateSource(root), /attribution_text/);

    await fsp.writeFile(path.join(root, 'src', 'image.jpg'), Buffer.from('Exif\0\0should-have-been-stripped'));
    manifest(root, [
      artifact(),
      artifact({
        id: 'image', path: 'src/image.jpg', content_type: 'site-asset', canonical_url: '/image.jpg',
        creator_class: 'author-created', rights_basis: 'author-owned', attribution_required: false, metadata_review: 'stripped',
      }),
    ]);
    assert.throws(() => validateSource(root), /embedded metadata present despite stripped status/);
  });
});

test('private repository references and manuscript-scale imports are rejected', async () => {
  await withFixture(async root => {
    const privateSlug = 'ry' + 'jen/' + 'the-' + 'father' + 'less';
    await fsp.writeFile(path.join(root, 'src', 'index.html'), `See https://github.com/${privateSlug}/issues/1`);
    manifest(root, [artifact()]);
    assert.throws(() => validateSource(root), /private repository identifier/);
  });

  await withFixture(async root => {
    await fsp.writeFile(path.join(root, 'src', 'chapter.txt'), 'word '.repeat(8000));
    manifest(root, [artifact(), artifact({ id: 'chapter', path: 'src/chapter.txt', title: 'Chapter', canonical_url: '/chapter/' })]);
    assert.throws(() => validateSource(root), /suspicious manuscript-scale text import/);
  });
});

test('build copies only manifest-backed publishable source', async () => {
  await withFixture(async root => {
    await fsp.writeFile(path.join(root, 'staging', 'candidate.txt'), 'candidate');
    manifest(root, [artifact(), artifact({
      id: 'candidate', path: 'staging/candidate.txt', title: 'Candidate', approval_state: 'candidate', canonical_url: null,
    })]);
    await build(root);
    assert.ok(fs.existsSync(path.join(root, 'dist', 'index.html')));
    assert.ok(!fs.existsSync(path.join(root, 'dist', 'candidate.txt')));
  });
});

test('responsive media generation remains Sharp-backed and bounded', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'fatherless-media-'));
  try {
    const result = await generateResponsiveMedia(
      path.join(repoRoot, 'tests', 'fixtures', 'responsive-source.svg'),
      tmp,
      'fixture',
      [480, 960, 1440],
    );
    assert.deepEqual(result.outputs.map(output => output.filename).sort(), [
      'fixture.1200w.avif', 'fixture.1200w.webp',
      'fixture.480w.avif', 'fixture.480w.webp',
      'fixture.960w.avif', 'fixture.960w.webp',
    ]);
    for (const output of result.outputs) {
      const metadata = await sharp(path.join(tmp, output.filename)).metadata();
      assert.ok(metadata.width && metadata.width <= 1200);
      assert.ok(metadata.height && metadata.height <= 800);
      if (output.filename.endsWith('.avif')) assert.equal(metadata.format, 'heif');
      if (output.filename.endsWith('.webp')) assert.equal(metadata.format, 'webp');
    }
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
});
