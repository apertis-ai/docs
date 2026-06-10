# Continue Dev

[**Continue Dev**](https://www.continue.dev/) is an extension designed for **VSCode** and **Cursor IDE** that simplifies interactions with large language models such as ChatGPT. It allows users to effortlessly integrate code snippets into these models for development assistance.

### Introduction

Compared to **Cursor IDE**, both tools showcase **code-centric interaction capabilities with language models** and provide **automatic code rewriting** features. However, Cursor IDE excels in Codebase RAG (Retrieval-Augmented Generation) and offers significantly higher precision in autocompletion.

On the other hand, Continue Dev shines in quick queries and debugging tasks. As a lightweight extension, it provides an alternative option for immediate support. Whether seeking instant answers, optimization suggestions, or backup when Cursor IDE encounters issues, Continue Dev proves to be a reliable tool.

### Installation

This guide focuses on the installation process for VSCode. Begin by navigating to the **Extensions** menu on the left-hand panel and searching for **Continue**.

![](../static/img/continue_1.jpg)

After installation, the following interface will appear. However, the chat panel on the left will not function until the `config.json` file is configured.

![](../static/img/continue_2.jpg)

### Adding `config.json`

Click the gear icon in the bottom-left corner to access the `config.json` file.

![](../static/img/continue_3.png)

Copy the JSON configuration below and paste it into the `config.json` file. Replace the **API Key** with your **API Key**.

```json
{
  "models": [
    {
      "model": "claude-sonnet-4-6",
      "apiBase": "https://api.apertis.ai/v1",
      "title": "Claude Sonnet 4.6",
      "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
      "provider": "openai",
      "description": "Explain in details"
    },
    {
      "model": "claude-haiku-4-5",
      "apiBase": "https://api.apertis.ai/v1",
      "title": "Claude Haiku 4.5",
      "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
      "provider": "openai",
      "description": "Explain in details"
    },
    {
      "model": "claude-opus-4-8",
      "apiBase": "https://api.apertis.ai/v1",
      "title": "Claude Opus 4.8",
      "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
      "provider": "openai",
      "description": "Explain in details"
    },
    {
      "model": "gpt-5.5",
      "apiBase": "https://api.apertis.ai/v1",
      "title": "GPT-5.5",
      "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
      "provider": "openai",
      "description": "Explain in details"
    },
    {
      "model": "gpt-5.4-mini",
      "apiBase": "https://api.apertis.ai/v1",
      "title": "GPT-5.4 Mini",
      "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
      "provider": "openai",
      "description": "Explain in details"
    },
    {
      "model": "gpt-5.4-nano",
      "apiBase": "https://api.apertis.ai/v1",
      "title": "GPT-5.4 Nano",
      "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
      "provider": "openai",
      "description": "Explain in details"
    },
    {
      "model": "gemini-3.1-pro-preview",
      "apiBase": "https://api.apertis.ai/v1",
      "title": "gemini-3.1-pro-preview",
      "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
      "provider": "openai",
      "description": "Explain in details"
    },
    {
      "model": "gemini-3.5-flash",
      "apiBase": "https://api.apertis.ai/v1",
      "title": "gemini-3.5-flash",
      "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
      "provider": "openai",
      "description": "Explain in details"
    }
  ],
  "customCommands": [
    {
      "name": "test",
      "prompt": "{{{ input }}}\n\nWrite a comprehensive set of unit tests for the selected code. It should setup, run tests that check for correctness including important edge cases, and teardown. Ensure that the tests are complete and sophisticated. Give the tests just as chat output, don't edit any file.",
      "description": "Write unit tests for highlighted code"
    }
  ],
  "allowAnonymousTelemetry": true,
  "embeddingsProvider": {
    "provider": "free-trial"
  },
  "tabAutocompleteModel": {
    "model": "gpt-5.5",
    "apiBase": "https://api.apertis.ai/v1",
    "title": "GPT-5.5",
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxx",
    "provider": "openai"
  },
  "tabAutocompleteOptions": {
    "useCopyBuffer": false,
    "maxPromptTokens": 400,
    "prefixPercentage": 0.5
  },
  "reranker": {
    "name": "free-trial"
  }
}
```

### Start Using

**Ask Code (Chat Mode)**

- 選取一段程式碼後【Ctrl + L】 / [Cmd + L]

![](../static/img/continue_4.png)

**Rewrite Code (Edit Mode)**

- 選取一段程式碼後【Ctrl + I】 / [Cmd + I]

![](../static/img/continue_5.png)