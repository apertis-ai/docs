# Streaming Output

## Python Example

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

## Parameters
- `<MODEL>`: The model to use, see [Model List](https://api.stima.tech/models).
- `stream`: Whether to enable streaming output, currently only supports `True`.
- `STIMA_API_KEY`: Your API key.
