import assert from 'node:assert/strict'
import {
  extractDocumentationSources,
  getCurrentPageContext,
} from './assistantUtils'

const answer = [
  'Use the OpenAI-compatible endpoint. See [Quickstart](/installation/connection)',
  'and [Models](/installation/models).',
  'The same setup is repeated in [Quickstart](/installation/connection).',
  'External links like [Apertis](https://apertis.ai) are not docs citations.',
].join(' ')

assert.deepEqual(extractDocumentationSources(answer), [
  {title: 'Quickstart', href: '/installation/connection'},
  {title: 'Models', href: '/installation/models'},
])

const pageContext = getCurrentPageContext({
  title: 'Streaming | Apertis Documentation',
  href: 'https://docs.apertis.ai/api-reference/streaming',
  pathname: '/api-reference/streaming',
})

assert.deepEqual(pageContext, {
  title: 'Streaming',
  href: '/api-reference/streaming',
})

console.log('assistant utils tests passed')
