---
title: "Using GPT-Image-1 and Dall-E 3"
description: "Generate images with GPT image models through the OpenAI-compatible /v1/images/generations endpoint."
---

# Using GPT-Image-1 and Dall-E 3

## Python Example

```python
import requests
import json

url = "https://api.apertis.ai/v1/images/generations"

payload = json.dumps({
   "model": "gpt-image-2",
   "prompt": "A cute baby sea otter",
   "n": 1,
   "size": "1024x1024"
})
api_key = "APERTIS_API_KEY"
headers = {
   'Authorization': f'Bearer {api_key}',
   'Content-Type': 'application/json'
}

response = requests.request("POST", url, headers=headers, data=payload)

print(response.text)
```

## Parameters

- `model`: The model to use, e.g. `gpt-image-2`. See [Models](/models) for the current image models
- `size`: The size of the image: `1024x1024`, `1536x1024`, `1024x1536` or `auto`
- `APERTIS_API_KEY`: Your API key
