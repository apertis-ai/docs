import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_ROOTS = ['docs', 'docs-api', 'src'];
const SOURCE_FILES = ['docusaurus.config.js'];
const SOURCE_EXTENSIONS = new Set(['.md', '.mdx', '.js', '.jsx', '.ts', '.tsx']);

function collectFiles(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) return [relativePath];

  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) return collectFiles(child);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [child] : [];
  });
}

const files = [...SOURCE_FILES, ...SOURCE_ROOTS.flatMap(collectFiles)];
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

for (const file of files) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const { label, pattern } of forbidden) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const line = content.slice(0, match.index).split('\n').length;
      failures.push(`${file}:${line}: ${label}: ${match[0]}`);
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

if (failures.length > 0) {
  console.error('Developer activation content check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Developer activation content check passed across ${files.length} active source files.`);
