# Apertis MCP Server

`@apertis/mcp-server` is an [MCP](https://modelcontextprotocol.io) server that lets agents (Claude Code, OpenCode, or any MCP-compatible client) manage your Apertis account and query the API gateway at runtime — list models, check quota, create API keys, ask for task-aware model recommendations, and delegate bulk grunt work to a cheap coworker model.

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
| `APERTIS_COWORKER_MODEL` | No | `deepseek-v4-flash` | Intern model used by the `delegate` tool |

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
| `delegate` | Offload bulk grunt work (file reads, boilerplate, summarization) to a cheap coworker model — keeps your Claude usage limit intact |

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

## `delegate` — Offload Grunt Work to a Cheap Coworker

`delegate` gives your agent a cheap "intern". Claude stays the manager on your
Anthropic subscription and hands off high-volume, low-judgement work — bulk file
reads, boilerplate generation, summarization — to a cheap model through the
Apertis gateway. The coworker reads files itself, so their bulk content **never
enters your agent's context**, and the work runs on Apertis credit instead of
your Claude weekly/5-hour limit.

**Input**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `instruction` | Yes | What the intern should do |
| `file_paths` | No | Local file paths the coworker reads itself; content never enters your context |
| `content` | No | Inline content to process |
| `model` | No | Override the intern model (default `deepseek-v4-flash`) |

The coworker calls are ordinary Apertis requests billed against your API key —
one credit pool, transparent per-call usage in your dashboard. Unreadable file
paths and gateway errors are surfaced as tool errors, never silently swallowed.

**Example conversation**

```
You:   Summarize the errors in build.log
Agent: [calls delegate(instruction="Summarize the errors in <=10 bullets",
        file_paths=["build.log"])]
       → returns a concise summary; the full log never enters Claude's context
```

**Auto-delegation.** To make your agent delegate without being asked each time,
paste the routing rules from
[`coworker-rules.md`](https://github.com/apertis-ai/apertis-mcp/blob/main/coworker-rules.md)
into your project's `CLAUDE.md`. They tell the agent when to delegate (bulk
reads, boilerplate, summarization) versus do the work itself.

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
