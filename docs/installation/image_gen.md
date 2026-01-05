# 使用圖片生成 API

Apertis 提供 Image Generation API 讓開發者可以生成圖片，以下主要以 `GPT-4o Image Generation`、`Gemini 2.0 Flash Expanded Image Generation` 及 `Grok 3 Image Generation`。

## 使用方式 (以 Python 為例)

```python
import requests
import json

url = "https://api.apertis.ai/v1/chat/completions"

payload = json.dumps({
   "max_tokens": 4096,
   "model": "<MODEL_ALIAS>",
   "messages": [
      {
         "role": "user",
         "content": [
            {
               "type": "text",
               "text": "把圖片改成吉卜力風格"
            },
            {
               "type": "image_url",
               "image_url": {
                  "url": "data:image/png;base64,"
               }
            }
         ]
      }
   ]
})
headers = {
   'Accept': 'application/json',
   'Authorization': 'Bearer <APERTIS_API_KEY>',
   'Content-Type': 'application/json'
}

response = requests.request("POST", url, headers=headers, data=payload)

print(response.text)
```

```python
import requests
import json

url = "https://api.apertis.ai/v1/chat/completions"

payload = json.dumps({
   "max_tokens": 4096,
   "model": "<MODEL_ALIAS>",
   "messages": [
      {
         "role": "user",
         "content": [
            {
               "type": "text",
               "text": "Generate a beautiful landscape image"
            },
         ]
      }
   ]
})
headers = {
   'Accept': 'application/json',
   'Authorization': 'Bearer <APERTIS_API_KEY>',
   'Content-Type': 'application/json'
}

response = requests.request("POST", url, headers=headers, data=payload)

print(response.text)
```

## 使用方式 (以 bash 為例)

```bash
curl -X POST "https://api.apertis.ai/v1/chat/completions" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer <APERTIS_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model": "<MODEL_ALIAS>", "messages": [{"role": "user", "content": [{"type": "text", "text": "把圖片改成吉卜力風格"}, {"type": "image_url", "image_url": {"url": "data:image/png;base64,"}}]}
```

## 參數說明

- `model`: 模型目前支援`gpt-4o-image`、`gemini-2.0-flash-exp-image`及`grok-3-image`。
- `prompt`: 要生成的圖片描述。
- `APERTIS_API_KEY`: 您的 API 金鑰。
- 圖片輸入: 轉換成**base64**格式
