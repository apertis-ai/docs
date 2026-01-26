# Audio API

The Audio API enables speech-to-text transcription, audio translation, and text-to-speech synthesis. This reference covers all audio-related endpoints.

## Overview

| Endpoint | Description |
|----------|-------------|
| `/v1/audio/transcriptions` | Convert audio to text |
| `/v1/audio/translations` | Translate audio to English text |
| `/v1/audio/speech` | Convert text to audio |

## Speech to Text (Transcription)

Convert audio files to text in the original language.

### Endpoint

```
POST /v1/audio/transcriptions
```

### Request

**Headers:**
```
Authorization: Bearer sk-your-api-key
Content-Type: multipart/form-data
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | Yes | Audio file (max 25 MB) |
| `model` | string | Yes | Model ID: `whisper-1` or `gpt-4.1-mini-transcribe` |
| `language` | string | No | Language code (ISO 639-1) |
| `prompt` | string | No | Context or spelling hints |
| `response_format` | string | No | `json`, `text`, `srt`, `vtt`, `verbose_json` |
| `temperature` | number | No | Sampling temperature (0-1, default 0) |

### Supported Audio Formats

- `flac`
- `mp3`
- `mp4`
- `mpeg`
- `mpga`
- `m4a`
- `ogg`
- `wav`
- `webm`

### Example: Basic Transcription

**cURL:**
```bash
curl https://api.apertis.ai/v1/audio/transcriptions \
  -H "Authorization: Bearer sk-your-api-key" \
  -F file="@audio.mp3" \
  -F model="whisper-1"
```

**Python:**
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

audio_file = open("audio.mp3", "rb")
transcript = client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file
)

print(transcript.text)
```

**Node.js:**
```javascript
import OpenAI from 'openai';
import fs from 'fs';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

const transcript = await client.audio.transcriptions.create({
  model: 'whisper-1',
  file: fs.createReadStream('audio.mp3')
});

console.log(transcript.text);
```

### Response

**JSON format (default):**
```json
{
  "text": "Hello, this is a transcription of the audio file."
}
```

**Verbose JSON format:**
```json
{
  "task": "transcribe",
  "language": "english",
  "duration": 5.5,
  "text": "Hello, this is a transcription of the audio file.",
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 2.5,
      "text": "Hello, this is",
      "tokens": [50364, 2425, 11, 341, 307],
      "temperature": 0.0,
      "avg_logprob": -0.25,
      "compression_ratio": 1.2,
      "no_speech_prob": 0.01
    }
  ]
}
```

### Example: With Language Hint

Improve accuracy by specifying the language:

```python
transcript = client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file,
    language="zh"  # Chinese
)
```

### Example: With Spelling Hints

Provide context for uncommon words:

```python
transcript = client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file,
    prompt="Apertis, API, OpenAI, GPT-4o"  # Spelling hints
)
```

### Example: SRT Subtitles

Generate subtitle files:

```python
transcript = client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file,
    response_format="srt"
)

# Save as .srt file
with open("subtitles.srt", "w") as f:
    f.write(transcript)
```

## Audio Translation

Translate audio from any language to English text.

### Endpoint

```
POST /v1/audio/translations
```

### Request

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | Yes | Audio file (max 25 MB) |
| `model` | string | Yes | Model ID (e.g., `whisper-1`) |
| `prompt` | string | No | Context hints |
| `response_format` | string | No | Output format |
| `temperature` | number | No | Sampling temperature |

### Example

**Python:**
```python
audio_file = open("french_audio.mp3", "rb")
translation = client.audio.translations.create(
    model="whisper-1",
    file=audio_file
)

print(translation.text)  # English translation
```

**cURL:**
```bash
curl https://api.apertis.ai/v1/audio/translations \
  -H "Authorization: Bearer sk-your-api-key" \
  -F file="@french_audio.mp3" \
  -F model="whisper-1"
```

### Response

```json
{
  "text": "Hello, how are you today?"
}
```

## Text to Speech (TTS)

Convert text to natural-sounding audio.

### Endpoint

```
POST /v1/audio/speech
```

### Request

**Headers:**
```
Authorization: Bearer sk-your-api-key
Content-Type: application/json
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | TTS model (e.g., `tts-1`, `tts-1-hd`) |
| `input` | string | Yes | Text to convert (max 4096 chars) |
| `voice` | string | Yes | Voice to use |
| `response_format` | string | No | `mp3`, `opus`, `aac`, `flac`, `wav`, `pcm` |
| `speed` | number | No | Speed (0.25-4.0, default 1.0) |

### Available Voices

| Voice | Description |
|-------|-------------|
| `alloy` | Neutral, balanced |
| `echo` | Warm, conversational |
| `fable` | Expressive, storytelling |
| `onyx` | Deep, authoritative |
| `nova` | Energetic, youthful |
| `shimmer` | Clear, pleasant |

### Available Models

| Model | Description | Quality |
|-------|-------------|---------|
| `tts-1` | Standard TTS | Good, fast |
| `tts-1-hd` | High-definition TTS | Best, slower |

### Example: Basic TTS

**Python:**
```python
response = client.audio.speech.create(
    model="tts-1",
    voice="alloy",
    input="Hello! Welcome to Apertis API documentation."
)

