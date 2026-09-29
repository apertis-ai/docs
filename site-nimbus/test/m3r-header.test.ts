// #8 reading layout: how the page header takes its H1 and one-sentence description from the body.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { displayDate, pageHeaderParts } from '../src/components/shell/page-header.ts';

const H1 = '<h1 id="quick-start">Quick Start</h1>';

test('a lead paragraph gives its first sentence to the header, and the body keeps only the rest', () => {
  const r = pageHeaderParts(`${H1}\n<p>Get going in <a href="/x">five</a> minutes. Then e.g. call it. Done.</p>\n<h2 id="a">A</h2>`);
  assert.equal(r.h1, H1);
  assert.deepEqual(r.description, { html: 'Get going in <a href="/x">five</a> minutes.', indexed: true });
  assert.equal(r.body, '\n<p>Then e.g. call it. Done.</p>\n<h2 id="a">A</h2>');
});

test('a one-sentence lead moves entirely; a period inside inline markup does not split', () => {
  const r = pageHeaderParts(`${H1}<p>Use <code>a. b</code> with <strong>v1.2 now. ok</strong> today</p><p>Next.</p>`);
  assert.deepEqual(r.description, { html: 'Use <code>a. b</code> with <strong>v1.2 now. ok</strong> today', indexed: true });
  assert.equal(r.body, '<p>Next.</p>');
});

test('a body that opens with code copies the first paragraph sentence, kept out of the index', () => {
  const body = '<pre class="astro-code"><code><span>{"a": 1}. </span></code></pre><aside><p>Inside.</p></aside><p><img src="/i.png" alt=""></p><p>Real text. More.</p>';
  const r = pageHeaderParts(`${H1}${body}`);
  assert.deepEqual(r.description, { html: 'Real text.', indexed: false });
  assert.equal(r.body, body);
});

test('front-matter description wins and leaves the body alone; no prose means no description', () => {
  const r = pageHeaderParts(`${H1}<p>Body. Text.</p>`, 'From <front> matter');
  assert.deepEqual(r.description, { html: 'From &lt;front&gt; matter', indexed: true });
  assert.equal(r.body, '<p>Body. Text.</p>');
  assert.equal(pageHeaderParts(`${H1}<ul><li><p>x</p></li></ul>`).description, null);
  assert.throws(() => pageHeaderParts('<p>no title</p><h1>Late</h1>'), /must start with its <h1>/);
});

test('dates show the author calendar day, whatever the build machine timezone', () => {
  assert.equal(displayDate('2025-03-01T23:30:00-08:00'), 'Mar 1, 2025');
  assert.equal(displayDate('2026-12-31T00:10:00+14:00'), 'Dec 31, 2026');
});
