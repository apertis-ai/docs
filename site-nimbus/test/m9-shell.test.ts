// m9 shell redesign in a real browser (openspec docs-shell-interfaces "Shell alignment, header, footer and
// homepage" and the revised Palette), against a running `npm run preview`:
//   PREVIEW_URL=http://127.0.0.1:8811 PLAYWRIGHT=<path>/playwright/index.mjs node --test test/m9-shell.test.ts
// Skipped when either variable is unset, so `npm test` stays browser-free.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import type { ManifestV1 } from '../src/contracts/manifest.ts';
import { modelView, noteView, type NewModel, type ReleaseNote } from '../src/components/home/feed.ts';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
const skip = !base || !process.env.PLAYWRIGHT ? 'set PREVIEW_URL and PLAYWRIGHT' : false;
const manifest = (): ManifestV1 => JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../src/manifest/manifest.json'), 'utf8'));

const VIEWS = {
  1440: { viewport: { width: 1440, height: 900 } },
  1024: { viewport: { width: 1024, height: 768 } },
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

// The footer of apertis.ai (operator review 2026-10-03; stima-api web/shared/marketing-chrome/contract.json),
// column by column as [label, href], with this site's Blog in place of "API Documentation" and the Developers
// links pointing into this site. apertis.ai and other sites open in a new tab.
const EXT = ['_blank', 'noopener noreferrer'];
const A = 'https://apertis.ai';
const FOOTER_COLUMNS = {
  Product: [['Coding Plan', `${A}/subscribe`], ['Helmway', `${A}/brand`], ['Models', `${A}/models`], ['Pricing', `${A}/models`], ['Cost Calculator', `${A}/calculator`], ['Chat', 'https://chat.apertis.ai']],
  Resources: [['Blog', '/blog/'], ['Enterprise', `${A}/enterprise`], ['Research', `${A}/research`], ['Brand', `${A}/brand`], ['Academic Access', `${A}/academic`], ['Changelog', `${A}/changelog`], ['Ideas', `${A}/ideas`], ['Compare', `${A}/compare`], ['Service Status', 'https://status.apertis.ai']],
  Developers: [['API Reference', '/api/text-generation/chat-completions/'], ['Quickstart Guide', '/intro/'], ['SDKs & Libraries', '/installation/scripts/'], ['Agent Skill', 'https://github.com/apertis-ai/apertis-skills'], ['MCP Server', '/api/sdks/mcp-server/']],
  Contact: [['Email', 'mailto:hi@apertis.ai'], ['Facebook', 'https://www.facebook.com/stimaai/'], ['Instagram', 'https://www.instagram.com/stimatech'], ['LinkedIn', 'https://www.linkedin.com/company/apertis-ai'], ['GitHub', 'https://github.com/apertis-ai/apertis-api']],
  Legal: [['Terms of Service', `${A}/terms`], ['Privacy Policy', `${A}/privacy`], ['Refund Policy', `${A}/refund`], ['GitHub Promotion', `${A}/github-promotion-policy`], ['DPA (Data Processing)', `${A}/trust`], ['Compliance & Security', `${A}/trust`]],
};
const FOOTER_BOTTOM = [['Security & Compliance', `${A}/trust`], ['DPA requests', `${A}/trust/dpa`], ['Service Status', 'https://status.apertis.ai']];
// Navbar destinations ("Preserved reader-facing shell" and the Blog tab), in tab order, then the account actions.
const NAV = ['/intro', '/api', '/blog/', '/changelog/', 'https://apertis.ai/login', 'https://apertis.ai/register'];

// The homepage feed rows as shown: each `data-f` field's text (or href, or "" when hidden), per list.
type Row = Record<string, string>;
const homeFeedRows = () => ['models', 'notes'].map((list) => [...document.querySelectorAll(`[data-feed="${list}"] > li`)].map((li) =>
  Object.fromEntries([...li.querySelectorAll<HTMLElement>('[data-f]')].map((el) => [el.dataset.f!,
    el.dataset.f === 'href' ? `${el.getAttribute('href')} ${(el as HTMLAnchorElement).target} ${(el as HTMLAnchorElement).rel}` : el.checkVisibility() ? el.textContent!.trim() : ''])) as Row));
const rowsOf = (views: Row[]) => views.map((v) => Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'datetime')
  .map(([k, x]) => [k, k === 'href' ? `${x} ${EXT.join(' ')}` : x])));

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

/** In-page walk: every element whose fill, border or outline (or text, outside code tokens, or SVG paint such as the logo) is in the teal family at rest. */
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
    if (el instanceof SVGElement && (teal(cs.fill) || teal(cs.stroke))) hits.push(`${name} svg paint ${cs.fill} ${cs.stroke}`);
  }
  return hits;
};

