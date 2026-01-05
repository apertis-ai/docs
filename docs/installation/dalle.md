# 使用 GPT-Image-1 和 Dall-E 3 

## 以 Python 為例

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

## 參數說明

- `<MODEL>`: 要使用的模型，目前支援 `gpt-image-1`, `dall-e-3`。
- `size`: 圖片大小，目前僅支援 `1024x1024`, `1792x1024`, `1024x1792`。
- `APERTIS_API_KEY`: 您的 API 金鑰