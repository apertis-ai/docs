/// <reference types="@cloudflare/workers-types" />

// Thin Pages adapter for POST /api/ask. The service lives in assistant/service.ts (outside functions/,
// so it is not a public route). Only POST and OPTIONS are exported: GET falls through to the static 404.
import { handleAsk, handleOptions } from '../../assistant/service.ts'
import type { AskEnv } from '../../assistant/service.ts'

export const onRequestPost: PagesFunction<AskEnv> = ({ request, env }) => handleAsk(request, env)

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => handleOptions()
