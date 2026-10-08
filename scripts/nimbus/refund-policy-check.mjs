#!/usr/bin/env node
// refund-policy-v2 consistency check (apertis-ai/docs#39; inventory in docs-internal/audits/refund-policy-v2.md).
// For the four current billing/help carriers it checks, in the canonical source, both generated mirrors and,
// when site-nimbus/dist exists, the built HTML, served Markdown and llms-full.txt:
//   - every required statement is present: the docs quote the reviewed legal source verbatim (LEGAL below),
//   - no superseded promise is left (case-by-case, old review times, self-service immediate cancel, 3-day window,
//     fixed outage multipliers, the phase C candidate wording, a dated /refund link),
//   - no TODO(refund-policy-v2*) marker is left: the dates of v2 are not decided, so the copy fails here until they are.
// Archived carriers (the 2026-04-24 changelog notice, the cutover snapshot) are never scanned; the check only asserts
// the archived notice is still there. Byte-level mirror parity stays with test/m2-convert.test.ts.
//
// Usage: node scripts/nimbus/refund-policy-check.mjs [repo root] [--legal-fixture <refund-policy-v2.lines.json>]
// With --legal-fixture (theQuert/stima-api web/next/__tests__/fixtures/refund-policy-v2.lines.json) it also proves the
// fixture is the pinned one and that every LEGAL statement is text of it. Exit 1 on any failure.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const fixtureAt = args.indexOf('--legal-fixture');
const fixturePath = fixtureAt >= 0 ? args.splice(fixtureAt, 2)[1] : null;
const root = path.resolve(args[0] ?? path.join(import.meta.dirname, '../..'));

// The reviewed legal source (gate C4): theQuert/stima-api branch claude/3632-refund-legal-surfaces at
// ae6a66c3ac6c9ad57a513eb50060581f6fc8e224, openspec/changes/refund-policy-v2-surfaces/legal-source-handoff.md.
const LEGAL_SOURCE = {
  id: 'refund-policy-v2',
  head: 'ae6a66c3ac6c9ad57a513eb50060581f6fc8e224',
  enMarkdownSha256: '6c436066924c35e4deea784058fb2f2bf3290f9032187dc62f552ab599113bfd',
  enSourceSha256: '0dcc668cac2d50cb76efab3da95c8f716322f119c381e283388beb80d1416350',
  fixtureSha256: '76c746f6e9b2acc3fae96757aa872d3ea226d3241bbc4183b38b7e835ae8c30d',
};

