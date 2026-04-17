# Apertis MCP Server

`@apertis/mcp-server` is an [MCP](https://modelcontextprotocol.io) server that lets agents (Claude Code, OpenCode, or any MCP-compatible client) manage your Apertis account and query the API gateway at runtime — list models, check quota, create API keys, and ask for task-aware model recommendations.

GitHub: [apertis-ai/apertis-mcp](https://github.com/apertis-ai/apertis-mcp) · npm: `@apertis/mcp-server`

## Installation

No install step required — the server runs via `npx`. Just point your MCP client at it.

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "apertis": {
      "command": "npx",
      "args": ["@apertis/mcp-server"],
      "env": {
        "APERTIS_API_KEY": "sk-your-key-here"
      }
    }
  }
}
```

### OpenCode

Add to `openclaw.json`:

```json
{
  "mcpServers": {
    "apertis": {
      "command": "npx",
      "args": ["@apertis/mcp-server"],
      "env": {
        "APERTIS_API_KEY": "sk-your-key-here"
      }
    }
  }
}
```

Restart your agent and the Apertis tools become available.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APERTIS_API_KEY` | Yes | — | Your Apertis API key (`sk-...`) |
| `APERTIS_BASE_URL` | No | `https://api.apertis.ai` | API base URL |

## Available Tools

| Tool | Description |
|------|-------------|
| `list_models` | List available models with optional filtering (free/paid, capability) |
| `get_model_info` | Get detailed info about a specific model (pricing, context, provider) |
| `compare_models` | Side-by-side comparison of 2–5 models |
| `check_quota` | Check account balance, subscription status, remaining quota |
| `get_usage_stats` | Usage statistics by model and period (today/week/month) |
| `list_api_keys` | List API keys with status and quota (masked) |
| `create_api_key` | Create a new API key with optional quota limit |
| `suggest_model` | Freeform keyword-based model search over the full catalog |
| `recommend_model` | Curated Apertis pick for a task type with live pricing |

## `recommend_model` — Dynamic Model Selection

Prefer `recommend_model` when the task fits one of the 5 canonical types — it wraps the [`GET /v1/recommend`](../utilities/recommend) endpoint and returns a single opinionated pick rather than a ranked list.

**Input**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `task` | Yes | `coding` / `long-context` / `fast-chat` / `reasoning` / `vision` |
| `budget` | No | `low` / `medium` (default) / `high` |

**Example conversation**

```
You:   What model should I use for coding right now?
Agent: [calls recommend_model(task="coding", budget="medium")]
       → Apertis recommends claude-sonnet-4-6
         Input: $2.40/1M, Output: $12.00/1M
         Why: Best coding ability per dollar. 200K context.
         Alternatives:
         - deepseek-v3 ($0.30/1M) — 3x cheaper, good for simpler coding
         - claude-opus-4-6 ($4.00/1M) — most capable, higher cost
```

Use the returned `model` value directly in subsequent API calls.

## Resources

In addition to tools, the server exposes three read-only resources:

| Resource URI | Description |
|--------------|-------------|
| `apertis://account` | Current account info, balance, subscription |
| `apertis://models` | Full model catalog (cached 5 min) |
| `apertis://usage/today` | Today's usage summary |

## Security

- All API keys in tool output are masked (first 4 + last 4 characters)
- New keys are shown in full **once** — save them immediately
- Keep `APERTIS_API_KEY` out of source control; use your MCP client's env-var expansion
