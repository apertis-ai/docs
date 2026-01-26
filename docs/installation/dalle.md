# Using GPT-Image-1 and Dall-E 3

## Python Example

```python
import requests
import json

url = "https://api.apertis.ai/v1/images/generations"

payload = json.dumps({
   "model": "MODEL_NAME",
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

- `model`: The model to use, currently supports `dall-e-3`
- `size`: The size of the image, currently supports `1024x1024`, `1792x1024`, `1024x1792`
- `APERTIS_API_KEY`: Your API key

