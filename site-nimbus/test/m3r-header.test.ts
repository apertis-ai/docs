// #8 reading layout: how the page header takes its H1 and one-sentence description from the body.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { displayDate, pageHeaderParts } from '../src/components/shell/page-header.ts';

const H1 = '<h1 id="quick-start">Quick Start</h1>';

test('a lead paragraph gives its first sentence to the header, and the body keeps only the rest', () => {
  const r = pageHeaderParts(`${H1}\n<p>Get going in <a href="/x">five</a> minutes. Then e.g. call it. Done.</p>\n<h2 id="a">A</h2>`);
  assert.equal(r.h1, H1);
  assert.equal(r.description, 'Get going in <a href="/x">five</a> minutes.');
  assert.equal(r.body, '\n<p>Then e.g. call it. Done.</p>\n<h2 id="a">A</h2>');
});

test('a one-sentence lead moves entirely; a period inside inline markup does not split', () => {
  const r = pageHeaderParts(`${H1}<p>Use <code>a. b</code> with <strong>v1.2 now. ok</strong> today</p><p>Next.</p>`);
  assert.equal(r.description, 'Use <code>a. b</code> with <strong>v1.2 now. ok</strong> today');
  assert.equal(r.body, '<p>Next.</p>');
});

test('a later paragraph is never borrowed: a body that opens with code has no description', () => {
  const body = '<pre class="astro-code"><code><span>{"a": 1}. </span></code></pre><p>Add a thing to the request body here. More.</p>';
  const r = pageHeaderParts(`${H1}${body}`);
  assert.equal(r.description, null);
  assert.equal(r.body, body);
  const img = '<p><img src="/i.png" alt=""></p><p>Real text in a later paragraph. More.</p>';
  assert.equal(pageHeaderParts(`${H1}${img}`).description, null, 'an image-only opening paragraph is not prose');
});

test('an opening sentence ending with ":" or shorter than 4 words is rejected, and the body keeps it', () => {
  for (const lead of ['<p>Returns available models in this format:</p><ul><li>a</li></ul>', '<p>Add a <code>compression</code> object to summarize older <a href="/h">history</a>:</p>',
    '<p>Quick answers here. Then a longer second sentence follows.</p>']) {
    const r = pageHeaderParts(`${H1}${lead}`);
    assert.equal(r.description, null, lead);
    assert.equal(r.body, lead, lead);
  }
});

test('front-matter description wins and leaves the body alone; no prose means no description', () => {
  const r = pageHeaderParts(`${H1}<p>Body. Text.</p>`, 'From <front> matter');
  assert.equal(r.description, 'From &lt;front&gt; matter');
  assert.equal(r.body, '<p>Body. Text.</p>');
  assert.equal(pageHeaderParts(`${H1}<ul><li><p>x</p></li></ul>`).description, null);
  assert.throws(() => pageHeaderParts('<p>no title</p><h1>Late</h1>'), /must start with its <h1>/);
});

test('dates show the author calendar day, whatever the build machine timezone', () => {
  assert.equal(displayDate('2025-03-01T23:30:00-08:00'), 'Mar 1, 2025');
  assert.equal(displayDate('2026-12-31T00:10:00+14:00'), 'Dec 31, 2026');
});
