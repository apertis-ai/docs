# Vision (Images)

Analyze images using multimodal models, enabling visual understanding, image description, and visual question answering.

## Prerequisites

```bash
pip install apertis
```

Get your API Key from [**Apertis**](https://apertis.ai/token)

## Basic Image Analysis

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What's in this image?"},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg"
                        }
                    }
                ]
            }
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Local Image (Base64)

```python
import base64
from pathlib import Path
from apertis import Apertis

def encode_image(image_path: str) -> str:
    """Encode image to base64."""
    with open(image_path, "rb") as image_file:
        return base64.standard_b64encode(image_file.read()).decode("utf-8")

def main():
    client = Apertis()

    image_path = "path/to/your/image.jpg"
    base64_image = encode_image(image_path)

    # Determine media type
    suffix = Path(image_path).suffix.lower()
    media_types = {".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".gif": "gif", ".webp": "webp"}
    media_type = media_types.get(suffix, "jpeg")

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image in detail."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/{media_type};base64,{base64_image}"
                        }
                    }
                ]
            }
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Multiple Images

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Compare these two images. What are the differences?"},
                    {
                        "type": "image_url",
                        "image_url": {"url": "https://example.com/image1.jpg"}
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": "https://example.com/image2.jpg"}
                    }
                ]
            }
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Image Quality Control

```python
from apertis import Apertis

def main():
    client = Apertis()

    # High detail for complex images
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Read all the text in this document."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "https://example.com/document.png",
                            "detail": "high"  # Use high detail for text/documents
                        }
                    }
                ]
            }
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Visual Question Answering

```python
from apertis import Apertis

def main():
    client = Apertis()

    image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png"

    questions = [
        "What objects are in this image?",
        "What colors do you see?",
        "Is there any text visible?",
    ]

    for question in questions:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": question},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ]
        )
        print(f"Q: {question}")
        print(f"A: {response.choices[0].message.content}\n")

if __name__ == "__main__":
    main()
```

## Streaming with Images

```python
from apertis import Apertis

def main():
    client = Apertis()

    stream = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image in detail."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg"
                        }
                    }
                ]
            }
        ],
        stream=True
    )

    for chunk in stream:
        if chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)

    print()

if __name__ == "__main__":
    main()
```

## Supported Models

Vision capabilities are available on:

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1` |
| Anthropic | `claude-sonnet-4.5`, `claude-opus-4-5-20251101`, `claude-haiku-4-5-20250501` |
| Google | `gemini-3-pro-preview`, `gemini-2.5-flash` |

[View all models →](/api/utilities/models)

## API Reference

### Image URL Object

| Field | Type | Description |
|-------|------|-------------|
| `url` | `str` | Image URL or base64 data URI |
| `detail` | `str` | Detail level: `"auto"`, `"low"`, or `"high"` |

### Supported Formats

- JPEG / JPG
- PNG
- GIF
- WebP

### Size Limits

- Maximum image size varies by model
- Images are automatically resized if needed
- Use `detail: "low"` for faster processing of simple images
