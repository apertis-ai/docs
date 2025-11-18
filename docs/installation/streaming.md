# Streaming 輸出

## 以 Python 為例

```python
from openai import OpenAI


client = OpenAI(
    base_url="https://api.stima.tech/v1",
    api_key="<STIMA_API_KEY>"
)
stream = client.chat.completions.create(
    model="<MODEL>",
    messages=[{"role": "user", "content": "Say this is a test"}],
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

## 參數說明

- `<MODEL>`: 要使用的模型，詳見 [模型列表](https://api.stima.tech/models)。
- `stream`: 是否開啟流式輸出，目前僅支援 `True`。
- `STIMA_API_KEY`: 您的 API 金鑰