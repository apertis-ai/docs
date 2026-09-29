// Playwright shim for the Nimbus browser checks (issue #12). measure.mjs, m3-browser and m4-e2e load
// `import(process.env.PLAYWRIGHT)` and launch `{ channel: 'chrome' }` (system Chrome, the recorded
// baseline harness). Point PLAYWRIGHT at this file to choose the browser without touching them:
//
//   PLAYWRIGHT_MODULE=<absolute path to playwright/index.mjs>   the real Playwright (required)
//   PLAYWRIGHT_CHANNEL=chrome | msedge | ... | bundled          `bundled` = Playwright's own Chromium
//                                                             `chromium` = its full Chromium, new headless
//
// Unset PLAYWRIGHT_CHANNEL keeps each caller's channel. Only `channel` changes; every other launch
// option and all measurement code stay the callers'.
const real = process.env.PLAYWRIGHT_MODULE;
if (!real) throw new Error('set PLAYWRIGHT_MODULE to the absolute path of playwright/index.mjs');
const playwright = await import(real);
const wanted = process.env.PLAYWRIGHT_CHANNEL;

const launch = (options = {}) => {
  if (!wanted) return options;
  const { channel, ...rest } = options;
  return wanted === 'bundled' ? rest : { ...rest, channel: wanted };
};

export const chromium = new Proxy(playwright.chromium, {
  get(target, key) {
    if (key === 'launch') return (options) => target.launch(launch(options));
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
export const { firefox, webkit, devices, errors, selectors, request } = playwright;
export default { ...playwright, chromium };