# Save to file
response.stream_to_file("output.mp3")
```

**Node.js:**
```javascript
const response = await client.audio.speech.create({
  model: 'tts-1',
  voice: 'alloy',
  input: 'Hello! Welcome to Apertis API documentation.'
});

const buffer = Buffer.from(await response.arrayBuffer());
fs.writeFileSync('output.mp3', buffer);
```

**cURL:**
```bash
curl https://api.apertis.ai/v1/audio/speech \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1",
    "voice": "alloy",
    "input": "Hello! Welcome to Apertis API documentation."
  }' \
  --output output.mp3
```

### Response

Binary audio data in the requested format. Default is `mp3`.

### Example: High-Quality Audio

```python
response = client.audio.speech.create(
    model="tts-1-hd",  # Higher quality
    voice="nova",
    input="This is high-definition audio.",
    response_format="flac"  # Lossless format
)
```

### Example: Adjusting Speed

```python
# Slower speech
response = client.audio.speech.create(
    model="tts-1",
    voice="onyx",
    input="Speaking slowly and clearly.",
    speed=0.75
)

# Faster speech
response = client.audio.speech.create(
    model="tts-1",
    voice="echo",
    input="Speaking quickly!",
    speed=1.5
)
```

### Streaming TTS

For real-time audio streaming:

```python
with client.audio.speech.with_streaming_response.create(
    model="tts-1",
    voice="alloy",
    input="Streaming audio in real-time..."
) as response:
    for chunk in response.iter_bytes():
        # Process audio chunks as they arrive
        audio_player.play(chunk)
```

## Supported Languages

### Transcription Languages

Whisper supports transcription in 50+ languages:

| Language | Code | Language | Code |
|----------|------|----------|------|
| English | en | Chinese | zh |
| Spanish | es | Japanese | ja |
| French | fr | Korean | ko |
| German | de | Arabic | ar |
| Italian | it | Hindi | hi |
| Portuguese | pt | Russian | ru |

[Full list of supported languages](https://platform.openai.com/docs/guides/speech-to-text/supported-languages)

### TTS Languages

Text-to-speech primarily supports:
- English (best quality)
- Most major languages (good quality)

:::note
While TTS can handle multiple languages, voice quality is optimized for English.
:::

## Best Practices

### Audio Quality

For best transcription results:

1. **Use high-quality audio** - 16kHz or higher sample rate
2. **Minimize background noise** - Clear recordings work best
3. **Use appropriate format** - MP3 or WAV recommended
4. **Keep files under 25MB** - Split longer recordings

### Optimizing TTS

1. **Use punctuation** - Helps with natural pauses
2. **Break long text** - Split into sentences for better pacing
3. **Choose appropriate voice** - Match voice to content type
4. **Adjust speed** - Slower for clarity, faster for efficiency

### Long Audio Handling

For files larger than 25MB:

```python
from pydub import AudioSegment

# Split audio into 10-minute chunks
audio = AudioSegment.from_file("long_audio.mp3")
chunk_length = 10 * 60 * 1000  # 10 minutes in milliseconds

chunks = [audio[i:i+chunk_length] for i in range(0, len(audio), chunk_length)]

transcripts = []
for i, chunk in enumerate(chunks):
    chunk.export(f"chunk_{i}.mp3", format="mp3")
    with open(f"chunk_{i}.mp3", "rb") as f:
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=f
        )
        transcripts.append(result.text)

full_transcript = " ".join(transcripts)
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid file format` | Unsupported audio format | Convert to MP3/WAV |
| `File too large` | Exceeds 25MB limit | Split into chunks |
| `Invalid model` | Model not available | Check model name |
| `Rate limit exceeded` | Too many requests | Implement backoff |

### Error Response Example

```json
{
  "error": {
    "message": "Invalid file format. Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm",
    "type": "invalid_request_error",
    "code": "invalid_file_format"
  }
}
```

## Pricing

For current model pricing, please visit the [Models page](https://apertis.ai/models).

## Related Topics

- [Chat Completions](./chat_completions) - Text generation API
- [Embeddings](./embeddings) - Text embeddings API
- [Rate Limits](../billing/rate-limits) - Request limits
- [Error Codes](../help/error-codes) - Error reference
