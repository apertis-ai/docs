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
    // 390 px: with the navigation sheet open, and with the page-actions menu open.
    const mobile = await open('/getting-started/quick-start/', VIEWS[390], theme);
    await mobile.page.click('[data-drawer-open]');
    await mobile.page.locator('#shell-drawer').waitFor();
    await mobile.page.mouse.move(0, 0);
    assert.deepEqual(await mobile.page.evaluate(tealAtRest), [], `${theme} 390 navigation sheet`);
    await mobile.page.keyboard.press('Escape');
    await mobile.page.locator('#shell-drawer').waitFor({ state: 'detached' });
    await mobile.page.click('.page-actions__toggle');
    await mobile.page.locator('[role="menu"]').waitFor();
    await mobile.page.mouse.move(0, 0);
    assert.deepEqual(await mobile.page.evaluate(tealAtRest), [], `${theme} 390 page-actions menu`);
    await mobile.context.close();
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
    // The copy button's name is its visible label, and a live region announces the result.
    assert.equal(await page.getAttribute('[data-hero-copy]', 'aria-label'), null);
    await page.click('[data-hero-copy]');
    await page.waitForFunction(() => /Copied/.test(document.querySelector('[data-hero-copy]')?.textContent ?? ''));
    assert.match(await page.textContent('[data-hero-code] [role="status"]') ?? '', /copied/i);
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
  // Tailwind scans only the component sources: no utility generated from words in the docs prose.
  assert.deepEqual([...new Set(css.match(/(?:^|[}\s,])\.(container|invisible|visible|uppercase|italic|underline)(?=[{\s,:])/g) ?? [])], []);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(250, 250, 250)');
  await context.close();
});

// ---- repair round (lead L1, review R1-R10) ---------------------------------------------------------

test('document pages: the header shares the docs grid gutter (logo = sidebar text left, right cluster = TOC content right) at 1440 and 1024', { skip }, async () => {
  for (const width of [1440, 1024] as const) {
    const { context, page } = await open('/getting-started/quick-start/', VIEWS[width]);
    const e = await page.evaluate(() => {
      const r = (el: Element) => el.getBoundingClientRect();
      const link = document.querySelector('.doc-page__sidebar .sidebar__link')!;
      const range = document.createRange();
      range.selectNodeContents(link);
      const toc = document.querySelector('.doc-page__toc')!;
      const row = [...document.querySelector('.navbar__inner')!.children].filter((c) => (c as HTMLElement).offsetParent);
      return {
        logo: r(document.querySelector('.navbar .brand')!).left,
        sidebarText: range.getBoundingClientRect().left,
        headerRight: r(row[row.length - 1]).right,
        tocRight: r(toc).right - parseFloat(getComputedStyle(toc).paddingRight),
      };
    });
    assert.ok(Math.abs(e.logo - e.sidebarText) <= 1, `${width}: logo ${e.logo} vs sidebar text ${e.sidebarText}`);
    assert.ok(Math.abs(e.headerRight - e.tocRight) <= 1, `${width}: header right ${e.headerRight} vs TOC content right ${e.tocRight}`);
    console.log(`# docs alignment ${width}: left ${Math.round(e.logo)} right ${Math.round(e.headerRight)}`);
    await context.close();
  }
});

/** Contrast of `fg` (blended over `bg` by its alpha) against `bg`, both CSS colours, resolved through a canvas. */
const contrastIn = () => {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const rgba = (c: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
  const lum = (c: number[]) => { const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // The strongest focus/selection indicator of `el` (outline, or any box-shadow colour) against `surface`.
  (window as unknown as { __indicator: (el: Element, surface: string) => number }).__indicator = (el, surface) => {
    const cs = getComputedStyle(el);
    const bg = rgba(surface);
    const colours: string[] = [];
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) colours.push(cs.outlineColor);
    if (cs.boxShadow !== 'none') colours.push(...(cs.boxShadow.match(/rgba?\([^)]*\)|okl(?:ch|ab)\([^)]*\)|lab\([^)]*\)|color\([^)]*\)/g) ?? []));
    return Math.max(0, ...colours.map((c) => {
      const [r, g, b, a] = rgba(c);
      const f = [r, g, b].map((v, i) => Math.round((v * a + bg[i] * (255 - a)) / 255));
      const [x, y] = [lum(f), lum(bg)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    }));
  };
};

