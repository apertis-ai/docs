# @apertis/agent

[`@apertis/agent`](https://www.npmjs.com/package/@apertis/agent) is a TypeScript agent runtime for the Apertis API. `callModel` runs the whole agent loop for you: send messages → the model calls tools → execute them → feed results back → repeat, until a stop condition fires or the model stops calling tools.

The differentiator: the `maxCost` stop condition halts on **real measured spend**, not a token estimate.

> Migrating from `@openrouter/agent`? The surface is intentionally close — `callModel`, `tool()`, and the stop conditions map across, so most code ports with a one-import swap.

GitHub: [apertis-ai/apertis-agent](https://github.com/apertis-ai/apertis-agent) · npm: `@apertis/agent`

## Installation

```bash
npm install @apertis/agent zod
```

Set your API key (get one from the [Apertis Dashboard](https://apertis.ai/token)):

```bash
export APERTIS_API_KEY=sk-your-key
```

Requires Node.js 18+.

## Quickstart

```typescript
import { callModel, tool, stepCountIs, maxCost, hasToolCall } from "@apertis/agent";
import { z } from "zod";

const getWeather = tool({
  name: "get_weather",
  description: "Get the weather for a city",
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, tempC: 21 }),
});

const result = callModel({
  model: "claude-sonnet-4-6",
  input: "What's the weather in Taipei? Then say done.",
  tools: [getWeather],
  stopWhen: [stepCountIs(10), maxCost(0.5), hasToolCall("done")], // OR — any one stops the loop
});

console.log(await result.getText());
const res = await result.getResponse();
console.log("steps:", res.steps.length, "cost: $", res.cost);
```

Tools are validated with their Zod schema at runtime; if the model sends bad arguments, the error is fed back so it can self-correct rather than throwing.

## Streaming

```typescript
const result = callModel({ model: "gpt-5.2", input: "Write a haiku." });
for await (const delta of result.getTextStream()) process.stdout.write(delta);
```

Also available: `getReasoningStream()`, `getToolCallsStream()`, `getToolStream()`, `getNewMessagesStream()`, and `getFullResponsesStream()`.

## Stop conditions

`stopWhen` combines conditions with **OR** — the loop stops as soon as any returns true. With no `stopWhen`, a `stepCountIs(20)` backstop applies, and an absolute 100-step cap always holds.

| Condition | Stops when |
|---|---|
| `stepCountIs(n)` | the loop has run `n` steps |
| `maxTokensUsed(n)` | cumulative total tokens reach `n` |
| `maxCost(usd)` | **measured** cumulative cost reaches `usd` |
| `hasToolCall(name)` | the model calls the named tool |
| `finishReasonIs(reason)` | the latest `finish_reason` matches |

### How `maxCost` measures cost

`maxCost` reads your key's `used_quota_usd` from the usage endpoint after each step and tracks the delta from a pre-run baseline — so it reflects **actual billed spend**, not a pricing-table estimate. If cost can't be measured for a step, the loop stops conservatively rather than risk overspend.

## Tool approval (human-in-the-loop)

Mark a tool with `requireApproval` to pause the loop before it runs. State is **client-side** — bring your own `StateAccessor` (Redis, a database, files) to survive restarts.

```typescript
import { InMemoryStateAccessor } from "@apertis/agent";

const state = new InMemoryStateAccessor();

const deleteFile = tool({
  name: "delete_file",
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path }) => `deleted ${path}`,
  requireApproval: true,
});

const run = callModel({ model: "claude-sonnet-4-6", input: "clean up /tmp", tools: [deleteFile], state });

if (await run.requiresApproval()) {
  const pending = await run.getPendingToolCalls();
  // ...ask a human to approve `pending`...
  const resumed = callModel({
    model: "claude-sonnet-4-6", input: "clean up /tmp", tools: [deleteFile], state,
    approveToolCalls: [pending[0].id], // or rejectToolCalls
  });
  console.log(await resumed.getText());
}
```

A pending call you neither approve nor reject stays pending and the run re-pauses — it never auto-runs a side-effecting tool.

## Configuration

```typescript
import { createCallModel } from "@apertis/agent";

const callModel = createCallModel({
  apiKey: "sk-...",
  baseURL: "https://api.apertis.ai/v1",
});
```

Key precedence: `opts.apiKey` → `APERTIS_API_KEY` → `createCallModel` config. The SDK masks keys in all output and redacts them from error messages.

## Format converters

`fromChatMessages` / `toChatMessage` (native) and `fromClaudeMessages` / `toClaudeMessage` bridge Anthropic Messages-format history into the chat-completions format the loop uses.

## Links

- npm: [`@apertis/agent`](https://www.npmjs.com/package/@apertis/agent)
- Source: [github.com/apertis-ai/apertis-agent](https://github.com/apertis-ai/apertis-agent)
- Building with the Vercel AI SDK instead? See [@apertis/ai-sdk-provider](/api/sdks/ai-sdk-provider).