test('no brand colour (2026-10-02): no element, the logo included, is filled, outlined or coloured with teal at rest, in both themes', { skip }, async () => {
  for (const theme of ['light', 'dark']) {
    for (const p of ['/', '/getting-started/quick-start/']) {
      const { context, page } = await open(p, VIEWS[1440], theme);
      await page.mouse.move(0, 0);
      assert.deepEqual(await page.evaluate(tealAtRest), [], `${theme} ${p}`);
      // The logo is the inline monochrome mark in both the header and the footer, not the teal image.
      assert.deepEqual(await page.$$eval('a.brand', (as: Element[]) => as.map((a) => [!!a.querySelector('svg'), !!a.querySelector('img')])), [[true, false], [true, false]], `${theme} ${p} logo`);
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

test('the footer follows the apertis.ai footer: brand column, five link columns, trust facts and the bottom row', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/');
  const f = await page.evaluate(() => {
    const link = (a: HTMLAnchorElement) => [a.textContent!.trim(), a.getAttribute('href')!, a.target, a.rel];
    return {
      brand: [...document.querySelector('footer .footer__brand')!.children].map((e) => e.textContent!.trim()),
      columns: [...document.querySelectorAll('footer .footer__columns > div')].map((c) => [c.querySelector('.footer__title')!.textContent, [...c.querySelectorAll('a')].map(link)]),
      titles: [...document.querySelectorAll('footer .footer__title')].map((p) => getComputedStyle(p).textTransform),
      trust: [...document.querySelectorAll('footer .footer__trust li')].map((li) => [li.querySelector('strong')!.textContent, li.querySelector('small')!.textContent, li.querySelector('svg') ? 'icon' : 'no icon']),
      bottom: [...document.querySelectorAll<HTMLAnchorElement>('footer .footer__legal a')].map(link),
      copyright: document.querySelector('footer .footer__copyright')!.textContent,
    };
  });
  const ext = ([label, href]: string[]) => [label, href, ...(href.startsWith('/') || href.startsWith('mailto:') ? ['', ''] : EXT)];
  assert.deepEqual(f.brand, ['Apertis', 'Apertis AI by STIMA AI LLC.', 'Checking system status']);
  assert.deepEqual(f.columns, Object.entries(FOOTER_COLUMNS).map(([title, links]) => [title, links.map(ext)]));
  assert.ok(f.titles.every((t: string) => t === 'none'), 'sentence-case headings');
  assert.deepEqual(f.trust, [['AWS', 'Partner Network Member', 'icon'], ['PCI DSS', 'via Stripe', 'icon'], ['DPA', 'Available', 'icon'], ['MFA', 'Supported', 'icon']]);
  assert.deepEqual(f.bottom, FOOTER_BOTTOM.map(ext));
  assert.match(f.copyright!, /^© \d{4} STIMA AI LLC$/);
  const served = new Set(manifest().documents.filter((d) => d.eligibility.publish).map((d) => d.servedPath));
  for (const [, href] of Object.values(FOOTER_COLUMNS).flat().filter(([, h]) => h.startsWith('/') && h !== '/blog/')) assert.ok(served.has(href), `${href} is published`);
  await context.close();
});

test('the footer service status follows status.apertis.ai as the apertis.ai footer does, and the AWS mark keeps its orange smile', { skip }, async () => {
  for (const [body, label, dot] of [
    [{ data: { attributes: { aggregate_state: 'operational' } } }, 'All Systems Operational', 'rgb(34, 197, 94)'],
    [{ data: { attributes: { aggregate_state: 'degraded' } } }, 'Some Systems are Experiencing Issues', 'rgb(217, 119, 6)'],
    [null, 'System status unavailable', 'rgb(168, 162, 158)'],
  ] as const) {
    const { context, page } = await open('/getting-started/quick-start/');
    await page.route('https://status.apertis.ai/index.json', (r: any) => (body ? r.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } }) : r.fulfill({ status: 503 })));
    await page.locator('[data-footer-status]').scrollIntoViewIfNeeded();
    await page.waitForFunction((l: string) => document.querySelector('.footer__status-text')?.textContent === l, label);
    assert.equal(await page.locator('[data-footer-status]').getAttribute('aria-label'), `Service status: ${label}`);
    assert.equal(await page.locator('.footer__status-indicator').evaluate((e: Element) => getComputedStyle(e).backgroundColor), dot);
    await context.close();
  }
  for (const theme of ['light', 'dark']) {
    const { context, page } = await open('/getting-started/quick-start/', VIEWS[1440], theme);
    const aws = await page.locator('.footer__aws').evaluate((svg: SVGElement) => [...svg.querySelectorAll('path')].map((p) => getComputedStyle(p).fill));
    const ink = await page.evaluate(() => getComputedStyle(document.querySelector('.footer__trust-copy strong')!).color);
    assert.deepEqual(aws, [ink, 'rgb(255, 153, 0)'], `${theme}: wordmark in the text colour, smile in AWS orange`);
    await context.close();
  }
});

test('the sidebar keeps its scroll position when a sidebar link opens another page', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/', { viewport: { width: 1440, height: 700 } });
  const sidebar = page.locator('.doc-page__sidebar');
  await sidebar.evaluate((s: HTMLElement) => { s.scrollTop = s.scrollHeight; });
  const top = await sidebar.evaluate((s: HTMLElement) => s.scrollTop);
  assert.ok(top > 200, `the sidebar scrolls (${top})`);
  const link = page.locator('.doc-page__sidebar a.sidebar__link:not([aria-current])').last();
  const href = await link.getAttribute('href');
  await Promise.all([page.waitForURL(`**${href}`), link.click()]);
  assert.equal(await page.locator('.doc-page__sidebar a[aria-current="page"]').getAttribute('href'), href);
  assert.ok(Math.abs(await sidebar.evaluate((s: HTMLElement) => s.scrollTop) - top) <= 2, 'scroll position kept');
  // A page opened directly shows its own entry, even far down the sidebar.
  const fresh = await context.newPage();
  await fresh.goto(base + href!, { waitUntil: 'load' });
  const inView = await fresh.evaluate(() => {
    const s = document.querySelector('.doc-page__sidebar')!.getBoundingClientRect(), a = document.querySelector('.doc-page__sidebar [aria-current="page"]')!.getBoundingClientRect();
    return a.top >= s.top && a.bottom <= s.bottom;
  });
  assert.ok(inView, 'the current entry is in view');
  await context.close();
});

