// Route/anchor/redirect fixtures for the Docusaurus -> Nimbus migration (issue #5).
//
//   node scripts/nimbus/route-fixtures.mjs snapshot <baseUrl> <paths.txt>   > snapshot.json
//   node scripts/nimbus/route-fixtures.mjs check    <baseUrl> [--scope poc] [fixtures.json]
//
// `snapshot` records what a deployment actually serves. `check` asserts the frozen
// fixtures (status, redirect target, canonical, critical anchors) against any base URL,
// so the same file gates the legacy build, a Nimbus candidate, or production.
import fs from 'node:fs';
import crypto from 'node:crypto';

const DEFAULT_FIXTURES = new URL('../../migration/nimbus/route-fixtures.json', import.meta.url);

async function get(url) {
  const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'apertis-docs-route-fixtures' } });
  const body = res.status >= 300 && res.status < 400 ? '' : await res.text();
  return { status: res.status, location: res.headers.get('location'), type: res.headers.get('content-type'), body };
}

const attr = (html, re) => html.match(re)?.[1] ?? null;

function facts(html) {
  const article = html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? '';
  const text = article.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    title: attr(html, /<title[^>]*>([^<]*)<\/title>/),
    canonical: [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((t) => /\brel=["']?canonical\b/.test(t)).map((t) => t.match(/\bhref=["']([^"']+)/)?.[1])[0] ?? null,
    robots: attr(html, /<meta[^>]+name="robots"[^>]+content="([^"]+)"/),
    headingIds: [...article.matchAll(/<h[1-6][^>]*\bid="([^"]+)"/g)].map((m) => m[1]),
    links: [...new Set([...article.matchAll(/<a[^>]+href="([^"#][^"]*)"/g)].map((m) => m[1]))].sort(),
    images: [...new Set([...article.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]))].sort(),
    articleSha256: article ? crypto.createHash('sha256').update(text).digest('hex') : null,
  };
}

async function snapshot(base, pathsFile) {
  const paths = fs.readFileSync(pathsFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const path of paths) {
    const r = await get(base + path);
    const row = { path, status: r.status, location: r.location, contentType: r.type };
    let page = r;
    if (r.location && r.status >= 300 && r.status < 400) {
      const target = new URL(r.location, base + path);
      if (target.origin === new URL(base).origin) {
        page = await get(target.href);
        row.final = { path: target.pathname, status: page.status };
      }
    }
    if (page.status === 200 && page.type?.includes('text/html')) Object.assign(row, facts(page.body));
    const toggled = path === '/' ? null : path.endsWith('/') ? path.slice(0, -1) : path + '/';
    if (toggled) {
      const t = await get(base + toggled);
      row.slashVariant = { path: toggled, status: t.status, location: t.location };
    }
    out.push(row);
  }
  console.log(JSON.stringify(out, null, 2));
}

async function check(base, fixturesFile, scope) {
  const data = JSON.parse(fs.readFileSync(fixturesFile, 'utf8'));
  const routes = data.routes.filter((f) => scope !== 'poc' || f.scope === 'poc');
  const pocRoutes = data.pocRoutes ?? [];
  const coverageLimits = data.pocCoverageLimits ?? [];
  const failures = [];
  for (const f of routes) {
    const r = await get(base + f.path);
    const where = `${f.path}`;
    if (r.status !== f.status) { failures.push(`${where}: status ${r.status}, expected ${f.status}`); continue; }
    if (f.location !== undefined) {
      const loc = r.location && new URL(r.location, base + f.path).pathname;
      if (loc !== f.location) failures.push(`${where}: redirects to ${loc}, expected ${f.location}`);
    }
    if (f.status !== 200 || !r.type?.includes('text/html')) continue;
    const got = facts(r.body);
    if (f.canonical && got.canonical !== f.canonical) failures.push(`${where}: canonical ${got.canonical}, expected ${f.canonical}`);
    // Any element with the id satisfies a fragment link, whatever the candidate's markup.
    const ids = new Set([...r.body.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
    for (const id of f.anchors ?? []) if (!ids.has(id)) failures.push(`${where}: missing anchor #${id}`);
    if (scope === 'poc' && f.pocLinks) {
      const allowed = new Set([...pocRoutes, ...coverageLimits]);
      for (const href of got.links) {
        if (!href.startsWith('/')) continue;
        const p = href.replace(/[?#].*$/, '').replace(/(.)\/$/, '$1');
        if (!allowed.has(p) && !p.startsWith('/cdn-cgi/')) failures.push(`${where}: links to ${p}, which is neither a PoC route nor a recorded coverage limit`);
      }
    }
  }
  for (const line of failures) console.error(`- ${line}`);
  const failed = new Set(failures.map((l) => l.split(':')[0]));
  console.log(`${routes.length - failed.size}/${routes.length} route fixtures without failure against ${base} (${failures.length} failures)`);
  if (scope === 'poc') console.log(`PoC coverage limits (out-of-set link targets, resolved by #13): ${coverageLimits.length}`);
  process.exit(failures.length ? 1 : 0);
}

const args = process.argv.slice(2);
const scopeAt = args.indexOf('--scope');
const scope = scopeAt >= 0 ? args.splice(scopeAt, 2)[1] : 'full';
const [mode, base, file] = args;
if (mode === 'snapshot' && base && file) await snapshot(base.replace(/\/$/, ''), file);
else if (mode === 'check' && base) await check(base.replace(/\/$/, ''), file ?? DEFAULT_FIXTURES, scope);
else { console.error('usage: route-fixtures.mjs snapshot <baseUrl> <paths.txt> | check <baseUrl> [--scope poc] [fixtures.json]'); process.exit(2); }