test('the selected search result and the focused page-actions item have a >= 3:1 indicator, in both themes', { skip }, async () => {
  for (const theme of ['light', 'dark']) {
    const { context, page } = await open('/getting-started/quick-start/', VIEWS[1440], theme);
    await page.evaluate(contrastIn);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'search', query: 'chat completions' } })));
    await page.locator('#aa-results [role="option"][aria-selected="true"]').waitFor({ timeout: 15000 });
    await page.keyboard.press('ArrowDown');
    const result = await page.evaluate(() => (window as any).__indicator(document.querySelector('#aa-results [aria-selected="true"]'), getComputedStyle(document.getElementById('apertis-assistant')!).backgroundColor));
    assert.ok(result >= 3, `${theme}: selected result indicator ${result.toFixed(2)}:1`);
    await page.keyboard.press('Escape');
    await page.focus('.page-actions__toggle');
    await page.keyboard.press('Enter');
    await page.locator('[role="menu"]').waitFor();
    await page.keyboard.press('ArrowDown');
    const item = await page.evaluate(() => {
      const el = document.activeElement!;
      return el.getAttribute('role') === 'menuitem' ? (window as any).__indicator(el, getComputedStyle(el.closest('[role="menu"]')!).backgroundColor) : -1;
    });
    assert.ok(item >= 3, `${theme}: focused menu item indicator ${item}`);
    await context.close();
  }
});

test('keyboard focus is visible (>= 3:1) on header buttons, the hero code panel and the search field (light)', { skip }, async () => {
  const { context, page } = await open('/');
  await page.evaluate(contrastIn);
  const tabTo = async (selector: string) => {
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate((s: string) => document.activeElement?.matches(s) ?? false, selector)) return;
    }
    assert.fail(`Tab never reached ${selector}`);
  };
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // Measure the settled indicator, not a transition's first frame.
  const settle = (s: string) => page.waitForFunction((q: string) => document.querySelector(q)!.getAnimations().length === 0, s);
  for (const sel of ['.navbar__right [data-theme-toggle]', '.navbar__login', '.navbar__signup', '[data-hero-code] [role="tabpanel"]']) {
    await tabTo(sel);
    await settle(sel);
    const ratio = await page.evaluate(([s, b]: string[]) => (window as any).__indicator(document.querySelector(s), b), [sel, await bg()]);
    assert.ok(ratio >= 3, `${sel}: focus indicator ${ratio.toFixed(2)}:1`);
  }
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('dialog[open] #aa-q').waitFor();
  const field = await page.evaluate(() => (window as any).__indicator(document.querySelector('[data-slot="command-input-wrapper"]'), getComputedStyle(document.getElementById('apertis-assistant')!).backgroundColor));
  assert.ok(field >= 3, `search field focus frame ${field.toFixed(2)}:1`);
  await context.close();
});

test('Ask Docs open on a phone: the menu opens the navigation sheet on top, and Escape closes only the sheet', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/', VIEWS[390]);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'ask' } })));
  await page.locator('dialog[open] #aa-ask').waitFor();
  await page.click('[data-drawer-open]');
  await page.locator('#shell-drawer').waitFor();
  // Hit-test once the slide-in has finished.
  await page.waitForFunction(() => document.querySelector('#shell-drawer')!.getAnimations().length === 0);
  const top = await page.evaluate(() => {
    // Radix sets pointer-events: none on everything outside the modal sheet, and hit-testing skips such
    // elements; let the Ask Docs panel take hits again so this tests the visual stacking.
    document.getElementById('apertis-assistant')!.style.pointerEvents = 'auto';
    const r = document.querySelector('#shell-drawer')!.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && document.querySelector('#shell-drawer')!.contains(hit);
  });
  assert.ok(top, 'the sheet is topmost at its centre');
  await page.keyboard.press('Escape');
  await page.locator('#shell-drawer').waitFor({ state: 'detached' });
  assert.ok(await page.isVisible('dialog[open] #aa-ask'), 'Ask Docs stays open');
  await context.close();
});