test('installation title icons are one colour: black in light, white in dark', { skip }, async () => {
  for (const [theme, rgb] of [['light', [0, 0, 0]], ['dark', [255, 255, 255]]] as const) {
    const { context, page } = await open('/installation/claude-code/', VIEWS[1440], theme);
    for (const path of ['/installation/claude-code/', '/installation/cursor/', '/installation/cline/']) {
      await page.goto(base + path, { waitUntil: 'load' });
      const icon = page.locator('.doc-header h1 img');
      await icon.evaluate((img: HTMLImageElement) => img.decode());
      // The rendered pixels of the icon, sampled from a screenshot: every opaque pixel is the theme colour.
      const shot = await icon.screenshot({ omitBackground: false });
      const colours = await page.evaluate(async ({ b64, bg }: { b64: string; bg: number[] }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
        c.drawImage(img, 0, 0);
        const d = c.getImageData(0, 0, img.width, img.height).data;
        const far = [];
        for (let i = 0; i < d.length; i += 4) {
          const px = [d[i], d[i + 1], d[i + 2]];
          const ink = px.some((v, k) => Math.abs(v - bg[k]) > 60);
          if (ink) far.push(px);
        }
        return far;
      }, { b64: shot.toString('base64'), bg: theme === 'light' ? [255, 255, 255] : [0, 0, 0] });
      assert.ok(colours.length > 20, `${theme} ${path}: icon pixels found`);
      // Anti-aliased edges blend the theme colour with the background, so they stay grey: no pixel may carry a hue,
      // and the strongest pixel is the theme colour itself.
      const hued = colours.filter((px: number[]) => Math.max(...px) - Math.min(...px) > 40);
      assert.deepEqual(hued.slice(0, 3), [], `${theme} ${path}: ${hued.length}/${colours.length} pixels carry a colour`);
      const strongest = colours.reduce((m: number[], px: number[]) => (Math.abs(px[0] - rgb[0]) < Math.abs(m[0] - rgb[0]) ? px : m));
      assert.ok(strongest.every((v: number, k: number) => Math.abs(v - rgb[k]) <= 16), `${theme} ${path}: strongest pixel ${strongest} is ${rgb}`);
    }
    await context.close();
  }
});

