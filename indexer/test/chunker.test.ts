// headingText: code spans must survive verbatim, even when their content contains the same
// characters (`_`, `*`) used for emphasis. Real shapes from site-nimbus/src/content/public/help/error-codes.md
// (#13 full-corpus), where every one of these headings was mis-anchored before the fix.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { headingText } from '../chunker.ts'

test('headingText: a code span with two or more underscores is not read as emphasis', () => {
  // Single underscore: already worked before the fix (no closing delimiter to pair with).
  assert.equal(headingText('`quota_exceeded`'), 'quota_exceeded')
  // Two underscores: the code-span regex ran before the emphasis regex, so stripping the
  // backticks first exposed a bare `_x_` pair that the emphasis regex then deleted.
  assert.equal(headingText('`invalid_api_key`'), 'invalid_api_key')
  assert.equal(headingText('`model_access_denied`'), 'model_access_denied')
  assert.equal(headingText('`content_policy_violation`'), 'content_policy_violation')
  // With a trailing, non-code suffix, as several error-codes headings have.
  assert.equal(headingText('`service_unavailable` (503)'), 'service_unavailable (503)')
})

test('headingText: real emphasis, links and trailing ATX hashes still resolve', () => {
  assert.equal(headingText('**Bold** _em_ text ##'), 'Bold em text')
  assert.equal(headingText('[Quick Start](/getting-started/quick-start)'), 'Quick Start')
  assert.equal(headingText('Use `_leading_underscore_var` here'), 'Use _leading_underscore_var here')
})
