// #8 reading layout (openspec docs-shell-interfaces "Reading layout and page header", Contrast scenario):
// parse the colour tokens in src/styles/tokens.css and compute WCAG 2 contrast ratios in both themes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const styles = path.resolve(import.meta.dirname, '../src/styles');
const css = fs.readFileSync(path.join(styles, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Custom properties declared in the first block whose selector is exactly `selector`. */
function block(selector: string): Record<string, string> {
  const m = new RegExp(`(?:^|})\\s*${selector.replace(/[[\]()'.*]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(m, `no ${selector} block in tokens.css`);
  return Object.fromEntries([...m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]));
}
const light = block(':root');
const dark = { ...light, ...block("[data-theme='dark']") };

function rgb(value: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  assert.ok(hex, `expected a #rrggbb colour, got ${value}`);
  return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as [number, number, number];
}
const luminance = (c: [number, number, number]) => {
  const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(rgb(a)), luminance(rgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const RULES: [fg: string, bg: string, min: number][] = [
  ['--ink', '--bg', 7], // headings
  ['--body', '--bg', 7], // article prose
  ['--body', '--card', 7], // prose on cards, dialogs and sheets
  ['--desc', '--bg', 7], // page-header description ("muted but 7:1")
  ['--body', '--panel', 7], // table cells and admonition text
  ['--muted', '--bg', 4.5], // labels, meta, sidebar and TOC entries
  ['--muted', '--panel', 4.5],
  ['--muted', '--card', 4.5],
  ['--muted', '--hover', 4.5], // a muted label on a hovered or selected row
  ['--link', '--bg', 4.5],
  ['--link', '--panel', 4.5],
  ['--link', '--card', 4.5],
  ['--teal', '--bg', 4.5], // link hover and active states
  ['--teal', '--card', 4.5],
  ['--primary-fg', '--primary', 4.5], // Create account and other primary actions (inverted neutral fill)
  ['--error', '--bg', 4.5],
  ['--error', '--card', 4.5],
  ...['note', 'tip', 'info', 'warning', 'danger'].map((t) => [`--adm-${t}`, '--panel', 4.5] as [string, string, number]),
];

for (const [name, theme] of [['light', light], ['dark', dark]] as const) {
  test(`${name} theme: body text >= 7:1, muted text, labels and links >= 4.5:1`, () => {
    const report = RULES.map(([fg, bg, min]) => {
      assert.ok(theme[fg] && theme[bg], `${name}: ${fg} or ${bg} is not defined`);
      return { pair: `${fg} on ${bg}`, ratio: Math.round(contrast(theme[fg], theme[bg]) * 100) / 100, min };
    });
    assert.deepEqual(report.filter((r) => r.ratio < r.min), [], `${name}: ${JSON.stringify(report)}`);
  });
}

// Palette as revised on 2026-09-29 (#4): neutral surfaces replace the warm paper. A channel spread of at
// most 2 is grey; white cards on a near-white page in light, near-black in dark.
const neutral = ([r, g, b]: [number, number, number]) => Math.max(r, g, b) - Math.min(r, g, b) <= 2;
test('surfaces are neutral and light by default; dark only through [data-theme=dark], never prefers-color-scheme', () => {
  for (const t of ['--bg', '--card', '--panel', '--ink', '--body', '--desc', '--muted', '--line', '--hover', '--primary']) {
    assert.ok(neutral(rgb(light[t])), `light ${t} ${light[t]} is not neutral`);
    assert.ok(neutral(rgb(dark[t])), `dark ${t} ${dark[t]} is not neutral`);
  }
  assert.ok(luminance(rgb(light['--bg'])) > 0.9 && light['--card'].toLowerCase() === '#ffffff', `light --bg ${light['--bg']} / --card ${light['--card']}`);
  assert.ok(luminance(rgb(dark['--bg'])) < 0.02, `dark --bg ${dark['--bg']} is not a near-black`);
  // Inverted neutral primary: dark on light, light on dark.
  assert.ok(luminance(rgb(light['--primary'])) < 0.02 && luminance(rgb(dark['--primary'])) > 0.9, 'primary is not an inverted neutral fill');
  for (const f of fs.readdirSync(styles)) assert.doesNotMatch(fs.readFileSync(path.join(styles, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), /prefers-color-scheme/, f);
});
