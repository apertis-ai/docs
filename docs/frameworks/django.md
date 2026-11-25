---
title: Django
sidebar_label: Django
description: Call the Apertis API from a Django view with the OpenAI Python SDK.
---

# Django

Add a `/chat/` view to a Django project that returns a chat completion from Apertis, using the OpenAI Python SDK.

## Install

```bash
pip install openai django
django-admin startproject mysite
cd mysite
```

## Set your API key

Create a key in [Settings → API Keys](https://apertis.ai/setting?tab=keys), then export it:

```bash
export APERTIS_API_KEY="sk-your-api-key"
```

## Minimal view

Replace the project's `urls.py` with:

`mysite/urls.py`:

```python
import os

from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from openai import OpenAI

client = OpenAI(
    base_url="https://api.apertis.ai/v1",
    api_key=os.environ["APERTIS_API_KEY"],
)


def chat(request):
    q = request.GET.get("q", "Hello! What can you do?")
    completion = client.chat.completions.create(
        model="gpt-5.5",
        messages=[{"role": "user", "content": q}],
    )
    return JsonResponse({"text": completion.choices[0].message.content})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("chat/", chat),
]
```

## Run and test

```bash
python manage.py runserver
curl "http://127.0.0.1:8000/chat/?q=Say+hi"
```

The SDK sends `Authorization: Bearer` with your key to `https://api.apertis.ai/v1`. Pick any model ID from the [Models page](https://apertis.ai/models).

## Next steps

- [Quick Start](/getting-started/quick-start): create an account and your first request
- [API Keys](/authentication/api-keys): create and rotate keys
- [Chat Completions](/api/text-generation/chat-completions): every request field
- [Messages API](/api/text-generation/messages): the Anthropic-style endpoint
- [Error codes](/help/error-codes): a `401` means the key is missing or wrong