test('the navbar destinations are unchanged in the header and in the navigation sheet', { skip }, async () => {
  const { context, page } = await open('/api/');
  // Reading order of the two header rows (canary step 5a): logo and account actions, then the section tabs.
  assert.deepEqual(await page.$$eval('header.navbar a', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href'))), ['/', ...NAV.slice(4), ...NAV.slice(0, 4)]);
  const ext = await page.$$eval('header.navbar a[target]', (as: HTMLAnchorElement[]) => as.map((a) => [a.getAttribute('href'), a.target, a.rel]));
  // Release Notes is the docs' own /changelog/ (openspec docs-live-catalog), so only the account actions open apertis.ai.
  assert.deepEqual(ext, NAV.slice(4).map((h) => [h, ...EXT]));
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
  assert.deepEqual(islands, ['NavSheet']);
  const hydrated = await page.$$eval('header.navbar, .hero, .providers, .models, .model-card, .start, .start-item, .latest, .release-row, footer.footer, .ask-docs-trigger, #apertis-assistant', (els: Element[]) =>
    els.filter((e) => e.closest('astro-island') || e.querySelector('astro-island')).map((e) => e.className));
  assert.deepEqual(hydrated, []);
  const served = new Set(manifest().documents.filter((d) => d.eligibility.publish).map((d) => d.servedPath));
  const internal = await page.$$eval('main a[href^="/"], footer a[href^="/"], header a[href^="/"]', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href')!));
  // The homepage body links each internal destination once: the quick start, the start items and the blog.
  const body = await page.$$eval('main a[href^="/"]', (as: HTMLAnchorElement[]) => as.map((a) => a.getAttribute('href')!));
  assert.deepEqual(body.sort(), ['/api', '/billing/subscription-plans', '/blog/', '/getting-started/quick-start/', '/installation/claude-code', '/installation/models', '/installation/scripts', '/intro']);
  // /blog/ is the articles index and /changelog/ the release notes (openspec docs-live-catalog), not manifest
  // documents; both are always served.
  for (const href of internal) assert.ok(href === '/blog/' || href === '/changelog/' || served.has(href.endsWith('/') ? href : `${href}/`), `${href} is not a published route`);
  assert.equal((await page.request.get(base + '/blog/')).status(), 200);
  assert.equal((await page.request.get(base + '/changelog/')).status(), 200);
  // The legacy feature-card destinations stay on the homepage (the Playground is gone, 2026-10-03), with SDKs.
  const features = await page.$$eval('main a.feature-card', (as: HTMLAnchorElement[]) => as.map((a) => [a.getAttribute('href'), a.target, a.rel].join(' ')));
  assert.deepEqual(features.sort(), ['/intro', '/installation/models', '/api', '/installation/claude-code', '/installation/scripts', '/billing/subscription-plans'].map((f) => `${f}  `).sort());
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
    // Under the pointer an item has the fill only: no ring and no side bar (operator review 2026-10-03).
    await page.hover('[role="menu"] [role="menuitem"]:nth-of-type(3)');
    const hovered = await page.$eval('[role="menu"] [role="menuitem"]:hover', (el: HTMLElement) => [getComputedStyle(el).boxShadow, getComputedStyle(el, '::before').content]);
    assert.deepEqual(hovered, ['none', 'none'], `${theme}: hovered menu item ${hovered}`);
    await context.close();
  }
});

test('keyboard focus is visible (>= 3:1) on header buttons, a model card and the search field (light)', { skip }, async () => {
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
  for (const sel of ['.navbar__right [data-theme-toggle]', '.navbar__login', '.navbar__signup', '.model-card']) {
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

test('one search control on the homepage (canary step 5b reverses step 1): the header search, as on every page; the hero has none; Cmd/Ctrl+K opens search', { skip }, async () => {
  for (const view of [VIEWS[1440], VIEWS[1024]]) {
    const { context, page } = await open('/', view);
    assert.equal(await page.isVisible('.navbar__search'), true, `header search on / at ${JSON.stringify(view)}`);
    assert.equal(await page.locator('[data-open-surface="search"]:visible').count(), 1, 'exactly one visible search control on the homepage');
    assert.equal(await page.locator('main [data-open-surface="search"]').count(), 0, 'no search control in the homepage body');
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('dialog[open] #aa-q').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'aa-q');
    await context.close();
    const other = await open('/getting-started/quick-start/', view);
    assert.equal(await other.page.isVisible('.navbar__search'), true, 'document pages keep the header search');
    await other.context.close();
  }
});

test('homepage link labels use sentence case (canary step 2): only the first word and proper nouns are capitalized', { skip }, async () => {
  const { context, page } = await open('/');
  // A "Start building" item is checked by its title (its line is a sentence). Model cards and release-note
  // rows are not our labels: they come verbatim from the model catalog and apertis.ai/changelog.
  const labels: string[] = await page.$$eval('main a:not(.release-row):not(.model-card)', (as: HTMLAnchorElement[]) => as.flatMap((a) =>
    [a.querySelector('[data-slot="item-title"]') ?? a]
      .map((e) => e.textContent!.replace(/\s+/g, ' ').trim())).filter(Boolean));
  const proper = new Set(['API', 'SDK', 'Python', 'Claude', 'Code', 'Cursor', 'Cline', 'Messages', 'OpenAI', 'Anthropic', 'Apertis', 'Node.js', 'cURL']);
  const offenders = labels.filter((l) => l.split(' ').slice(1).some((w) => /^[A-Z]/.test(w) && !proper.has(w)));
  assert.deepEqual(offenders, [], 'labels with a capitalized non-initial word');
  assert.ok(labels.includes('Get started') && labels.includes('API reference') && labels.includes('Plans and billing') && labels.includes('Visit the blog'), `labels ${JSON.stringify(labels)}`);
  await context.close();
});

test('document pages are centred beyond the frame width (canary step 3): at 1920 the header, grid and footer share edges and equal side margins', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/', { viewport: { width: 1920, height: 1080 } });
  const e = await page.evaluate(() => {
    const r = (el: Element) => el.getBoundingClientRect();
    const link = document.querySelector('.doc-page__sidebar .sidebar__link')!;
    const range = document.createRange();
    range.selectNodeContents(link);
    const toc = document.querySelector('.doc-page__toc')!;
    const row = [...document.querySelector('.navbar__inner')!.children].filter((c) => (c as HTMLElement).offsetParent);
    const sidebar = r(document.querySelector('.doc-page__sidebar')!);
    return {
      logo: r(document.querySelector('.navbar .brand')!).left,
      sidebarText: range.getBoundingClientRect().left,
      headerRight: r(row[row.length - 1]).right,
      tocRight: r(toc).right - parseFloat(getComputedStyle(toc).paddingRight),
      frameLeft: sidebar.left,
      frameRight: r(toc).right,
      footerLeft: r(document.querySelector('footer .shell-container')!).left,
      // The laid-out width: the root reserves a stable scrollbar gutter, which headless Chrome's hidden scrollbars
      // leave out of clientWidth.
      width: document.body.getBoundingClientRect().width,
    };
  });
  assert.ok(Math.abs(e.logo - e.sidebarText) <= 1, `logo ${e.logo} vs sidebar text ${e.sidebarText}`);
  assert.ok(Math.abs(e.headerRight - e.tocRight) <= 1, `header right ${e.headerRight} vs TOC content right ${e.tocRight}`);
  assert.ok(Math.abs(e.footerLeft - e.frameLeft) <= 1, `footer left ${e.footerLeft} vs frame left ${e.frameLeft}`);
  assert.ok(Math.abs(e.frameLeft - (e.width - e.frameRight)) <= 2, `side margins ${e.frameLeft} vs ${e.width - e.frameRight}`);
  assert.ok(e.frameLeft > 200, `the frame is centred, not left-anchored (left ${e.frameLeft})`);
  await context.close();
});

test('page actions follow the Claude Docs pattern (canary step 4): one bordered split button in the title row on desktop, after the meta row on mobile; menu items carry a title and a description', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/', VIEWS[1440]);
  await page.locator('.page-actions[data-ready]').waitFor();
  const d = await page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const cs = (s: string) => getComputedStyle(document.querySelector(s)!);
    const h1 = r('.doc-header h1'), split = r('.page-actions__split'), art = document.querySelector('.docs-content')!;
    const artRight = art.getBoundingClientRect().right - parseFloat(getComputedStyle(art).paddingRight);
    return {
      h1Mid: h1.top + h1.height / 2, splitMid: split.top + split.height / 2, splitRight: split.right, artRight,
      groupBorder: cs('.page-actions__split').borderTopWidth, primaryBorder: cs('.page-actions__primary').borderTopWidth, toggleBorder: cs('.page-actions__toggle').borderTopWidth,
      divider: cs('.page-actions__toggle').borderLeftWidth,
      heights: [r('.page-actions__primary').height, r('.page-actions__toggle').height],
      label: document.querySelector('[data-copy-label]')!.textContent,
    };
  });
  assert.ok(Math.abs(d.h1Mid - d.splitMid) <= 12, `split button sits in the title row (h1 mid ${d.h1Mid}, split mid ${d.splitMid})`);
  assert.ok(Math.abs(d.splitRight - d.artRight) <= 1, `split button ends at the content edge (${d.splitRight} vs ${d.artRight})`);
  assert.equal(d.groupBorder, '1px', 'the group carries the one outer border');
  assert.deepEqual([d.primaryBorder, d.toggleBorder], ['0px', '0px'], 'the halves have no outer border of their own');
  assert.equal(d.divider, '1px', 'a hairline divides the halves');
  assert.equal(d.heights[0], d.heights[1], 'both halves have the same height');
  assert.equal(d.label, 'Copy page');
  await page.click('.page-actions__toggle');
  const items = await page.$$eval('[role=menu] [role=menuitem]', (els: HTMLElement[]) => els.map((e): [string | null | undefined, string | null | undefined] => [e.querySelector('[data-item-title]')?.textContent, e.querySelector('[data-item-desc]')?.textContent]));
  assert.ok(items.length >= 6 && items.every(([t, s]: (string | null | undefined)[]) => t && s), `every menu item has a title and a description: ${JSON.stringify(items)}`);
  // The AI tools carry their brand marks from lobe icons (static SVG, as stima-api's public pages).
  const marks = await page.$$eval('[role=menu] a[data-action]', (as: HTMLAnchorElement[]) => Object.fromEntries(as.map((a) => [a.dataset.action, a.querySelector('.page-actions__icon svg title')?.textContent ?? null])));
  assert.deepEqual([marks.claude, marks.chatgpt, marks.cursor], ['Claude', 'OpenAI', 'Cursor']);
  // A status message floats over the description as an opaque card (canary: it overlapped the text).
  await page.keyboard.press('Escape');
  const status = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.page-actions__status')!;
    el.textContent = 'Copying is blocked in this browser. Use View as Markdown to open the file instead.';
    el.dataset.state = 'error';
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, position: cs.position, right: el.getBoundingClientRect().right, split: document.querySelector('.page-actions__split')!.getBoundingClientRect().right };
  });
  assert.equal(status.position, 'absolute');
  assert.ok(!/rgba\(0, 0, 0, 0\)|transparent/.test(status.bg), `status card is opaque: ${status.bg}`);
  assert.equal(Math.round(status.right), Math.round(status.split), 'status card aligns to the button edge');
  await context.close();
  const m = await open('/getting-started/quick-start/', VIEWS[390]);
  await m.page.locator('.page-actions[data-ready]').waitFor();
  const order = await m.page.evaluate(() => [document.querySelector('.doc-meta')!.getBoundingClientRect().bottom, document.querySelector('.page-actions__split')!.getBoundingClientRect().top]);
  assert.ok(order[1] >= order[0], `mobile: page actions after the meta row (${order})`);
  await m.context.close();
});

