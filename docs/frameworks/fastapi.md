---
title: FastAPI
sidebar_label: FastAPI
description: Call the Apertis API from a FastAPI route with the OpenAI Python SDK.
---

# FastAPI

Add a `/chat` route to a FastAPI app that returns a chat completion from Apertis, using the OpenAI Python SDK.

## Install

```bash
pip install openai fastapi "uvicorn[standard]"
```

## Set your API key

Create a key in [Settings → API Keys](https://apertis.ai/setting?tab=keys), then export it:

```bash
export APERTIS_API_KEY="sk-your-api-key"
```

## Minimal app

```python title="main.py"
import os

from fastapi import FastAPI
from openai import OpenAI

app = FastAPI()
client = OpenAI(
    base_url="https://api.apertis.ai/v1",
    api_key=os.environ["APERTIS_API_KEY"],
)


@app.get("/chat")
def chat(q: str = "Hello! What can you do?"):
    completion = client.chat.completions.create(
        model="gpt-5.5",
        messages=[{"role": "user", "content": q}],
    )
    return {"text": completion.choices[0].message.content}
```

## Run and test

```bash
uvicorn main:app --reload
curl "http://127.0.0.1:8000/chat?q=Say+hi"
```

The SDK sends `Authorization: Bearer` with your key to `https://api.apertis.ai/v1`. Pick any model ID from the [Models page](https://apertis.ai/models).

## Next steps

- [Quick Start](/getting-started/quick-start): create an account and your first request
- [API Keys](/authentication/api-keys): create and rotate keys
- [Chat Completions](/api/text-generation/chat-completions): every request field
- [Messages API](/api/text-generation/messages): the Anthropic-style endpoint
- [Error codes](/help/error-codes): a `401` means the key is missing or wrong
