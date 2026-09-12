import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');

const publicHtmlPages = [
  'src/index.html',
  'src/books/index.html',
  'src/books/prequel/index.html',
  'src/books/the-fatherless/index.html',
  'src/books/sequel/index.html',
  'src/world/index.html',
  'src/about/index.html',
  'src/news/index.html',
  'src/news/2026-08-08-public-trilogy-site/index.html',
  'src/press/index.html',
  'src/characters/index.html',
];
const trilogyOverviewPages = [
  'src/books/index.html',
  'src/world/index.html',
  'src/about/index.html',
  'src/news/index.html',
  'src/press/index.html',
];
const primaryNavLabels = ['Home', 'The series', 'Books', 'World', 'About', 'News'];

test('homepage keeps a focused story-first journey', async () => {
  const html = await read('src/index.html');
  const heroStart = html.indexOf('<section class="hero hero--trilogy');
  const heroEnd = html.indexOf('</section>', heroStart);
  assert.ok(heroStart >= 0 && heroEnd > heroStart, 'homepage hero must exist');

  const hero = html.slice(heroStart, heroEnd);
  const heroActions = [...hero.matchAll(/<a class="button(?: button--quiet)?"[^>]*>([^<]+)<\/a>/g)]
    .map(match => match[1].trim());
  assert.deepEqual(heroActions, ['Explore the series', 'Help shape the books']);

  const betaStatus = html.search(/class="[^"]*\bbeta-status\b[^"]*"/);
  const trilogy = html.indexOf('id="trilogy"');
  const arcs = html.indexOf('id="arcs-title"');
  const editorial = html.indexOf('id="editorial-beta"');
  const updates = html.indexOf('id="release-updates"');

  assert.ok([betaStatus, trilogy, arcs, editorial, updates].every(index => index >= 0), 'all journey stages must exist');
  assert.ok(betaStatus < trilogy, 'beta status should be visible before the trilogy');
  assert.ok(trilogy < arcs, 'the trilogy should lead into recurring questions');
  assert.ok(arcs < editorial, 'editorial participation should follow story and themes');
  assert.ok(editorial < updates, 'release follow-up should come after editorial participation');
  assert.match(html, /class="editorial-section panel beta-status"/, 'beta status should retain stable layout and panel fallbacks');
  assert.match(html, /class="theme-mark beta-status__label"/, 'beta label should retain the stable theme-mark fallback');
  assert.match(html, /styles\/home-polish\.v1\.css/, 'homepage should load the versioned polish layer');
});

test('homepage polish keeps supporting content restrained and wrap-safe', async () => {
  const css = await read('src/styles/home-polish.v1.css');

  assert.match(css, /\.home-hero__panel h1\{[^}]*overflow-wrap:normal;[^}]*word-break:normal/, 'hero title should never break inside Entanglement');
  assert.match(css, /\.beta-status a\{[^}]*white-space:nowrap/, 'editorial beta CTA should stay together');
  assert.match(css, /\.trilogy-question-grid article\{[^}]*justify-items:center;[^}]*text-align:center/, 'question cards should be consistently centered');
  assert.match(css, /\.trilogy-question-grid p\{[^}]*font:500 clamp\(1\.05rem,1\.4vw,1\.3rem\)\/1\.45 var\(--font-sans\)/, 'question copy should remain supporting text rather than headline scale');
});

test('all public HTML surfaces share one primary navigation contract', async () => {
  for (const pagePath of publicHtmlPages) {
    const html = await read(pagePath);
    const nav = html.match(/<nav class="primary-nav"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(nav, `${pagePath} must contain the primary navigation`);
    const labels = [...nav[1].matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map(match => match[1].trim());
    assert.deepEqual(labels, primaryNavLabels, `${pagePath} should use the shared primary nav order and labels`);
    assert.doesNotMatch(nav[1], />Characters</, `${pagePath} should keep Characters out of primary navigation`);
    assert.doesNotMatch(nav[1], />Press</, `${pagePath} should keep Press as a contextual industry destination rather than primary navigation`);
  }
});

test('series-level overview pages use the shared four-age hero treatment', async () => {
  const css = await read('src/styles/trilogy-pages.v1.css');
  assert.match(css, /grid-template-columns:repeat\(4,1fr\)/, 'series overview hero should present four equal visual ages');

  for (const pagePath of trilogyOverviewPages) {
    const html = await read(pagePath);
    assert.match(html, /styles\/trilogy-pages\.v1\.css/, `${pagePath} should load the trilogy overview stylesheet`);
    assert.match(html, /class="hero trilogy-page-hero"/, `${pagePath} should use the trilogy hero`);
    assert.match(html, /age-of-embers-hero\.webp/, `${pagePath} should include prequel artwork`);
    assert.match(html, /fatherless-original-hero\.webp/, `${pagePath} should include original artwork`);
    assert.match(html, /neurion-hero\.webp/, `${pagePath} should include sequel artwork`);
    assert.match(html, /age-of-forms-hero\.webp/, `${pagePath} should include Book IV artwork`);
  }
});

test('mobile reader navigation stays compact and touch sized', async () => {
  const css = await read('src/styles/base.v1.css');

  assert.match(css, /min-height:\s*2\.75rem;/, 'navigation should preserve a 44px-equivalent touch target');
  assert.doesNotMatch(
    css,
    /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(9rem,\s*100%\),\s*1fr\)\)/,
    'mobile navigation should not return to full-width grid cells',
  );
  assert.match(
    css,
    /\.primary-nav ul \{\s*display: flex;\s*flex-wrap: wrap;\s*gap: 0\.25rem 0\.4rem;/s,
    'mobile navigation should wrap compact links',
  );
  assert.match(
    css,
    /\.primary-nav a \{\s*width: auto;\s*justify-content: flex-start;\s*padding-inline: 0\.55rem;\s*border: 0;\s*border-bottom: 1px solid var\(--border\);/s,
    'mobile links should remain compact without losing a visible affordance',
  );
});
