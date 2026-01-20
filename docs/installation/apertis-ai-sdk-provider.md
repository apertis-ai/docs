# @apertis/ai-sdk-provider

Official [Vercel AI SDK](https://sdk.vercel.ai/) Provider for Apertis, enabling access to 470+ models through a standardized AI SDK interface.

## Installation

```bash
npm install @apertis/ai-sdk-provider ai
```

Or using other package managers:

```bash
# pnpm
pnpm add @apertis/ai-sdk-provider ai

# yarn
yarn add @apertis/ai-sdk-provider ai
```

## Setup

Get your API Key from [**Apertis Key**](https://apertis.ai/token)

### Environment Variable

```bash
export APERTIS_API_KEY=sk-your-api-key
```

### Code Configuration

```typescript
import { createApertis } from '@apertis/ai-sdk-provider';

const apertis = createApertis({
  apiKey: process.env.APERTIS_API_KEY,
});
```

## Usage Examples

### Basic Text Generation

```typescript
import { apertis } from '@apertis/ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: apertis('gpt-4o'),
  prompt: 'Explain quantum computing in simple terms.',
});

console.log(text);
```

### Streaming

```typescript
import { apertis } from '@apertis/ai-sdk-provider';
import { streamText } from 'ai';

const { textStream } = await streamText({
  model: apertis('claude-sonnet-4-20250514'),
  prompt: 'Write a poem about programming.',
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

### Tool Calling (Function Calling)

```typescript
import { apertis } from '@apertis/ai-sdk-provider';
import { generateText, tool } from 'ai';
import { z } from 'zod';

const { text } = await generateText({
  model: apertis('gpt-4o'),
  tools: {
    weather: tool({
      description: 'Get weather information for a location',
      parameters: z.object({ location: z.string() }),
      execute: async ({ location }) => `Sunny, 22°C in ${location}`,
    }),
  },
  prompt: 'What is the weather in Tokyo?',
});
```

### Embeddings

```typescript
import { apertis } from '@apertis/ai-sdk-provider';
import { embed, embedMany } from 'ai';

// Single embedding
const { embedding } = await embed({
  model: apertis.textEmbeddingModel('text-embedding-3-small'),
  value: 'Hello world',
});

// Batch embeddings
const { embeddings } = await embedMany({
  model: apertis.textEmbeddingModel('text-embedding-3-large', {
    dimensions: 1024, // Optional: reduce dimensions
  }),
  values: ['Hello', 'World'],
});
```

## Supported Models

Access models from multiple providers through Apertis:

### Chat Models
- **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1`, `o1-mini`
- **Anthropic**: `claude-sonnet-4-20250514`, `claude-opus-4-20250514`, `claude-3-5-sonnet-20241022`
- **Google**: `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`
- **Others**: `deepseek-chat`, `grok-3`, `glm-4` and 470+ more

### Embedding Models
- `text-embedding-3-small`
- `text-embedding-3-large`
- `text-embedding-ada-002`

## Advanced Configuration

```typescript
import { createApertis } from '@apertis/ai-sdk-provider';

const apertis = createApertis({
  apiKey: 'sk-your-api-key',           // API Key
  baseURL: 'https://api.apertis.ai/v1', // API endpoint
  headers: { 'X-Custom': 'value' },     // Custom headers
});
```

## Resources

- [GitHub Repository](https://github.com/apertis-ai/apertis-sdk)
- [npm Package](https://www.npmjs.com/package/@apertis/ai-sdk-provider)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/)
