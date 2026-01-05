# 利用 LLM 讀取圖片

## 以 Python 為例

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.apertis.ai/v1",
    api_key="<APERTIS_API_KEY>"
)

response = client.chat.completions.create(
  model="<MODEL>",
  messages=[
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What’s in this image?"},
        {
          "type": "image_url",
          "image_url": {
            "url": "<IMAGE_URL>",
          },
        },
      ],
    }
  ],
  max_tokens=300,
)

print(response.choices[0])
```

## 參數說明

- `<MODEL>`: 要使用的模型，詳見 [模型列表](https://api.apertis.ai/models)。
- `<IMAGE_URL>`: 要讀取的圖片 URL。
- `APERTIS_API_KEY`: 您的 API 金鑰