#!/usr/bin/env node
// refund-policy-v2 consistency check (apertis-ai/docs#39; inventory in docs-internal/audits/refund-policy-v2.md).
// For the four current billing/help carriers it checks, in the canonical source, both generated mirrors and,
// when site-nimbus/dist exists, the built HTML, served Markdown and llms-full.txt:
//   - every required statement is present (source -> generated parity of the policy text),
//   - no superseded promise is left (case-by-case, old review times, self-service immediate cancel, 3-day window,
//     fixed outage multipliers),
//   - no TODO(refund-policy-v2) marker is left: the candidate copy fails here until the reviewed legal source lands.
// Archived carriers (the 2026-04-24 changelog notice, the cutover snapshot) are never scanned; the check only asserts
// the archived notice is still there. Byte-level mirror parity stays with test/m2-convert.test.ts.
// Usage: node scripts/nimbus/refund-policy-check.mjs [repo root]   (exit 1 on any failure)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../..'));

const EXCEPTIONS = [
  'The law that applies to your purchase gives you a right to cancel or to a refund.',
  'A written contract between you and Apertis provides for a refund.',
  'The purchase was made under an earlier version of the Refund Policy that still applies to it.',
  'We verify a duplicate charge, a charge for the wrong amount, or a charge you did not authorize.',
  'We verify a significant failure of the Apertis service, or of your access to it, that prevented you from using what you paid for.',
  'Apertis ended your service for a reason other than your breach of the terms, and prepaid service was left undelivered.',
];
const POLICY = [
  ...EXCEPTIONS,
  'Sending a request does not mean it is approved.',
  'Promotional, bonus and account credits are not paid out in cash.',
  'Regional rights.',
  'the 14-day right of withdrawal for consumers in the EEA and the UK',
  'the corresponding rules in Turkey',
  "Korea's rules (a full refund of an unused purchase within 7 days, and otherwise a refund in proportion to the remaining period)",
  'the rules of Taiwan or another jurisdiction where they give you more',
  'not only on your IP address or card country',
  'There is no fixed service-extension rate.',
  "it applies only after at least 30 days' notice",
  'Earlier purchases keep the refund terms that applied when you made them.',
  'Do not send your full card number or card security code (CVC)',
  'We aim to send a first response within 3 business days.',
];

const PAGES = [
  { id: 'billing/payg', required: [
    'Top-ups are non-refundable once paid, including any balance you have not used.',
    'There is no general refund window',
    ...POLICY,
    // Unchanged non-refund terms (issue how 10).
    'Balance never expires and remains available until used.',
    'No minimum balance is required, but we recommend maintaining at least $5 for uninterrupted service.',
  ] },
  { id: 'billing/subscription-plans', required: [
    'Subscription payments are non-refundable once paid, including the first payment, renewals and upgrades',
    'There is no general refund window',
    ...POLICY,
    'Cancelling stops the next renewal.',
    'stays active until the end of the period you have already paid for',
    'Cancelling is not a refund',
    'Cancelling your subscription does not turn it off, and turning it off does not cancel your subscription.',
    '3-7 days to resolve payment issue',
  ] },
  { id: 'billing/payment-methods', required: [
    'Turning off Auto Top-Up stops future automatic charges only.',
    'Top-ups and subscription payments are non-refundable once paid, including unused balance or quota, and there is no general refund window.',
    'Do not send your full card number or card security code (CVC)',
    'We aim to send a first response within 3 business days',
  ] },
  { id: 'help/faq', required: [
    'Top-ups and subscription payments are non-refundable once paid, including unused balance or quota, and there is no general refund window.',
    'for a verified duplicate, incorrect or unauthorized charge',
    'regional consumer rights',
    'Do not send your full card number or CVC.',
    'We aim to send a first response within 3 business days.',
  ] },
];

const FORBIDDEN = [
  [/TODO\(refund-policy-v2\)/, 'unresolved TODO(refund-policy-v2) marker: reviewed legal source not applied'],
  [/case[- ]by[- ]case/i, 'case-by-case refund wording'],
  [/5-7 business days|5-10 business days/i, 'superseded review/processing time'],
  [/\bImmediate\b[^.\n]*Ends now/i, 'self-service immediate cancellation (not offered)'],
  [/\b(3|three)[- ](calendar[- ])?days?\b[^.\n]*refund|refund[^.\n]*\b(3|three)[- ](calendar[- ])?days?\b/i, 'three-day refund window'],
  [/twice the interruption|three times the interruption|\b[23]x\b[^.\n]*(extension|outage)/i, 'fixed outage extension multiplier'],
];

const ARCHIVE = [['site-nimbus/src/components/catalog/changelog.json', 'you may cancel your subscription at any time before 2026-04-24 00:00 UTC']];

const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const fromHtml = (html) => decode((html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? html).replace(/<[^>]+>/g, ' '));
// Markdown emphasis and code spans are not part of a statement; whitespace is normalized everywhere.
const norm = (s) => s.replace(/\*\*|`/g, '').replace(/\s+/g, ' ');

const failures = [];
const checked = [];
const distDir = path.join(root, 'site-nimbus/dist');
const hasDist = fs.existsSync(distDir);
const llmsFull = hasDist ? fs.readFileSync(path.join(distDir, 'llms-full.txt'), 'utf8') : null;

for (const page of PAGES) {
  const carriers = [
    [`docs/${page.id}.md`, (s) => s],
    [`site-nimbus/src/content/docs/${page.id}/index.md`, (s) => s],
    [`site-nimbus/src/content/public/${page.id}.md`, (s) => s],
    ...(hasDist ? [[`site-nimbus/dist/${page.id}/index.html`, fromHtml], [`site-nimbus/dist/${page.id}.md`, (s) => s]] : []),
  ];
  const texts = carriers.map(([rel, view]) => [rel, norm(view(fs.readFileSync(path.join(root, rel), 'utf8')))]);
  if (llmsFull) {
    // Pages may contain their own `---` rules, so an entry ends at the next Source line, not at a separator.
    const start = llmsFull.indexOf(`Source: https://docs.apertis.ai/${page.id}\n`);
    const end = llmsFull.indexOf('\nSource: https://', start + 1);
    texts.push([`site-nimbus/dist/llms-full.txt (${page.id})`, start < 0 ? '' : norm(llmsFull.slice(start, end < 0 ? undefined : end))]);
  }
  for (const [rel, text] of texts) {
    checked.push(rel);
    if (!text) failures.push(`${rel}: page not found`);
    for (const phrase of page.required) if (!text.includes(norm(phrase))) failures.push(`${rel}: missing "${phrase}"`);
    for (const [re, why] of FORBIDDEN) if (re.test(text)) failures.push(`${rel}: ${why}: "${text.match(re)[0]}"`);
  }
}
for (const [rel, phrase] of ARCHIVE) {
  if (!fs.readFileSync(path.join(root, rel), 'utf8').includes(phrase)) failures.push(`${rel}: archived notice changed or removed`);
}

console.log(`refund-policy-check: ${checked.length} current carriers${hasDist ? '' : ' (site-nimbus/dist not built: HTML, served .md and llms-full.txt skipped)'}, ${ARCHIVE.length} archived kept`);
for (const f of failures) console.log(`FAIL ${f}`);
console.log(failures.length ? `refund-policy-check: ${failures.length} failure(s)` : 'refund-policy-check: ok');
process.exit(failures.length ? 1 : 0);
