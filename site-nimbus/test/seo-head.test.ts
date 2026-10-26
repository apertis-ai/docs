// Technical SEO signals (apertis-ai/docs#2587): one served URL form, and JSON-LD that cannot end its script.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { safeJsonLd, servedUrl } from '../src/contracts/page.ts';

test('servedUrl: the directory-page form that answers 200; files and slash URLs are untouched', () => {
  assert.equal(servedUrl('https://docs.apertis.ai/api/sdks/cli'), 'https://docs.apertis.ai/api/sdks/cli/');
  assert.equal(servedUrl('https://docs.apertis.ai/api/'), 'https://docs.apertis.ai/api/');
  assert.equal(servedUrl('https://docs.apertis.ai/'), 'https://docs.apertis.ai/');
  assert.equal(servedUrl('https://docs.apertis.ai/llms.txt'), 'https://docs.apertis.ai/llms.txt');
  assert.equal(servedUrl('https://docs.apertis.ai/a?x=1'), 'https://docs.apertis.ai/a/?x=1');
});

test('safeJsonLd: valid JSON that round-trips and never contains a literal "<" (no </script> injection)', () => {
  const value = { headline: '</script><script>alert(1)</script>', d: 'a b' };
  const out = safeJsonLd(value);
  assert.ok(!out.includes('<') && !out.includes(' '));
  assert.deepEqual(JSON.parse(out), value);
});
