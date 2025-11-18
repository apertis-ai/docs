# Read Image with LLM

## Python Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.stima.tech/v1",
    api_key="<STIMA_API_KEY>"
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

## Parameters
- `<MODEL>`: The model to use, see [Model List](https://api.stima.tech/models).
- `<IMAGE_URL>`: The URL of the image to read.
- `STIMA_API_KEY`: Your API key.
