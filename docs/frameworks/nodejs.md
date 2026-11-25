---
title: Node.js and TypeScript
sidebar_label: Node.js / TypeScript
description: Call the Apertis API from Node.js or TypeScript with the OpenAI SDK.
---

# Node.js and TypeScript

Send a chat completion to Apertis from a Node.js script, using the OpenAI Node SDK.

## Install

```bash
npm install openai
npm install -D tsx typescript
```

## Set your API key

Create a key in [Settings → API Keys](https://apertis.ai/setting?tab=keys), then export it:

```bash
export APERTIS_API_KEY="sk-your-api-key"
```

## Minimal script

`index.ts`:

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.apertis.ai/v1",
  apiKey: process.env.APERTIS_API_KEY,
});

const completion = await client.chat.completions.create({
  model: "gpt-5.5",
  messages: [{ role: "user", content: "Hello! What can you do?" }],
});

console.log(completion.choices[0].message.content);
```

For plain JavaScript, save the same code as `index.mjs` and run it with `node index.mjs`.

## Run

```bash
npx tsx index.ts
```

The SDK sends `Authorization: Bearer` with your key to `https://api.apertis.ai/v1`. Pick any model ID from the [Models page](https://apertis.ai/models).

## Next steps

- [Quick Start](/getting-started/quick-start): create an account and your first request
- [API Keys](/authentication/api-keys): create and rotate keys
- [Chat Completions](/api/text-generation/chat-completions): every request field
- [Messages API](/api/text-generation/messages): the Anthropic-style endpoint
- [Error codes](/help/error-codes): a `401` means the key is missing or wrong
