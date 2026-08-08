const { test, expect } = require('@playwright/test');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:4173/';
const themeRoutes = ['', 'books/prequel/', 'books/sequel/'];
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

for (const viewport of viewports) {
  for (const route of themeRoutes) {
    test(`${viewport.name} ${route || '/'} is readable and overflow-safe`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(siteUrl(route), { waitUntil: 'networkidle' });
      expect(response && response.status()).toBeLessThan(400);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('#main')).toBeVisible();
      await expect(page.locator('.skip-link')).toHaveCount(1);
      await expect(page.locator('.primary-nav a')).toHaveCount(6);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      const truncated = await page.locator('.primary-nav a').evaluateAll(links => links.some(link => link.scrollWidth > link.clientWidth + 1));
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

      const firstNav = page.locator('.primary-nav a').first();
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