// Verbatim text of the legal source, by section. Each is a substring of one fixture line.
const COVERS = [ // Section 1
  'New purchases made after this version is published and shown to you before you pay.',
  'Automatic subscription renewals and automatic credit top-ups charged after you have been notified of this version at least 30 days in advance, or any longer period required by law or by your agreement with us.',
  'Purchases made earlier, quotes you accepted, payments already in progress and rights you already obtained continue to be governed by the version that applied to them.',
  'Where it is unclear which version applies to a transaction, we review the request instead of applying this version by default.',
];
const GENERAL = [ // Section 2
  'Payments for the following are non-refundable, including when the credits or quota they provide have not been used:',
  'API credit top-ups, whether purchased manually or by automatic top-up.',
  'Subscription payments: initial purchases, renewals and upgrades.',
  'On-demand or additional usage charges.',
  'Changing your mind, an accidental or impulse purchase, forgetting to cancel, or general dissatisfaction is not, by itself, a ground for a refund. This policy does not offer a general refund window, such as a number of days after payment within which any purchase may be refunded.',
];
const EXCEPTIONS = [ // Section 3
  'You may request a refund, and we will review the request, where:',
  'Applicable law gives you a right to a refund or to withdraw from the purchase (see Section 4).',
  'A written agreement with us provides for a refund.',
  'An earlier version of this policy applies to the transaction and provides for a refund.',
  'You were charged twice for the same purchase, or charged an amount different from the one shown to you, and we verify the error.',
  "A payment was made without the account holder's authorization. Usage made with an API key that was leaked or compromised remains the account holder's responsibility under the Terms of Service, but a payment you did not authorize is reviewed under this section.",
  'A material failure of Apertis systems prevented you from accessing or using the service you paid for, and we verify it (see Section 7).',
  'We end your access to prepaid service that has not yet been delivered, for a reason other than your breach of the Terms of Service.',
  'A request is not an approval. Dissatisfaction with outputs the service produced as described is not a service failure. A service that was not provided, or that was materially different from its description, is not treated as a change of mind.',
];
const REGIONAL = [ // Section 4
  'Mandatory consumer protection law that cannot be waived by contract prevails over this policy.',
  'Depending on the product, whether you buy as a consumer or as a business, the law that applies, and any consent or information the law requires, such rights may include withdrawal or cooling-off periods and refund rules, for example in the European Economic Area, the United Kingdom, Turkey, South Korea and Taiwan.',
  'These examples do not state which law applies to a particular transaction. We do not decide this from your IP address or card country alone; where applicability is unclear, we review the request.',
  'Where the law requires a full refund, we do not deduct usage or elapsed time. Where the law allows a deduction, we deduct only what the law allows.',
  'A request is not refused only because a period mentioned in an example has passed; it is reviewed against the law that applies.',
  'Rights that the law gives only to consumers may not apply to purchases made for a business. A written agreement with a business customer takes precedence over this policy, subject to mandatory law.',
];
const CANCEL = [ // Section 5
  'You may cancel a subscription at any time from your account Settings. Cancellation stops the next renewal.',
  'Your subscription remains active until the end of the period you have already paid for, as shown in your account. Cancellation does not, by itself, refund any part of that period.',
  'If a payment was already in progress when you cancel, we check the status of that original payment; we do not charge it again.',
  'We do not require you to contact us or take extra steps to cancel.',
];
const AUTO_TOPUP = ['Turning off automatic top-up stops future automatic top-ups only. It is separate from your subscription, and changing one does not change the other.'];
const INTERRUPTIONS = [ // Section 7
  'This version does not provide a fixed service extension or multiple of an interruption period.',
  'For a verified incident, remedies follow applicable law and any written service level or other agreement with you. A material failure may also be a ground for a refund under Section 3.',
  'Obligations that arose under an earlier version of this policy, for the transactions or incidents it covers, are kept.',
  'Where the law gives you a cash remedy, we do not require you to accept credit instead.',
];
const PAID = [ // Section 9
  'Approved refunds are returned to the original payment method.',
  'A refund is limited to the cash actually paid for the transaction, less any amount already refunded for it. Credits, bonuses and account credit are not converted to cash.',
  'When the money reaches you depends on your payment provider. As a guide: credit cards 7–14 business days after the refund is issued; electronic payments such as Apple Pay or Google Pay 7–14 business days; other payment methods up to 30 business days. A refund we have issued has not necessarily reached your account yet.',
];
const REQUEST = [ // Section 10
  'The email address of your Apertis account.',
  'The transaction: an invoice or receipt number, or the date and amount of the charge.',
  'The reason for the request and any information that supports it.',
  'Never send a full card number or card security code (CVC). We will not ask for them.',
  'We record the time we receive your request. That time, not the time we finish reviewing it, is the one that counts for any deadline.',
  'We aim to send an initial response within 3 business days. This is a response target; it does not shorten or extend any right or deadline you have.',
];
const LEGAL = [...COVERS, ...GENERAL, ...EXCEPTIONS, ...REGIONAL, ...CANCEL, ...AUTO_TOPUP, ...INTERRUPTIONS, ...PAID, ...REQUEST];

// Docs-only statements: the current-policy link (never a dated path) and the request address.
const LINK = 'The full Refund Policy is at https://apertis.ai/refund.';
// Gate C5 (lead, 2026-10-08): the date for new manual purchases; automatic charges stay on the earlier version
// until a separate notice, so no date is given for them. Founder confirmation happens in review.
const APPLIES = 'This version of the Refund Policy applies to new manual purchases made from October 12, 2026, when it is shown to you before you pay. Automatic subscription renewals and automatic credit top-ups remain under the earlier version; they are covered by this version only after a separate email notice at least 30 days in advance.';
const EMAIL = 'Email hi@apertis.ai with:';
const FULL = [APPLIES, LINK, ...COVERS, ...GENERAL, ...EXCEPTIONS, ...REGIONAL, ...INTERRUPTIONS, ...PAID, EMAIL, ...REQUEST];
const SHORT = [APPLIES, LINK, ...COVERS, ...GENERAL, 'in the cases listed in Section 3 of the Refund Policy', EMAIL, ...REQUEST];

const PAGES = [
  { id: 'billing/payg', required: [...FULL,
    // Unchanged non-refund terms (issue how 10).
    'Balance never expires and remains available until used.',
    'No minimum balance is required, but we recommend maintaining at least $5 for uninterrupted service.',
  ] },
  { id: 'billing/subscription-plans', required: [...FULL, ...CANCEL, ...AUTO_TOPUP, '3-7 days to resolve payment issue'] },
  { id: 'billing/payment-methods', required: [...SHORT, ...AUTO_TOPUP] },
  { id: 'help/faq', required: SHORT },
];

const FORBIDDEN = [
  [/TODO\(refund-policy-v2-date\)/, 'unresolved TODO(refund-policy-v2-date): announcement, notice and effective dates not decided'],
  [/TODO\(refund-policy-v2\)/, 'unresolved TODO(refund-policy-v2) marker'],
  [/case[- ]by[- ]case/i, 'case-by-case refund wording'],
  [/5-7 business days|5-10 business days/i, 'superseded review/processing time'],
  [/\bImmediate\b[^.\n]*Ends now/i, 'self-service immediate cancellation (not offered)'],
  [/\b(3|three)[- ](calendar[- ])?days?\b[^.\n]*refund|refund[^.\n]*\b(3|three)[- ](calendar[- ])?days?\b/i, 'three-day refund window'],
  [/twice the interruption|three times the interruption|\b[23]x\b[^.\n]*(extension|outage)/i, 'fixed outage extension multiplier'],
  [/14-day right of withdrawal|unused purchase within 7 days|We aim to send a first response/, 'phase C candidate wording, superseded by the legal source'],
];