test('two-row header and LINE Seed display face (canary step 5a): search on the right beside the theme switch, section tabs under the logo, the current tab underlined; titles in LINE Seed 400', { skip }, async () => {
  const { context, page } = await open('/getting-started/quick-start/', VIEWS[1440]);
  await page.evaluate(() => document.fonts.ready);
  const h = await page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const inner = document.querySelector('.navbar__inner')!;
    const cs = getComputedStyle(inner);
    const ib = inner.getBoundingClientRect();
    const tabs = [...document.querySelectorAll<HTMLAnchorElement>('.navbar__tabs .navbar__links a')];
    const active = document.querySelector('.navbar__tabs a.active')!;
    const h1 = getComputedStyle(document.querySelector('.docs-content h1')!);
    const h2 = getComputedStyle(document.querySelector('.docs-content h2')!);
    return {
      header: r('.navbar').height, top: r('.navbar__inner').bottom, tabsTop: r('.navbar__tabs').top,
      tabs: tabs.map((a) => a.getAttribute('href')), active: active.getAttribute('href'), underline: getComputedStyle(active).boxShadow,
      firstTab: tabs[0].getBoundingClientRect().left, brand: r('.navbar .brand').left,
      search: [r('.navbar__search').left, r('.navbar__search').right], theme: r('.navbar__right [data-theme-toggle]').left, centre: (ib.left + parseFloat(cs.paddingLeft) + ib.right - parseFloat(cs.paddingRight)) / 2,
      searchBorder: getComputedStyle(document.querySelector('.navbar__search')!).borderTopWidth,
      h1: [h1.fontFamily, h1.fontWeight], h2: [h2.fontFamily, h2.fontWeight],
      loaded: document.fonts.check('400 16px "LINE Seed"'),
      faces: performance.getEntriesByType('resource').filter((e) => /LINESeed/.test(e.name)).map((e) => (e as PerformanceResourceTiming).encodedBodySize || (e as PerformanceResourceTiming).transferSize),
    };
  });
  assert.equal(h.header, 100);
  assert.ok(h.tabsTop >= h.top, `tabs are a second row (${h.tabsTop} vs ${h.top})`);
  assert.deepEqual(h.tabs, NAV.slice(0, 4));
  assert.equal(h.active, '/intro');
  assert.match(h.underline, /inset 0px -2px 0px|0px -2px 0px 0px inset/, `current tab underlined: ${h.underline}`);
  assert.ok(Math.abs(h.firstTab - h.brand) <= 1, `tabs start at the logo edge (${h.firstTab} vs ${h.brand})`);
  // Operator review 2026-10-03: the centred search field was abrupt; it is a quiet borderless pill in the right cluster.
  assert.ok(h.search[0] > h.centre && h.search[1] <= h.theme && h.theme - h.search[1] <= 16, `search sits right, before the theme switch (${h.search} / ${h.theme})`);
  assert.equal(h.searchBorder, '0px');
  for (const [family, weight] of [h.h1, h.h2]) {
    assert.match(family, /^"?LINE Seed"?,/);
    assert.equal(weight, '400', 'display text is never faux-bolded');
  }
  assert.ok(h.loaded, 'LINE Seed loaded');
  assert.equal(h.faces.length, 1, `one LINE Seed file (the Latin subset): ${h.faces}`);
  // A hash link lands below the taller header.
  await page.goto(base + '/getting-started/quick-start/#prerequisites', { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const land = await page.evaluate(() => [document.getElementById('prerequisites')!.getBoundingClientRect().top, document.querySelector('.navbar')!.getBoundingClientRect().bottom]);
  assert.ok(land[0] >= land[1], `anchor heading ${land[0]} is not under the header (${land[1]})`);
  await context.close();
  const m = await open('/getting-started/quick-start/', VIEWS[390]);
  const phone = await m.page.evaluate(() => ({ header: document.querySelector('.navbar')!.getBoundingClientRect().height, tabs: getComputedStyle(document.querySelector('.navbar__tabs')!).display }));
  assert.deepEqual(phone, { header: 57, tabs: 'none' }, 'one header row on a phone; the tabs live in the navigation sheet');
  await m.context.close();
});

