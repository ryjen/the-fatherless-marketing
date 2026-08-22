const { test, expect } = require('@playwright/test');
const sharp = require('sharp');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:4173/';
const readerRoutes = ['', 'books/', 'books/prequel/', 'books/the-fatherless/', 'books/sequel/', 'world/'];
const heroRoutes = ['', 'books/prequel/', 'books/the-fatherless/', 'books/sequel/', 'world/'];
const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 1000 },
];
const siteUrl = route => new URL(route, base).href;

function hexToRgb(value) {
  const match = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) throw new Error(`expected six-digit hex token, got ${value}`);
  const hex = match[1];
  return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
}

function luminance(value) {
  return hexToRgb(value)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseCssColor(value) {
  const match = value.trim().match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i);
  if (!match) throw new Error(`expected rgb/rgba color, got ${value}`);
  return {
    rgb: [Number(match[1]), Number(match[2]), Number(match[3])],
    alpha: match[4] === undefined || match[4] === '' ? 1 : Number(match[4]),
  };
}

function relativeLuminanceRgb(rgb) {
  return rgb
    .map(channel => channel / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRgb(a, b) {
  const [lighter, darker] = [relativeLuminanceRgb(a), relativeLuminanceRgb(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function blend(foreground, background, alpha) {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));
}

async function renderedHeroContrast(page) {
  const hero = page.locator('.hero.hero--media').first();
  await expect(hero).toBeVisible();
  const panel = hero.locator('.hero__panel').first();
  await expect(panel).toBeVisible();

  const textNodes = panel.locator('h1, h2, h3, p, a, .button');
  const samples = [];
  for (let index = 0; index < await textNodes.count(); index += 1) {
    const node = textNodes.nth(index);
    if (!(await node.isVisible())) continue;
    const box = await node.boundingBox();
    if (!box || box.width < 1 || box.height < 1) continue;
    const style = await node.evaluate(element => {
      const computed = getComputedStyle(element);
      return {
        color: computed.color,
        fontSize: parseFloat(computed.fontSize),
        fontWeight: Number(computed.fontWeight) || 400,
      };
    });
    samples.push({ box, style, label: await node.evaluate(element => `${element.tagName.toLowerCase()}.${element.className || ''}`) });
  }
  expect(samples.length).toBeGreaterThan(0);

  await panel.evaluate(element => {
    element.dataset.visualGuard = 'active';
    for (const child of element.querySelectorAll('*')) {
      child.dataset.visualGuardVisibility = child.style.visibility;
      child.style.visibility = 'hidden';
    }
  });

  let screenshot;
  try {
    screenshot = await page.screenshot({ fullPage: false });
  } finally {
    await panel.evaluate(element => {
      for (const child of element.querySelectorAll('*')) {
        child.style.visibility = child.dataset.visualGuardVisibility || '';
        delete child.dataset.visualGuardVisibility;
      }
      delete element.dataset.visualGuard;
    });
  }

  const { data, info } = await sharp(screenshot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const results = [];

  for (const sample of samples) {
    const parsed = parseCssColor(sample.style.color);
    const x0 = Math.max(0, Math.floor(sample.box.x));
    const y0 = Math.max(0, Math.floor(sample.box.y));
    const x1 = Math.min(info.width, Math.ceil(sample.box.x + sample.box.width));
    const y1 = Math.min(info.height, Math.ceil(sample.box.y + sample.box.height));
    const contrasts = [];
    const step = Math.max(1, Math.floor(Math.min(sample.box.width, sample.box.height) / 12));

    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const offset = (y * info.width + x) * 4;
        const background = [data[offset], data[offset + 1], data[offset + 2]];
        const foreground = parsed.alpha < 1 ? blend(parsed.rgb, background, parsed.alpha) : parsed.rgb;
        contrasts.push(contrastRgb(foreground, background));
      }
    }

    contrasts.sort((a, b) => a - b);
    const percentileIndex = Math.min(contrasts.length - 1, Math.floor(contrasts.length * 0.05));
    const fifthPercentile = contrasts[percentileIndex];
    const largeText = sample.style.fontSize >= 24 || (sample.style.fontSize >= 18.66 && sample.style.fontWeight >= 700);
    const required = largeText ? 3 : 4.5;
    results.push({ label: sample.label, contrast: fifthPercentile, required });
  }

  return results;
}

for (const viewport of viewports) {
  for (const route of readerRoutes) {
    test(`${viewport.name} ${route || '/'} is readable and overflow-safe`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(siteUrl(route), { waitUntil: 'networkidle' });
      expect(response && response.status()).toBeLessThan(400);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('#main')).toBeVisible();
      await expect(page.locator('.skip-link')).toHaveCount(1);

      const navLinks = page.locator('.primary-nav a');
      expect(await navLinks.count()).toBeGreaterThanOrEqual(5);
      await expect(navLinks.filter({ hasText: 'Characters' })).toHaveCount(0);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      const truncated = await navLinks.evaluateAll(links => links.some(link => link.scrollWidth > link.clientWidth + 1));
      expect(truncated).toBeFalsy();

      const tokens = await page.evaluate(() => {
        const styles = getComputedStyle(document.body);
        return ['--bg', '--surface', '--text', '--muted', '--accent'].reduce((result, token) => {
          result[token] = styles.getPropertyValue(token).trim();
          return result;
        }, {});
      });
      expect(contrast(tokens['--text'], tokens['--bg'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['--muted'], tokens['--bg'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['--accent'], tokens['--bg'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['--text'], tokens['--surface'])).toBeGreaterThanOrEqual(4.5);

      const firstNav = navLinks.first();
      await firstNav.focus();
      const focus = await firstNav.evaluate(element => {
        const styles = getComputedStyle(element);
        return { style: styles.outlineStyle, width: parseFloat(styles.outlineWidth) };
      });
      expect(focus.style).not.toBe('none');
      expect(focus.width).toBeGreaterThanOrEqual(2);
    });
  }
}

for (const viewport of viewports) {
  for (const route of heroRoutes) {
    test(`${viewport.name} ${route || '/'} hero remains readable over rendered media`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(siteUrl(route), { waitUntil: 'networkidle' });
      expect(response && response.status()).toBeLessThan(400);

      const results = await renderedHeroContrast(page);
      const failures = results.filter(result => result.contrast < result.required);
      if (failures.length) {
        await testInfo.attach(`hero-${viewport.name}.png`, {
          body: await page.locator('.hero').first().screenshot(),
          contentType: 'image/png',
        });
      }
      expect(failures, JSON.stringify(results, null, 2)).toEqual([]);
    });
  }
}

test('mobile layout survives 200% text sizing', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(siteUrl(''), { waitUntil: 'networkidle' });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const layout = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - viewportWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .map(element => {
        const rect = element.getBoundingClientRect();
        const styles = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className || '',
          text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
          minWidth: styles.minWidth,
          maxWidth: styles.maxWidth,
          fontSize: styles.fontSize,
        };
      })
      .filter(item => item.right > viewportWidth + 1 || item.left < -1 || item.scrollWidth > item.width + 1)
      .slice(0, 12);
    return { overflow, offenders };
  });
  expect(layout.overflow, JSON.stringify(layout.offenders, null, 2)).toBeLessThanOrEqual(1);
  await expect(page.locator('h1')).toBeVisible();
});

test('reduced motion disables smooth scrolling and transition duration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(siteUrl(''));
  const reduced = await page.evaluate(() => ({
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    transition: getComputedStyle(document.querySelector('.button')).transitionDuration,
  }));
  expect(reduced.scroll).toBe('auto');
  expect(parseFloat(reduced.transition)).toBeLessThanOrEqual(0.00001);
});

test('primary navigation destinations resolve inside the deployed base path', async ({ page, request }) => {
  await page.goto(siteUrl(''));
  const hrefs = await page.locator('.primary-nav a').evaluateAll(links => links.map(link => link.href));
  for (const href of hrefs) {
    expect(href.startsWith(base)).toBeTruthy();
    const response = await request.get(href);
    expect(response.status(), `${href} should resolve`).toBeLessThan(400);
  }
});
