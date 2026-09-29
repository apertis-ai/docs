// m9 shell redesign in a real browser (openspec docs-shell-interfaces "Shell alignment, header, footer and
// homepage" and the revised Palette), against a running `npm run preview`:
//   PREVIEW_URL=http://127.0.0.1:8811 PLAYWRIGHT=<path>/playwright/index.mjs node --test test/m9-shell.test.ts
// Skipped when either variable is unset, so `npm test` stays browser-free.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import type { ManifestV1 } from '../src/contracts/manifest.ts';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
const skip = !base || !process.env.PLAYWRIGHT ? 'set PREVIEW_URL and PLAYWRIGHT' : false;
const manifest = (): ManifestV1 => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../src/manifest/manifest.json'), 'utf8'));

const VIEWS = {
  1440: { viewport: { width: 1440, height: 900 } },
  1024: { viewport: { width: 1024, height: 768 } },
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

// The footer link set before the redesign (f517488:site-nimbus/src/components/shell/Footer.astro, the
// legacy docusaurus.config.js themeConfig.footer): label-independent, as [href, target, rel].
const EXT = ['_blank', 'noopener noreferrer'];
const FOOTER_LINKS = [
  ['https://api.apertis.ai', ...EXT], ['https://chat.apertis.ai', ...EXT], ['https://apertis.ai/research', ...EXT],
  ['https://status.apertis.ai', ...EXT], ['mailto:hi@apertis.ai', '', ''], ['https://www.facebook.com/stimaai/', ...EXT],
  ['https://www.instagram.com/stimatech', ...EXT], ['https://www.linkedin.com/company/apertis-ai', ...EXT], ['https://github.com/apertis-ai', ...EXT],
];
// Navbar destinations ("Preserved reader-facing shell"), in header order after the logo.
const NAV = ['/intro', '/api', 'https://apertis.ai/changelog', 'https://apertis.ai/login', 'https://apertis.ai/register'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browser: any;
before(async () => {
  if (skip) return;
  const { chromium } = await import(process.env.PLAYWRIGHT!);
  browser = await chromium.launch({ channel: 'chrome' });
});
after(async () => browser?.close());

async function open(pathname: string, options: object = VIEWS[1440], theme = 'light') {
  const context = await browser.newContext(options);
  await context.addInitScript((t: string) => { try { localStorage.setItem('theme', t); } catch { /* ignore */ } }, theme);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(e.message));
  await page.goto(base + pathname, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return { context, page, errors };
}

test('aligned edges: header, every homepage section and the footer share left and right content edges at 1440, 1024 and 390', { skip }, async () => {
  for (const [width, view] of Object.entries(VIEWS)) {
    const { context, page } = await open('/', view);
    const edges = await page.evaluate(() => {
      const box = (el: Element | null) => { const r = el!.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; };
      // The first and last visible child of the header row (the logo, then the account actions or the menu button).
      const row = [...document.querySelector('.navbar__inner')!.children].filter((c) => (c as HTMLElement).offsetParent);
      const header = [box(row[0])[0], box(row[row.length - 1])[1]];
      const sections = [...document.querySelectorAll('main.landing > section')].map((s) => {
        const kids = [...s.children].filter((c) => (c as HTMLElement).offsetParent).map(box);
        return [Math.min(...kids.map((k) => k[0])), Math.max(...kids.map((k) => k[1]))];
      });
      const foot = [...document.querySelectorAll('.footer > *')].map((f) => {
        const kids = [...f.children].map(box);
        return [Math.min(...kids.map((k) => k[0])), Math.max(...kids.map((k) => k[1]))];
      });
      return { header, sections, foot, docWidth: document.documentElement.scrollWidth };
    });
    const all = [edges.header, ...edges.sections, ...edges.foot];
    assert.ok(edges.sections.length >= 3, `${width}: hero and two sections, got ${edges.sections.length}`);
    assert.deepEqual(new Set(all.map((e) => e[0])).size, 1, `${width}: left edges ${JSON.stringify(all)}`);
    assert.deepEqual(new Set(all.map((e) => e[1])).size, 1, `${width}: right edges ${JSON.stringify(all)}`);
    assert.ok(edges.docWidth <= Number(width), `${width}: horizontal overflow ${edges.docWidth}`);
    console.log(`# alignment ${width}: left ${all[0][0]} right ${all[0][1]} (${all.length} rows)`);
    await context.close();
  }
});

/** In-page walk: every element whose fill, border or outline (or text, outside code tokens) is in the teal family at rest. */
const tealAtRest = () => {
  const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const rgba = (c: string) => { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = '#000'; canvas.fillStyle = c; canvas.fillRect(0, 0, 1, 1); return [...canvas.getImageData(0, 0, 1, 1).data]; };
  // Teal family: hue 160-200 with real saturation (Apertis #0d9488, #0f766e, #14b8a6, #2dd4bf and their tints).
  const teal = (c: string) => {
    if (!c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c)) return false;
    const [r, g, b, a] = rgba(c).map((v, i) => (i < 3 ? v / 255 : v));
    if (a === 0) return false;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (d < 0.08) return false;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    return h >= 160 && h <= 200 && s >= 0.25;
  };
  (document.activeElement as HTMLElement | null)?.blur();
  const hits: string[] = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions)) continue;
    const cs = getComputedStyle(el);
    const name = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].slice(0, 2).join('.')}`;
    if (teal(cs.backgroundColor)) hits.push(`${name} background ${cs.backgroundColor}`);
    if (cs.backgroundImage !== 'none' && /rgb/.test(cs.backgroundImage) && (cs.backgroundImage.match(/rgba?\([^)]*\)/g) ?? []).some(teal)) hits.push(`${name} background-image`);
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      if (parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none' && teal(cs[`border${side}Color`])) { hits.push(`${name} border-${side.toLowerCase()} ${cs[`border${side}Color`]}`); break; }
    }
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && teal(cs.outlineColor)) hits.push(`${name} outline ${cs.outlineColor}`);
    if (cs.boxShadow !== 'none' && (cs.boxShadow.match(/rgba?\([^)]*\)/g) ?? []).some(teal)) hits.push(`${name} box-shadow`);
    if (!el.closest('pre.astro-code') && el.tagName !== 'svg' && teal(cs.color) && el.textContent?.trim()) hits.push(`${name} color ${cs.color}`);
  }
  return hits;
};

test('restrained accent: no button, chip, badge, input or surface is filled or outlined with teal at rest, in both themes', { skip }, async () => {
  for (const theme of ['light', 'dark']) {
    for (const p of ['/', '/getting-started/quick-start/']) {
      const { context, page } = await open(p, VIEWS[1440], theme);
      await page.mouse.move(0, 0);
      assert.deepEqual(await page.evaluate(tealAtRest), [], `${theme} ${p}`);
      if (p !== '/') {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'search', query: 'chat completions' } })));
        await page.locator('#aa-results [role="option"]').first().waitFor({ timeout: 15000 });
        await page.mouse.move(0, 0);
        assert.deepEqual(await page.evaluate(tealAtRest), [], `${theme} ${p} search dialog`);
        await page.keyboard.press('Escape');
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'ask' } })));
        await page.locator('dialog[open] #aa-question').waitFor();
        await page.mouse.move(0, 0);
        assert.deepEqual(await page.evaluate(tealAtRest), [], `${theme} ${p} Ask Docs`);
      }
      await context.close();
    }
  }
});

test('the hero code tabs switch between cURL, Python and Node.js without JS errors, and copy the shown source', { skip }, async () => {
  const { context, page, errors } = await open('/');
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const panel = () => page.locator('[data-hero-code] [role="tabpanel"]:visible').innerText();
  assert.match(await panel(), /curl https:\/\/api\.apertis\.ai\/v1\/chat\/completions/);
  const quick = fs.readFileSync(path.resolve(import.meta.dirname, '../src/content/public/getting-started/quick-start.md'), 'utf8');
  const model = /"model": "([^"]+)"/.exec(quick)![1];
  for (const [tab, expected] of [['Python', /from openai import OpenAI[\s\S]*base_url="https:\/\/api\.apertis\.ai\/v1"/], ['Node.js', /import OpenAI from 'openai'[\s\S]*baseURL: 'https:\/\/api\.apertis\.ai\/v1'/], ['cURL', /curl /]] as const) {
    await page.getByRole('tab', { name: tab }).click();
    assert.equal(await page.getAttribute(`[data-hero-code] [role="tab"]:text-is("${tab}")`, 'aria-selected'), 'true');
    const text = await panel();
    assert.match(text, expected, tab);
    assert.match(text, /sk-your-api-key/, `${tab} placeholder key`);
    assert.ok(text.includes(model), `${tab} uses the Quick Start model ${model}`);
    assert.ok(await page.locator('[data-hero-code] [role="tabpanel"]:visible pre.astro-code span[style*="--shiki"]').count() > 3, `${tab} is highlighted at build time`);
    await page.click('[data-hero-code] button[aria-label="Copy code"]');
    await page.waitForFunction(() => /Copied/.test(document.querySelector('[data-hero-code] button[aria-label="Copy code"]')?.textContent ?? ''));
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).trim(), text.trim(), `${tab} copy`);
  }
  assert.deepEqual(errors, []);
  await context.close();
});

test('the footer carries exactly the pre-redesign footer link set, regrouped, with a brand column and sentence-case headings', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/');
  const links = await page.$$eval('footer.footer a[href]:not(.brand)', (as: HTMLAnchorElement[]) => as.map((a) => [a.getAttribute('href'), a.target, a.rel]));
  const key = (l: string[]) => l.join(' ');
  assert.deepEqual(links.map(key).sort(), FOOTER_LINKS.map(key).sort());
  assert.equal(links.length, FOOTER_LINKS.length, 'each link once');
  const labels = await page.$$eval('footer .footer__social a', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('aria-label')));
  assert.deepEqual(labels.sort(), ['Facebook', 'GitHub', 'Instagram', 'LinkedIn']);
  const titles = await page.$$eval('footer .footer__title', (ps: HTMLElement[]) => ps.map((p) => [p.textContent, getComputedStyle(p).textTransform]));
  assert.ok(titles.length >= 2 && titles.every(([t, tt]: string[]) => tt === 'none' && /^[A-Z][a-z]/.test(t)), `headings ${JSON.stringify(titles)}`);
  assert.doesNotMatch(await page.textContent('.footer__copyright'), /RESERVED/);
  await context.close();
});

test('the navbar destinations are unchanged in the header and in the navigation sheet', { skip }, async () => {
  const { context, page } = await open('/api/');
  assert.deepEqual(await page.$$eval('header.navbar a', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href'))), ['/', ...NAV]);
  const ext = await page.$$eval('header.navbar a[target]', (as: HTMLAnchorElement[]) => as.map((a) => [a.getAttribute('href'), a.target, a.rel]));
  assert.deepEqual(ext, NAV.slice(2).map((h) => [h, ...EXT]));
  await context.close();
  const mobile = await open('/api/', VIEWS[390]);
  await mobile.page.click('[data-drawer-open]');
  await mobile.page.locator('#shell-drawer').waitFor();
  const inSheet = await mobile.page.$$eval('#shell-drawer a[href]', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href')));
  for (const href of NAV) assert.ok(inSheet.includes(href), `sheet lacks ${href}`);
  assert.ok(inSheet.includes('https://apertis.ai/setting?tab=keys'), 'the sheet carries the sidebar (Console link)');
  await mobile.context.close();
});

test('static parts are server-rendered without hydration; homepage links all resolve to published routes', { skip }, async () => {
  const { context, page } = await open('/');
  const islands = await page.$$eval('astro-island', (els: Element[]) => els.map((e) => (e.getAttribute('component-url') ?? '').replace(/^.*\/|\..*$/g, '')).sort());
  assert.deepEqual(islands, ['HeroCode', 'NavSheet']);
  const hydrated = await page.$$eval('header.navbar, .hero__copy, .hero__search, .paths, .path-card, .journey, .tile, footer.footer, .ask-docs-trigger, #apertis-assistant', (els: Element[]) =>
    els.filter((e) => e.closest('astro-island') || e.querySelector('astro-island')).map((e) => e.className));
  assert.deepEqual(hydrated, []);
  const served = new Set(manifest().documents.filter((d) => d.eligibility.publish).map((d) => d.servedPath));
  const internal = await page.$$eval('main a[href^="/"], footer a[href^="/"], header a[href^="/"]', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href')!));
  assert.ok(internal.length >= 20, `${internal.length} internal links`);
  for (const href of internal) assert.ok(served.has(href.endsWith('/') ? href : `${href}/`), `${href} is not a published route`);
  // The six legacy feature-card destinations stay on the homepage.
  const features = await page.$$eval('main a.feature-card', (as: HTMLAnchorElement[]) => as.map((a) => [a.getAttribute('href'), a.target, a.rel]));
  assert.deepEqual(features.map((f: string[]) => f.join(' ')).sort(), [
    ['/intro', '', ''], ['/installation/models', '', ''], ['/api', '', ''], ['/installation/claude-code', '', ''],
    ['/billing/subscription-plans', '', ''], ['https://playground.apertis.ai', ...EXT],
  ].map((f) => f.join(' ')).sort());
  await context.close();
});

test('no prefers-color-scheme in any shipped stylesheet: dark only through the switch', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/', { ...VIEWS[1440], colorScheme: 'dark' });
  const css = await page.evaluate(async () => (await Promise.all([...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
    .filter((l) => l.href.startsWith(location.origin)).map((l) => fetch(l.href).then((r) => r.text())))).join('\n'));
  assert.ok(css.length > 1000);
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(250, 250, 250)');
  await context.close();
});
