# Video

Analyze video content using multimodal models, enabling video understanding, scene analysis, and temporal reasoning.

## Prerequisites

```bash
pip install apertis
```

Get your API Key from [**Apertis**](https://apertis.ai/token)

## Basic Video Analysis

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gemini-2.5-pro",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe what happens in this video."},
                    {
                        "type": "video_url",
                        "video_url": {
                            "url": "https://example.com/video.mp4"
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

## Local Video (Base64)

```python
import base64
from apertis import Apertis

def encode_video(video_path: str) -> str:
    """Encode video to base64."""
    with open(video_path, "rb") as video_file:
        return base64.standard_b64encode(video_file.read()).decode("utf-8")

def main():
    client = Apertis()

    video_path = "path/to/your/video.mp4"
    base64_video = encode_video(video_path)

    response = client.chat.completions.create(
        model="gemini-2.5-pro",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What is happening in this video?"},
                    {
                        "type": "video_url",
                        "video_url": {
                            "url": f"data:video/mp4;base64,{base64_video}"
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

## Video Question Answering

```python
from apertis import Apertis

def main():
    client = Apertis()

    video_url = "https://example.com/cooking-video.mp4"

    questions = [
        "What dish is being prepared?",
        "What ingredients are used?",
        "How many steps are in this recipe?",
        "What cooking techniques are demonstrated?"
    ]

    for question in questions:
        response = client.chat.completions.create(
            model="gemini-2.5-pro",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": question},
                        {"type": "video_url", "video_url": {"url": video_url}}
                    ]
                }
            ]
        )
        print(f"Q: {question}")
        print(f"A: {response.choices[0].message.content}\n")

if __name__ == "__main__":
    main()
```

## Temporal Analysis

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gemini-2.5-pro",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": """Analyze this video and provide:
1. A timeline of key events with approximate timestamps
2. Scene transitions
3. Any significant actions or changes"""
                    },
                    {
                        "type": "video_url",
                        "video_url": {"url": "https://example.com/event-video.mp4"}
                    }
                ]
            }
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Video with Audio Analysis

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gemini-2.5-pro",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": """Analyze both the visual and audio content of this video:
1. What is being shown visually?
2. What is being said or what sounds are present?
3. How do the audio and video relate to each other?"""
                    },
                    {
                        "type": "video_url",
                        "video_url": {"url": "https://example.com/presentation.mp4"}
                    }
                ]
            }
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Video Comparison

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gemini-2.5-pro",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Compare these two videos. What are the similarities and differences?"},
                    {"type": "video_url", "video_url": {"url": "https://example.com/video1.mp4"}},
                    {"type": "video_url", "video_url": {"url": "https://example.com/video2.mp4"}}
                ]
            }
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Streaming Video Analysis

```python
from apertis import Apertis

def main():
    client = Apertis()

    stream = client.chat.completions.create(
        model="gemini-2.5-pro",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Provide a detailed scene-by-scene breakdown of this video."},
                    {"type": "video_url", "video_url": {"url": "https://example.com/movie-clip.mp4"}}
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

## Action Recognition

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.chat.completions.create(
        model="gemini-2.5-pro",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": """Identify all actions performed in this video.
For each action, provide:
- Action name
- Who/what is performing it
- Approximate duration or timestamp"""
                    },
                    {"type": "video_url", "video_url": {"url": "https://example.com/sports.mp4"}}
                ]
            }
        ]
    )

    print(response.choices[0].message.content)

if __name__ == "__main__":
    main()
```

## Supported Models

Video analysis is available on:

| Provider | Models |
|----------|--------|
| Google | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash` |
| OpenAI | `gpt-4o` (limited video support) |

[View all models →](/references/models)

## API Reference

### Video URL Object

| Field | Type | Description |
|-------|------|-------------|
| `url` | `str` | Video URL or base64 data URI |

### Supported Formats

- MP4
- MOV
- AVI
- MKV
- WebM

### Limitations

- Maximum video length varies by model
- Large videos may be sampled or truncated
- Processing time increases with video length
- Some models may not support audio track analysis
