// The "Was this page helpful?" widget (openspec docs-reader-shell-extras "Page feedback") in a real
// browser (system Chrome via Playwright), against a running `npm run preview`. Run it twice, once per
// server configuration (the same pattern as m3-browser.test.ts):
//   PREVIEW_URL=http://127.0.0.1:8807 FEEDBACK_EXPECT=sent  PLAYWRIGHT=<path>/playwright/index.mjs node --test test/feedback-browser.test.ts
//     (preview started with --d1 FEEDBACK_DB=<id>, schema applied)
//   PREVIEW_URL=http://127.0.0.1:8807 FEEDBACK_EXPECT=error PLAYWRIGHT=<path>/playwright/index.mjs node --test test/feedback-browser.test.ts
//     (preview started with no --d1 at all, so the endpoint answers 503)
// Skipped when PREVIEW_URL, PLAYWRIGHT or FEEDBACK_EXPECT is unset, so `npm test` stays browser-free.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.PREVIEW_URL?.replace(/\/$/, '');
const expect = process.env.FEEDBACK_EXPECT;
const skip = !base || !process.env.PLAYWRIGHT || !expect ? 'set PREVIEW_URL, PLAYWRIGHT and FEEDBACK_EXPECT=sent|error' : false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browser: any;
before(async () => {
  if (skip) return;
  const { chromium } = await import(process.env.PLAYWRIGHT!);
  browser = await chromium.launch({ channel: 'chrome' });
});
after(async () => browser?.close());

// The spec scenario "Reader answers": No and a comment.
test('No, a comment and Send show the confirmation (sent) or the error (no binding)', { skip }, async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(e.message));
  await page.goto(`${base}/intro/`, { waitUntil: 'load' });

  const section = page.locator('.page-feedback');
  await page.waitForFunction(() => !document.querySelector('.page-feedback')?.hasAttribute('hidden'));
  assert.equal(await section.getAttribute('hidden'), null, 'the widget is revealed once the script runs');

  await section.getByRole('button', { name: 'No', exact: true }).click();
  assert.equal(await section.getByRole('button', { name: 'No', exact: true }).getAttribute('aria-pressed'), 'true');
  const textarea = section.locator('textarea');
  await textarea.fill('a browser-check comment');
  await section.getByRole('button', { name: 'Send' }).click();

  const status = section.locator('.page-feedback__status');
  await page.waitForFunction(() => (document.querySelector('.page-feedback__status')?.textContent ?? '').length > 0);
  const text = (await status.textContent())!;
  if (expect === 'sent') {
    assert.match(text, /Thanks for the feedback/);
    assert.equal(await status.getAttribute('data-state'), 'ok');
    // On success the form that held focus (Send) is hidden; focus must move to the status, never drop to <body>
    // (the repo's own UX canary: "focus never lands on <body>").
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'P');
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.page-feedback__status')), true);
  } else {
    assert.match(text, /Feedback was not sent/);
    assert.equal(await status.getAttribute('data-state'), 'error');
  }
  assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'BODY');
  assert.deepEqual(errors, []);

  // Hidden in print (packet D's print stylesheet is not in this tree yet; its own rules can extend this).
  await page.emulateMedia({ media: 'print' });
  assert.equal(await section.isVisible(), false, '[data-feedback] is display:none under @media print');
  await page.emulateMedia({ media: 'screen' });

  await context.close();
});
