---
title: Flask
sidebar_label: Flask
description: Call the Apertis API from a Flask route with the OpenAI Python SDK.
---

# Flask

Add a `/chat` route to a Flask app that returns a chat completion from Apertis, using the OpenAI Python SDK.

## Install

```bash
pip install openai flask
```

## Set your API key

Create a key in [Settings → API Keys](https://apertis.ai/setting?tab=keys), then export it:

```bash
export APERTIS_API_KEY="sk-your-api-key"
```

## Minimal app

`app.py`:

```python
import os

from flask import Flask, jsonify, request
from openai import OpenAI

app = Flask(__name__)
client = OpenAI(
    base_url="https://api.apertis.ai/v1",
    api_key=os.environ["APERTIS_API_KEY"],
)


@app.get("/chat")
def chat():
    q = request.args.get("q", "Hello! What can you do?")
    completion = client.chat.completions.create(
        model="gpt-5.5",
        messages=[{"role": "user", "content": q}],
    )
    return jsonify(text=completion.choices[0].message.content)
```

## Run and test

```bash
flask --app app run --port 8000
curl "http://127.0.0.1:8000/chat?q=Say+hi"
```

The app runs on port 8000 because macOS reserves Flask's default port 5000 for AirPlay Receiver.

The SDK sends `Authorization: Bearer` with your key to `https://api.apertis.ai/v1`. Pick any model ID from the [Models page](https://apertis.ai/models).

## Next steps

- [Quick Start](/getting-started/quick-start): create an account and your first request
- [API Keys](/authentication/api-keys): create and rotate keys
- [Chat Completions](/api/text-generation/chat-completions): every request field
- [Messages API](/api/text-generation/messages): the Anthropic-style endpoint
- [Error codes](/help/error-codes): a `401` means the key is missing or wrong