// The homepage as the build renders it (the live feed blocked), and after the swap script refills it from a feed.
const feedFixture = (snapshot: { notes: ReleaseNote[]; models: NewModel[] }) => ({
  notes: [{ version: '9.9.9', date: '2026-12-01', title: 'Models Added', description: 'Add <b>Test</b> Model' }, ...snapshot.notes.slice(0, 2)],
  models: [{ id: 'test/model 1', name: 'Test Model', provider: 'Testers', category: 'voice', context: null, added: '2026-12-01', description: '' } as NewModel, ...snapshot.models.slice(0, 5)],
  total: 400, providers: 40,
});

test('calm homepage (2026-10-03, after the OpenAI developers, Claude docs and claude.dev homepages): a left-aligned hero with one primary action and the providers, the newest models and release notes from the feed, unbordered start items, the blog beside the release notes, no repeated destination, no code sample', { skip }, async () => {
  const snapshot = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/home/home-feed.json'), 'utf8'));
  const context = await browser.newContext(VIEWS[1440]);
  await context.route('**/_nimbus/home-feed', (route: { abort: () => Promise<void> }) => route.abort());
  const page = await context.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const h = await page.evaluate(() => {
    const hero = document.querySelector('.hero')!;
    const title = hero.querySelector('h1')!;
    const main = document.querySelector('main')!;
    const link = (a: Element) => [a.textContent!.trim(), a.getAttribute('href'), (a as HTMLAnchorElement).target, (a as HTMLAnchorElement).rel];
    return {
      title: [getComputedStyle(title).fontFamily, getComputedStyle(title).fontWeight, getComputedStyle(title).textAlign],
      left: [title, document.querySelector('.navbar .brand')!].map((e) => Math.round(e.getBoundingClientRect().left)),
      heroActions: [...hero.querySelectorAll('a, button, input')].map(link),
      providers: [...hero.querySelectorAll('.providers li:not(.providers__more)')].map((li) => [li.textContent!.trim(), !!li.querySelector('svg'), li.querySelectorAll('a').length]),
      eyebrows: main.querySelectorAll('.eyebrow, .hero__eyebrow').length,
      code: main.querySelectorAll('pre, code').length,
      primary: [...main.querySelectorAll('[data-slot="button"][data-variant="default"]')].map((b) => [b.textContent!.trim(), b.getAttribute('href')]),
      hrefs: [...main.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!),
      providersMore: document.querySelector('.providers__more')?.textContent,
      total: document.querySelector('[data-feed-total]')?.textContent,
      blog: [...main.querySelectorAll('.latest h3')].map((h3) => h3.textContent),
      items: [...main.querySelectorAll('.start a[data-slot="item"]')].map((a) => ({
        href: a.getAttribute('href'), title: a.querySelector('[data-slot="item-title"]')?.textContent?.trim(),
        line: a.querySelector('[data-slot="item-description"]')?.textContent?.trim(), icon: !!a.querySelector('[data-slot="item-media"] svg'),
        border: ['top', 'right', 'bottom', 'left'].some((side) => { const cs = getComputedStyle(a); return parseFloat(cs.getPropertyValue(`border-${side}-width`)) > 0 && cs.getPropertyValue(`border-${side}-color`) !== 'rgba(0, 0, 0, 0)'; }),
      })),
    };
  });
  assert.match(h.title[0], /^"?LINE Seed"?,/);
  assert.deepEqual(h.title.slice(1), ['400', 'start'], 'display face, weight 400, left-aligned');
  assert.equal(h.left[0], h.left[1], 'the title starts at the logo edge');
  assert.deepEqual(h.heroActions, [['Get started', '/getting-started/quick-start/', '', ''], ['Create an API key', 'https://apertis.ai/setting?tab=keys', ...EXT]], 'the hero holds the primary action and the console');
  assert.ok(h.providers.length >= 6 && h.providers.every(([name, svg, links]: [string, boolean, number]) => name && svg && links === 0), `providers ${JSON.stringify(h.providers)}`);
  assert.equal(h.eyebrows, 0, 'no eyebrows');
  assert.equal(h.code, 0, 'no code sample on the homepage (the Quick Start page has it)');
  assert.deepEqual(h.primary, [['Get started', '/getting-started/quick-start/']], 'exactly one primary action');
  assert.deepEqual(h.hrefs.filter((x: string, i: number) => h.hrefs.indexOf(x) !== i), [], 'no destination repeated in the body');
  assert.deepEqual(await page.evaluate(homeFeedRows), [snapshot.models.map(modelView), snapshot.notes.map(noteView)].map(rowsOf), 'the build renders the committed feed');
  assert.deepEqual([h.total, h.providersMore], [String(snapshot.total), `and ${snapshot.providers - 8} more`]);
  assert.deepEqual(h.blog, ['Release notes', 'From the blog']);
  assert.equal(h.items.length, 6);
  for (const it of h.items) assert.ok(it.title && it.line && it.icon && !it.border, JSON.stringify(it));
  for (const it of h.items.filter((x: { href: string }) => x.href.startsWith('/'))) {
    const res = await page.request.get(base + it.href);
    assert.equal(res.status(), 200, `${it.href} is published`);
  }
  await context.close();
});

