// Runs functions/blog/[[path]].ts in workerd (Miniflare, as wrangler does), so HTMLRewriter is the real one.
// The function is bundled the way Pages bundles it (esbuild, the `workerd` / `worker` / `browser` conditions) and
// driven through its `handler` with stubs: the static responses come from `statics` (by path, the 404 page for any
// other), the API answers from `upstream` (by URL; a URL it lacks is a network failure), and the edge cache is a map
// that records every key it is asked to store. Not a test file itself: test/blog-articles.test.ts uses it.
import path from 'node:path';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

export interface Upstream { status?: number; body: unknown; /** Never answers; rejects only when the request's signal aborts. */ hang?: boolean }
export interface Scenario {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  statics: Record<string, string>;
  upstream?: Record<string, Upstream>;
  /** Edge cache entries already stored, by key. */
  cache?: Record<string, string>;
}
export interface Outcome {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** Every URL the function fetched from the API. */
  calls: string[];
  /** Every key the function stored in the edge cache. */
  puts: string[];
  logs: string[];
}

const ENTRY = `
import { handler, loopback } from ${JSON.stringify(path.resolve(import.meta.dirname, '../../functions/blog/[[path]].ts'))};
export default {
  async fetch(req) {
    const s = await req.json();
    if (s.loopback) return Response.json(s.loopback.map((v) => loopback(v ?? undefined)));
    const calls = [], puts = [], logs = [], pending = [];
    const store = new Map(Object.entries(s.cache ?? {}));
    const key = (k) => (typeof k === 'string' ? k : k.url);
    const cache = {
      match: async (k) => (store.has(key(k)) ? new Response(store.get(key(k))) : undefined),
      put: async (k, r) => { puts.push(key(k)); store.set(key(k), await r.text()); },
    };
    const fetcher = async (input, init) => {
      const u = typeof input === 'string' ? input : input.url;
      calls.push(u);
      const a = (s.upstream ?? {})[u];
      if (!a) throw new TypeError('network connection lost');
      if (a.hang) return new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal.reason)));
      return new Response(typeof a.body === 'string' ? a.body : JSON.stringify(a.body), { status: a.status ?? 200, headers: { 'content-type': 'application/json' } });
    };
    const asset = (input) => {
      const p = new URL(typeof input === 'string' ? input : input.url, 'https://docs.example').pathname;
      const found = Object.hasOwn(s.statics, p);
      return new Response(found ? s.statics[p] : s.statics['404'], {
        status: found ? 200 : 404,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate', ...(found ? { etag: '"static"' } : {}) },
      });
    };
    const res = await handler({ fetch: fetcher, cache, log: (...a) => logs.push(a.join(' ')) })({
      request: new Request('https://docs.example' + s.path, { method: s.method ?? 'GET', headers: s.headers }),
      next: async (input) => asset(input ?? s.path),
      env: { ASSETS: { fetch: async (input) => asset(input) } },
      waitUntil: (p) => { pending.push(p); },
    });
    const body = await res.text();
    await Promise.all(pending);
    return Response.json({ status: res.status, headers: Object.fromEntries(res.headers), body, calls, puts, logs });
  },
};
`;

export async function edge() {
  const out = await build({
    stdin: { contents: ENTRY, resolveDir: import.meta.dirname, loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'neutral', target: 'es2022',
    conditions: ['workerd', 'worker', 'browser'], mainFields: ['module', 'main'], logLevel: 'silent',
  });
  const mf = new Miniflare({ modules: true, script: out.outputFiles[0].text, compatibilityDate: '2024-01-01' });
  return {
    async run(s: Scenario): Promise<Outcome> {
      const res = await mf.dispatchFetch('http://edge.test/', { method: 'POST', body: JSON.stringify(s) });
      if (res.status !== 200) throw new Error(`edge harness: HTTP ${res.status}: ${await res.text()}`);
      return res.json() as Promise<Outcome>;
    },
    /** The function's `loopback` over each value (null stands for undefined). */
    async loopback(values: (string | null)[]): Promise<(string | null)[]> {
      const res = await mf.dispatchFetch('http://edge.test/', { method: 'POST', body: JSON.stringify({ loopback: values }) });
      return res.json() as Promise<(string | null)[]>;
    },
    dispose: () => mf.dispose(),
  };
}
