# Audio

Process audio input and generate audio output, enabling voice-based applications, transcription, and text-to-speech.

## Prerequisites

```bash
pip install "apertis>=0.4.0"
```

`client.audio` needs `apertis` 0.4.0 or later.

Get your API Key from [**Apertis**](https://apertis.ai/setting?tab=keys)

## Speech to Text (Transcription)

```python
from apertis import Apertis

def main():
    client = Apertis()

    with open("audio.mp3", "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )

    print(response.text)

if __name__ == "__main__":
    main()
```

## Transcription with Options

```python
from apertis import Apertis

def main():
    client = Apertis()

    with open("audio.mp3", "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en",           # Specify language for better accuracy
            prompt="Technical discussion about AI and machine learning",  # Context hint
            response_format="verbose_json",  # Get detailed output
            temperature=0.0          # Lower = more deterministic
        )

    print(f"Text: {response.text}")

    # verbose_json fields such as segments are kept as plain dicts
    for segment in response.model_dump().get("segments", []):
        print(f"  [{segment['start']:.2f}s - {segment['end']:.2f}s] {segment['text']}")

if __name__ == "__main__":
    main()
```

## Translation (Audio to English)

```python
from apertis import Apertis

def main():
    client = Apertis()

    # Translate non-English audio to English text
    with open("spanish_audio.mp3", "rb") as audio_file:
        response = client.audio.translations.create(
            model="whisper-1",
            file=audio_file
        )

    print(f"English translation: {response.text}")

if __name__ == "__main__":
    main()
```

## Text to Speech

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.audio.speech.create(
        model="gpt-4o-mini-tts-2025-12-15",
        voice="alloy",
        input="Hello! Welcome to Apertis AI. How can I help you today?"
    )

    response.write_to_file("output.mp3")

    print("Audio saved to output.mp3")

if __name__ == "__main__":
    main()
```

## Voice, Format and Speed

```python
from apertis import Apertis

def main():
    client = Apertis()

    response = client.audio.speech.create(
        model="gpt-4o-mini-tts-2025-12-15",
        voice="nova",            # Different voice
        input="This is text-to-speech audio with a different voice.",
        response_format="opus",  # Opus format for better quality
        speed=1.0                # Normal speed (0.25 to 4.0)
    )

    response.write_to_file("output.opus")

    print("Audio saved to output.opus")

if __name__ == "__main__":
    main()
```

## Streaming Text to Speech

`client.audio.speech.create()` returns the whole audio file at once. To write the audio while it is still being generated, use the OpenAI SDK's streaming response pointed at Apertis:

```python
import os
from openai import OpenAI

def main():
    client = OpenAI(api_key=os.environ["APERTIS_API_KEY"], base_url="https://api.apertis.ai/v1")

    with client.audio.speech.with_streaming_response.create(
        model="gpt-4o-mini-tts-2025-12-15",
        voice="shimmer",
        input="This audio is being streamed as it's generated.",
    ) as response:
        response.stream_to_file("streamed_output.mp3")

    print("Streamed audio saved to streamed_output.mp3")

if __name__ == "__main__":
    main()
```

## Audio in Chat (Multimodal)

```python
import base64
from apertis import Apertis

def main():
    client = Apertis()

    # Read and encode audio file
    with open("question.mp3", "rb") as f:
        audio_data = base64.standard_b64encode(f.read()).decode("utf-8")

    response = client.chat.completions.create(
        model="gpt-4o-audio-preview",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Please respond to this audio message:"},
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": audio_data,
                            "format": "mp3"
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

## Batch Transcription

```python
import asyncio
from pathlib import Path
from apertis import AsyncApertis

async def transcribe_file(client: AsyncApertis, file_path: str) -> dict:
    """Transcribe a single audio file."""
    with open(file_path, "rb") as f:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=f
        )
    return {"file": file_path, "text": response.text}

async def main():
    client = AsyncApertis()

    # List of audio files to process
    audio_files = list(Path("audio_folder").glob("*.mp3"))

    # Process files concurrently
    tasks = [transcribe_file(client, str(f)) for f in audio_files]
    results = await asyncio.gather(*tasks)

    for result in results:
        print(f"\n{result['file']}:")
        print(f"  {result['text'][:100]}...")

if __name__ == "__main__":
    asyncio.run(main())
```

## Supported Models

### Transcription/Translation

| Model | Description |
|-------|-------------|
| `whisper-1` | OpenAI Whisper for speech recognition |

### Text to Speech

| Model | Description |
|-------|-------------|
| `gpt-4o-mini-tts-2025-12-15` | Steerable voice; accepts `instructions` for tone and pacing |
| `gemini-3.1-flash-tts-preview` | Multilingual TTS |

### Available Voices

| Voice | Description |
|-------|-------------|
| `alloy` | Neutral, balanced |
| `echo` | Warm, conversational |
| `fable` | Expressive, narrative |
| `onyx` | Deep, authoritative |
| `nova` | Friendly, upbeat |
| `shimmer` | Clear, professional |

These voices apply to `gpt-4o-mini-tts-2025-12-15`. `gemini-3.1-flash-tts-preview` accepts only `Aoede`, `Charon`, `Fenrir`, `Kore` and `Puck`; any other voice returns HTTP 400 `voice_not_supported`.

## API Reference

### Transcription Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | `file` | Audio file (required) |
| `model` | `str` | Model identifier (required) |
| `language` | `str` | ISO language code |
| `prompt` | `str` | Context hint for transcription |
| `response_format` | `str` | `"json"`, `"text"`, `"verbose_json"`, `"srt"`, `"vtt"`. The text formats return a `str` |
| `temperature` | `float` | Sampling temperature |
| `timestamp_granularities` | `list` | `["word"]` and/or `["segment"]`, with `verbose_json` |

`file` accepts a path, an open binary file, `bytes`, or a `(filename, bytes)` tuple. The file name's extension tells the API the audio format.

### Speech Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `str` | TTS model (required) |
| `voice` | `str` | Voice selection (required) |
| `input` | `str` | Text to convert (required) |
| `response_format` | `str` | `"mp3"`, `"opus"`, `"aac"`, `"flac"` |
| `speed` | `float` | Speed multiplier (0.25 to 4.0) |
| `instructions` | `str` | Tone and pacing instructions, for models that accept them |

`speech.create()` returns an object with `.content` (the audio bytes) and `.write_to_file(path)`.

### Supported Audio Formats

- MP3
- MP4
- MPEG
- MPGA
- M4A
- WAV
- WebM
