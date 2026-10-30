---
title: "Run your coding agent on Apertis: change the baseURL"
sidebar_label: "Coding agent baseURL"
---

Point your coding agent's baseURL at Apertis to use a customer-locked open-weight route (Qwen / DeepSeek / GLM), with request evidence for every call.

- Prereqs: Apertis API key (prepaid credits; manage at https://apertis.ai/setting?tab=keys); OpenAI-compatible client.
- OpenCode: same `opencode.json` snippet as ZH page (`@ai-sdk/openai-compatible`, `options.baseURL`).
- Other clients: `OPENAI_BASE_URL=https://api.apertis.ai/v1` + `OPENAI_API_KEY`; closed-model drop-in not promised.
- Claude Code: follow https://docs.apertis.ai/installation/claude-code (`APERTIS_BASE_URL`; Anthropic-compatible base `https://api.apertis.ai`, no /v1). This page links, not replaces, eng docs. No closed-model Claude compatibility promised in this open-weight pitch.
- Models: examples `qwen3.6-plus`, `glm-5.1`, `deepseek-v3.2` — public catalog Model IDs; per availability; Models page / GET /v1/models prevail: https://docs.apertis.ai/models/ or `GET /v1/models`. No capacity/SLA claims.
- BYOK: bring your own provider key, or use Apertis compliant open-weight endpoints. Closed models only via your own official key.
- Request evidence: a record you can check for every request; usage reconciles to billing — evidence, not an SLA. Visible in Activity (top bar) after a request.
- Next: /compare · docs https://docs.apertis.ai