test('the homepage swaps in the live feed after load: rows refilled from /_nimbus/home-feed, text never parsed as HTML, empty fields hidden; a failing feed keeps the build copy', { skip }, async () => {
  const snapshot = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../src/components/home/home-feed.json'), 'utf8'));
  const feed = feedFixture(snapshot);
  const context = await browser.newContext(VIEWS[1440]);
  await context.route('**/_nimbus/home-feed', (route: { fulfill: (r: object) => Promise<void> }) => route.fulfill({ json: feed }));
  const page = await context.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.locator('.model-card__name', { hasText: 'Test Model' }).waitFor();
  assert.deepEqual(await page.evaluate(homeFeedRows), [feed.models.map(modelView), feed.notes.map(noteView)].map(rowsOf));
  assert.equal(await page.locator('.release-row b').count(), 0, 'upstream text is text');
  const emptyShown = () => document.querySelectorAll('[data-feed] [data-f]:not([data-f="href"])').values().filter((e) => !e.textContent!.trim() && (e as HTMLElement).checkVisibility()).toArray().length;
  assert.equal(await page.evaluate(emptyShown), 0, 'no empty badge or line is shown');
  assert.deepEqual(await page.evaluate(() => [document.querySelector('[data-feed-total]')!.textContent, document.querySelector('.providers__more')!.textContent]), ['400', 'and 32 more']);
  await context.close();
  const failing = await browser.newContext(VIEWS[1440]);
  await failing.route('**/_nimbus/home-feed', (route: { fulfill: (r: object) => Promise<void> }) => route.fulfill({ status: 502, json: { error: 'feed unavailable' } }));
  const p2 = await failing.newPage();
  await p2.goto(base + '/', { waitUntil: 'networkidle' });
  assert.deepEqual(await p2.evaluate(homeFeedRows), [snapshot.models.map(modelView), snapshot.notes.map(noteView)].map(rowsOf));
  await failing.close();
});