test('Cmd/Ctrl+K with the navigation sheet open closes the sheet; search is not hidden from assistive tech and has focus', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/', VIEWS[390]);
  await page.click('[data-drawer-open]');
  await page.locator('#shell-drawer').waitFor();
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('dialog[open] #aa-q').waitFor();
  assert.equal(await page.locator('#shell-drawer').count(), 0, 'the sheet closed');
  assert.equal(await page.evaluate(() => !!document.getElementById('apertis-assistant')!.closest('[aria-hidden="true"]')), false, 'no aria-hidden ancestor');
  assert.equal(await page.evaluate(() => document.body.hasAttribute('data-scroll-locked')), false, 'the sheet scroll lock is released');
  await page.waitForFunction(() => document.activeElement?.id === 'aa-q', null, { timeout: 2000 });
  await context.close();
});

test('the menu button: aria-controls only while the sheet exists; a click before NavSheet hydrates still opens it', { skip }, async () => {
  // Server-rendered (no JavaScript yet): the sheet does not exist, so nothing to control.
  const html = await (await fetch(base + '/getting-started/quick-start/')).text();
  const button = /<button[^>]*data-drawer-open[^>]*>/.exec(html)?.[0] ?? '';
  assert.ok(button && !/aria-controls/.test(button), `server-rendered menu button: ${button}`);
  const { context, page } = await open('/getting-started/quick-start/', VIEWS[390]);
  assert.equal(await page.getAttribute('[data-drawer-open]', 'aria-controls'), null);
  await page.click('[data-drawer-open]');
  await page.locator('#shell-drawer').waitFor();
  assert.equal(await page.getAttribute('[data-drawer-open]', 'aria-controls'), 'shell-drawer');
  await context.close();
  // Hold the NavSheet chunk: the click lands on the server-rendered button and is handed over.
  const held = await browser.newContext(VIEWS[390]);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await held.route(/\/_astro\/NavSheet\.[^/]*\.js$/, async (route: any) => { await gate; await route.fallback(); });
  const p = await held.newPage();
  await p.goto(base + '/getting-started/quick-start/', { waitUntil: 'load' });
  await p.click('[data-drawer-open]');
  await p.waitForTimeout(300);
  assert.equal(await p.locator('#shell-drawer').count(), 0, 'not open before hydration');
  release();
  await p.locator('#shell-drawer').waitFor({ timeout: 10000 });
  await held.close();
});

test('the mobile TOC states the native <details> state it hydrates into', { skip }, async () => {
  const context = await browser.newContext(VIEWS[390]);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await context.route(/\/_astro\/TocMobile\.[^/]*\.js$/, async (route: any) => { await gate; await route.fallback(); });
  const page = await context.newPage();
  await page.goto(base + '/getting-started/quick-start/', { waitUntil: 'load' });
  await page.click('article .toc-mobile > summary');
  assert.equal(await page.evaluate(() => (document.querySelector('article .toc-mobile') as HTMLDetailsElement).open), true);
  release();
  await page.waitForSelector('article .toc-mobile > summary[aria-expanded]', { state: 'attached', timeout: 10000 });
  assert.equal(await page.getAttribute('article .toc-mobile > summary', 'aria-expanded'), 'true');
  await context.close();
});

test('one search control on the homepage: no header search at 1440 and 1024, the hero search and Cmd/Ctrl+K open search; other pages keep the header search', { skip }, async () => {
  for (const view of [VIEWS[1440], VIEWS[1024]]) {
    const { context, page } = await open('/', view);
    assert.equal(await page.isVisible('.navbar__search'), false, `no header search on / at ${JSON.stringify(view)}`);
    assert.equal(await page.locator('main [data-open-surface="search"]:visible').count(), 1, 'exactly one visible search control in the homepage');
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('dialog[open] #aa-q').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'aa-q');
    await context.close();
    const other = await open('/getting-started/quick-start/', view);
    assert.equal(await other.page.isVisible('.navbar__search'), true, 'document pages keep the header search');
    await other.context.close();
  }
});
