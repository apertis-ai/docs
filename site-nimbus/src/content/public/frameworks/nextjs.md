# Next.js

Add an App Router Route Handler that returns a chat completion from Apertis, using the OpenAI Node SDK.

## Install

```bash
npx create-next-app@latest my-app --ts --app
cd my-app
npm install openai
```

## Set your API key

Put the key in `.env.local`. Do not prefix it with `NEXT_PUBLIC_`: that would ship it to the browser.

`.env.local`:

```bash
APERTIS_API_KEY=sk-your-api-key
```

## Minimal route

`app/api/chat/route.ts`:

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.apertis.ai/v1",
  apiKey: process.env.APERTIS_API_KEY,
});

export async function GET(request: Request) {
  const q =
    new URL(request.url).searchParams.get("q") ?? "Hello! What can you do?";
  const completion = await client.chat.completions.create({
    model: "gpt-5.5",
    messages: [{ role: "user", content: q }],
  });
  return Response.json({ text: completion.choices[0].message.content });
}
```

The route runs on the server, so the key is never sent to the client.

## Run and test

```bash
npm run dev
curl "http://localhost:3000/api/chat?q=Say+hi"
```

The SDK sends `Authorization: Bearer` with your key to `https://api.apertis.ai/v1`. Pick any model ID from the [Models page](https://apertis.ai/models).

## Next steps

- [Quick Start](/getting-started/quick-start): create an account and your first request
- [API Keys](/authentication/api-keys): create and rotate keys
- [Chat Completions](/api/text-generation/chat-completions): every request field
- [Messages API](/api/text-generation/messages): the Anthropic-style endpoint
- [Error codes](/help/error-codes): a `401` means the key is missing or wrong