test('UX canary 2026-10-03: opaque header, no shift when search opens, Ask Docs makes room on wide screens, focus never lands on <body>, empty blog not indexed', { skip }, async () => {
  // The header hides what scrolls under it.
  const { context, page } = await open('/', VIEWS[1440]);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.navbar')!).backgroundColor);
  assert.match(bg, /^rgb\(/, `opaque header background: ${bg}`);
  // Opening the modal search locks scrolling without moving the page under it.
  await page.evaluate(() => scrollTo(0, 600));
  const brand = () => page.evaluate(() => document.querySelector('.navbar .brand')!.getBoundingClientRect().left);
  const before = await brand();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'search' } })));
  await page.locator('dialog[open] #aa-q').waitFor();
  assert.equal(await brand(), before, 'the page does not shift when the search dialog opens');
  await page.keyboard.press('Escape');
  // At 1440 the panel docks over the page; the page keeps its layout.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'ask' } })));
  await page.locator('dialog[open] #aa-question').waitFor();
  assert.equal(await brand(), before, 'at 1440 the docked panel does not move the page');
  await context.close();
  // At 1920 the open panel takes its own column: no model card lies under it, and closing restores the layout.
  const wide = await open('/', { viewport: { width: 1920, height: 1000 } });
  const left = await wide.page.evaluate(() => document.querySelector('.navbar .brand')!.getBoundingClientRect().left);
  await wide.page.click('.ask-docs-trigger');
  await wide.page.locator('dialog[open] #aa-question').waitFor();
  await wide.page.waitForTimeout(400);
  const under = await wide.page.evaluate(() => {
    const p = document.getElementById('apertis-assistant')!.getBoundingClientRect();
    return [...document.querySelectorAll('.model-card, .navbar__right')].filter((e) => e.getBoundingClientRect().right > p.left).length;
  });
  assert.equal(under, 0, 'nothing lies under the open panel at 1920');
  await wide.page.click('#aa-close');
  await wide.page.waitForTimeout(400);
  assert.equal(await wide.page.evaluate(() => document.querySelector('.navbar .brand')!.getBoundingClientRect().left), left, 'closing restores the layout');
  assert.equal(await wide.page.evaluate(() => document.activeElement?.className.includes('ask-docs-trigger')), true, 'focus returns to the trigger');
  // A panel restored on page load has no opener: closing it focuses the trigger, not <body>.
  await wide.page.click('.ask-docs-trigger');
  await wide.page.locator('dialog[open] #aa-question').waitFor();
  await wide.page.reload({ waitUntil: 'load' });
  await wide.page.locator('dialog[open] #aa-question').waitFor();
  await wide.page.click('#aa-close');
  assert.equal(await wide.page.evaluate(() => document.activeElement?.className.includes('ask-docs-trigger')), true, 'restored panel: focus goes to the trigger');
  // The empty /blog/ index asks not to be indexed; real pages do not.
  await wide.page.goto(base + '/blog/', { waitUntil: 'load' });
  assert.equal(await wide.page.getAttribute('meta[name="robots"]', 'content'), 'noindex');
  await wide.page.goto(base + '/getting-started/quick-start/', { waitUntil: 'load' });
  assert.equal(await wide.page.$('meta[name="robots"]'), null);
  await wide.context.close();
});

test('UX canary round 2: no junk search hits, Ask Docs says what it does and that it is working, Clear chat keeps focus, a phone does not reopen the sheet, the 404 page has the site shell', { skip }, async () => {
  // A nonsense query is "No results", not single-letter fragments that only share a letter with it.
  const { context, page } = await open('/getting-started/quick-start/', VIEWS[1440]);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'search' } })));
  await page.locator('dialog[open] #aa-q').fill('zzqqxx');
  await page.getByText(/No results for/).waitFor({ timeout: 5000 });
  await page.keyboard.press('Escape');
  // An empty conversation explains itself; a pending answer shows that it is being worked on.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('apertis-docs:open', { detail: { surface: 'ask' } })));
  await page.locator('dialog[open] #aa-question').waitFor();
  const before = (sel: string) => page.evaluate((s: string) => getComputedStyle(document.querySelector(s)!, '::before').content, sel);
  assert.match(await before('.aa-messages'), /Ask about setup/);
  await page.evaluate(() => {
    const m = Object.assign(document.createElement('div'), { className: 'aa-msg' });
    m.dataset.role = 'assistant';
    m.dataset.state = 'streaming';
    document.querySelector('.aa-messages')!.append(m);
  });
  assert.match(await before('.aa-msg[data-state="streaming"]'), /Searching the docs/);
  await context.close();
  // Clear chat hides itself and leaves focus in the question field.
  const chat = await browser.newContext(VIEWS[1440]);
  await chat.addInitScript(() => {
    sessionStorage.setItem('askai_session_id', 'canary');
    sessionStorage.setItem('askdocs_messages_canary', JSON.stringify([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello', state: 'done' }]));
  });
  const p = await chat.newPage();
  await p.goto(base + '/getting-started/quick-start/', { waitUntil: 'load' });
  await p.click('.ask-docs-trigger');
  await p.click('#aa-clear');
  assert.equal(await p.evaluate(() => document.activeElement?.id), 'aa-question');
  await chat.close();
  // On a phone the sheet covers the page: it opens on request, not again on every navigation.
  const phone = await open('/getting-started/quick-start/', VIEWS[390]);
  await phone.page.click('.ask-docs-trigger');
  await phone.page.locator('dialog[open] #aa-question').waitFor();
  await phone.page.reload({ waitUntil: 'load' });
  await phone.page.waitForTimeout(300);
  assert.equal(await phone.page.$('dialog[open] #aa-question'), null, 'the sheet stays closed after navigation');
  await phone.context.close();
  // An unknown path answers 404 with the header (search), footer and a way back, and is not indexed.
  const lost = await open('/', VIEWS[1440]);
  const res = await lost.page.goto(base + '/no-such-page/', { waitUntil: 'load' });
  assert.equal(res.status(), 404);
  assert.equal(await lost.page.textContent('h1'), 'Page not found');
  for (const sel of ['.navbar', 'footer', 'main a[href="/"]', 'main [data-open-surface="search"]']) assert.ok(await lost.page.$(sel), `404 page has ${sel}`);
  assert.equal(await lost.page.getAttribute('meta[name="robots"]', 'content'), 'noindex');
  assert.equal(await lost.page.$('link[rel="canonical"]'), null, 'no canonical on the 404 page');
  await lost.context.close();
});