const ARCHIVE = [['site-nimbus/src/components/catalog/changelog.json', 'you may cancel your subscription at any time before 2026-04-24 00:00 UTC']];

const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
// The page body only: the site Footer links ${site}/refund on every page, so it must not satisfy a link check.
const articleOf = (html) => html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? '';
const fromHtml = (html) => decode(articleOf(html).replace(/<[^>]+>/g, ' '));
// Checked on the raw carrier (Markdown link targets, HTML hrefs), which the text view drops.
const DATED_LINK = /(?:apertis\.ai)?\/(?:ja\/)?refund\/\d{4}-\d{2}-\d{2}/;
// Markdown link syntax, emphasis and code spans are not part of a statement; whitespace is normalized everywhere, and
// a space the HTML view leaves before punctuation (a closed tag) is dropped.
const norm = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').replace(/ ([.,;:)])/g, '$1');

const failures = [];
const checked = [];

if (fixturePath) {
  const bytes = fs.readFileSync(fixturePath);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sha !== LEGAL_SOURCE.fixtureSha256) failures.push(`${fixturePath}: sha256 ${sha} is not the pinned ${LEGAL_SOURCE.fixtureSha256}`);
  const fixture = JSON.parse(bytes.toString('utf8'));
  if (fixture.candidate !== LEGAL_SOURCE.id) failures.push(`${fixturePath}: candidate ${fixture.candidate}`);
  const lines = fixture.en.map((l) => l.replace(/^\w+: /, '').replace(/ <[^>]+>/g, ''));
  for (const s of [...LEGAL, EMAIL]) if (!lines.some((l) => l.includes(s))) failures.push(`legal source: "${s}" is not text of the fixture`);
}
const fixtureFailures = failures.length;

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
  const raw = new Map(carriers.map(([rel]) => [rel, fs.readFileSync(path.join(root, rel), 'utf8')]));
  const texts = carriers.map(([rel, view]) => [rel, norm(view(raw.get(rel)))]);
  if (llmsFull) {
    // Pages may contain their own `---` rules, so an entry ends at the next Source line, not at a separator.
    const start = llmsFull.indexOf(`Source: https://docs.apertis.ai/${page.id}\n`);
    const end = llmsFull.indexOf('\nSource: https://', start + 1);
    const entry = start < 0 ? '' : llmsFull.slice(start, end < 0 ? undefined : end);
    raw.set(`site-nimbus/dist/llms-full.txt (${page.id})`, entry);
    texts.push([`site-nimbus/dist/llms-full.txt (${page.id})`, norm(entry)]);
  }
  for (const [rel, text] of texts) {
    checked.push(rel);
    if (!text) failures.push(`${rel}: page not found`);
    for (const phrase of page.required) if (!text.includes(norm(phrase))) failures.push(`${rel}: missing "${phrase}"`);
    const body = rel.endsWith('.html') ? articleOf(raw.get(rel)) : raw.get(rel);
    if (!body.includes(rel.endsWith('.html') ? 'href="https://apertis.ai/refund"' : '](https://apertis.ai/refund)')) failures.push(`${rel}: Refund Policy is not linked to https://apertis.ai/refund`);
    if (DATED_LINK.test(body)) failures.push(`${rel}: dated Refund Policy link (link /refund only): "${body.match(DATED_LINK)[0]}"`);
    for (const [re, why] of FORBIDDEN) if (re.test(text)) failures.push(`${rel}: ${why}: "${text.match(re)[0]}"`);
  }
}
for (const [rel, phrase] of ARCHIVE) {
  if (!fs.readFileSync(path.join(root, rel), 'utf8').includes(phrase)) failures.push(`${rel}: archived notice changed or removed`);
}

console.log(`refund-policy-check: legal source ${LEGAL_SOURCE.id} @ ${LEGAL_SOURCE.head.slice(0, 9)} (EN markdown ${LEGAL_SOURCE.enMarkdownSha256.slice(0, 8)}…)${fixturePath ? `, fixture ${fixtureFailures ? 'NOT verified' : 'verified'}` : ', fixture not given'}`);
console.log(`refund-policy-check: ${checked.length} current carriers${hasDist ? '' : ' (site-nimbus/dist not built: HTML, served .md and llms-full.txt skipped)'}, ${ARCHIVE.length} archived kept`);
for (const f of failures) console.log(`FAIL ${f}`);
console.log(failures.length ? `refund-policy-check: ${failures.length} failure(s)` : 'refund-policy-check: ok');
process.exit(failures.length ? 1 : 0);
