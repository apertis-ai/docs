/// <reference types="@cloudflare/workers-types" />

// /mcp: the docs MCP server (site-nimbus/src/agent/mcp.ts; openspec docs-agent-access). Its data is this
// deployment's own /llms.txt and /llms-full.txt, read through the static assets binding, so it serves exactly
// the agent-eligible pages. Every method reaches handleMcp, which answers 405 to anything but POST.
import { corpusFrom, handleMcp, type DocsCorpus } from '../site-nimbus/src/agent/mcp.ts'

// A deployment's assets never change, so one parse per isolate; a failed load is not kept.
let corpus: Promise<DocsCorpus> | undefined

async function load(assets: Fetcher, origin: string): Promise<DocsCorpus> {
  const text = async (path: string) => {
    const res = await assets.fetch(new URL(path, origin).toString())
    if (!res.ok) throw new Error(`${path}: ${res.status}`)
    return res.text()
  }
  return corpusFrom(await text('/llms.txt'), await text('/llms-full.txt'))
}

export const onRequest: PagesFunction<{ ASSETS: Fetcher }> = ({ request, env }) =>
  handleMcp(request, () => (corpus ??= load(env.ASSETS, request.url).catch((e) => { corpus = undefined; throw e })))
