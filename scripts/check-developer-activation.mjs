import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_ROOTS = ['docs', 'docs-api', 'src'];
const SOURCE_FILES = ['docusaurus.config.js', 'sidebars.js', 'sidebarsApi.js'];
const SOURCE_EXTENSIONS = new Set(['.md', '.mdx', '.js', '.jsx', '.ts', '.tsx']);

function collectFiles(relativePath, extensions = SOURCE_EXTENSIONS) {
  const absolutePath = path.join(ROOT, relativePath);
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) return [relativePath];

  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) return collectFiles(child, extensions);
    return extensions.has(path.extname(entry.name)) ? [child] : [];
  });
}

// Nimbus candidate (issue #12). Scanned in addition to, never instead of, the legacy roots above.
// Present whenever site-nimbus/ exists: its source (including the generated content collection and
// the clean Markdown artifacts under src/content/), its config, and the navigation labels it renders
// from the route inventory and manifest. The built output is scanned when a build exists.
const CANDIDATE = 'site-nimbus';
const CANDIDATE_ROOTS = [`${CANDIDATE}/src`];
const CANDIDATE_FILES = [`${CANDIDATE}/astro.config.ts`, `${CANDIDATE}/nimbus.json`];
const CANDIDATE_EXTENSIONS = new Set([...SOURCE_EXTENSIONS, '.astro', '.json']);
const CANDIDATE_DIST = `${CANDIDATE}/dist`;
const DIST_EXTENSIONS = new Set(['.md', '.html', '.txt', '.xml']);
const hasCandidate = fs.existsSync(path.join(ROOT, CANDIDATE));

const candidateFiles = !hasCandidate ? [] : [
  ...CANDIDATE_FILES.filter((file) => fs.existsSync(path.join(ROOT, file))),
  ...CANDIDATE_ROOTS.flatMap((root) => collectFiles(root, CANDIDATE_EXTENSIONS)),
  ...(fs.existsSync(path.join(ROOT, CANDIDATE_DIST)) ? collectFiles(CANDIDATE_DIST, DIST_EXTENSIONS) : []),
];

// Rendered navigation labels: sidebar labels and category trails from the inventory, and document
// titles from the manifest (the label fallback). Each is scanned as its own line of text.
function navigationLabels() {
  if (!hasCandidate) return [];
  const texts = [];
  const inventoryFile = 'migration/nimbus/route-inventory.json';
  for (const route of JSON.parse(fs.readFileSync(path.join(ROOT, inventoryFile), 'utf8')).routes) {
    for (const label of [route.sidebar?.label, ...(route.sidebar?.trail ?? [])]) {
      if (typeof label === 'string') texts.push({ where: `${inventoryFile} ${route.path} sidebar label`, content: label });
    }
  }
  const manifestFile = `${CANDIDATE}/src/manifest/manifest.json`;
  for (const doc of JSON.parse(fs.readFileSync(path.join(ROOT, manifestFile), 'utf8')).documents) {
    texts.push({ where: `${manifestFile} ${doc.id} title`, content: doc.title });
  }
  return texts;
}

const files = [...SOURCE_FILES, ...SOURCE_ROOTS.flatMap((root) => collectFiles(root)), ...candidateFiles];
const failures = [];
const forbidden = [
  {
    label: 'legacy API-key route',
    pattern: /apertis\.ai\/token\b/g,
  },
  {
    label: 'legacy API-key settings tab',
    pattern: /https:\/\/apertis\.ai\/setting\?tab=apikeys\b/g,
  },
  {
    label: 'owned-surface acquisition UTM',
    pattern: /https:\/\/apertis\.ai\/[^\s)'"<>]*[?&]utm_(?:source|medium|campaign|term|content)=/g,
  },
  {
    label: 'fixed model-count claim',
    pattern: /\b\d{2,4}\+\s+(?:AI\s+)?models\b/gi,
  },
];

const texts = [
  ...files.map((file) => ({ where: file, content: fs.readFileSync(path.join(ROOT, file), 'utf8') })),
  ...navigationLabels(),
];

for (const { where, content } of texts) {
  for (const { label, pattern } of forbidden) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const line = content.slice(0, match.index).split('\n').length;
      failures.push(`${where}:${line}: ${label}: ${match[0]}`);
    }
  }
}

function requireText(file, values) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const value of values) {
    if (!content.includes(value)) {
      failures.push(`${file}: missing required activation content: ${value}`);
    }
  }
}

requireText('docs/getting-started/quick-start.md', [
  'https://apertis.ai/register',
  'https://apertis.ai/subscribe',
  'https://apertis.ai/setting?tab=credits',
  'https://apertis.ai/setting?tab=keys',
  'https://apertis.ai/setting?tab=activity',
  'successful response',
  'matching Activity record',
]);

requireText('docusaurus.config.js', [
  'https://apertis.ai/register',
  'https://apertis.ai/login',
]);

const QUICK_START_ACTIVATION = [
  'https://apertis.ai/register',
  'https://apertis.ai/subscribe',
  'https://apertis.ai/setting?tab=credits',
  'https://apertis.ai/setting?tab=keys',
  'https://apertis.ai/setting?tab=activity',
  'successful response',
  'matching Activity record',
];

if (hasCandidate) {
  // The converted Quick Start keeps the activation path, in its render source and its clean Markdown.
  requireText(`${CANDIDATE}/src/content/docs/getting-started/quick-start/index.md`, QUICK_START_ACTIVATION);
  requireText(`${CANDIDATE}/src/content/public/getting-started/quick-start.md`, QUICK_START_ACTIVATION);
  const builtQuickStart = `${CANDIDATE_DIST}/getting-started/quick-start.md`;
  if (fs.existsSync(path.join(ROOT, builtQuickStart))) requireText(builtQuickStart, QUICK_START_ACTIVATION);
  // The candidate shell keeps the visible Create account link next to Log in.
  const shell = candidateFiles.filter((file) => file.endsWith('.astro'))
    .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
  for (const value of ['https://apertis.ai/register', 'https://apertis.ai/login']) {
    if (!shell.includes(value)) failures.push(`${CANDIDATE}/src/**/*.astro: missing required activation content: ${value}`);
  }
  // When built, every rendered navbar (<header>) carries both links, and the home page renders one.
  // ponytail: dist/404.html renders no shell at all, so it has no navbar to check.
  for (const file of candidateFiles.filter((f) => f.startsWith(CANDIDATE_DIST) && f.endsWith('.html'))) {
    const header = fs.readFileSync(path.join(ROOT, file), 'utf8').match(/<header\b[\s\S]*?<\/header>/)?.[0];
    if (header === undefined && file !== `${CANDIDATE_DIST}/index.html`) continue;
    for (const value of ['https://apertis.ai/register', 'https://apertis.ai/login']) {
      if (!header?.includes(value)) failures.push(`${file} navbar: missing required activation content: ${value}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Developer activation content check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Developer activation content check passed across ${files.length} active source files${hasCandidate ? ` (${candidateFiles.length} candidate files, ${navigationLabels().length} navigation labels)` : ''}.`);
