# Images API

```
POST /v1/images/generations
```

The Images API generates images from text prompts using GPT image models such as `gpt-image-2`.

## HTTP Request

```bash
curl https://api.apertis.ai/v1/images/generations \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-image-2",
        "prompt": "A cute baby sea otter",
        "n": 1,
        "size": "1024x1024"
    }'
```

## Authentication

| Header | Format | Example |
|--------|--------|---------|
| `Authorization` | Bearer token | `Authorization: Bearer sk-your-api-key` |

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string | A text description of the desired image(s). See prompt limits below |

### Prompt Length Limits

| Model | Max Prompt Length |
|-------|-------------------|
| `gpt-image-2` | 32000 characters |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | The model to use for image generation, e.g. `gpt-image-2`. See [Models](/models/) for the current image models |
| `n` | integer | Number of images to generate (1-10). Default: 1 |
| `size` | string | Size of the generated images (see Size Options below) |
| `quality` | string | Quality of the image: `high`, `medium`, `low`, `auto`. Default: `auto` |
| `response_format` | string | Format of the response: `url`, `b64_json`. Default: `url` |
| `user` | string | A unique identifier for the end-user |

### GPT Image Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `background` | string | Background type: `transparent`, `opaque`, `auto`. Default: `auto` |
| `moderation` | string | Moderation level: `low`, `auto`. Default: `auto` |
| `output_format` | string | Output format: `png`, `jpeg`, `webp`. Default: `png` |
| `output_compression` | integer | Compression level (0-100%) for `jpeg`/`webp` output formats. Default: `100` |

> **Note:** GPT image models always return base64-encoded images (`b64_json`). The `response_format` parameter with `url` option is not supported for these models.

### Size Options

| Model | Supported Sizes |
|-------|-----------------|
| `gpt-image-2` | `1024x1024`, `1536x1024`, `1024x1536`, `auto` |

## Example Usage

### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.images.generate(
    model="gpt-image-2",
    prompt="A white siamese cat",
    n=1,
    size="1024x1024"
)

print(response.data[0].url)
```

### JavaScript

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

const response = await client.images.generate({
  model: 'gpt-image-2',
  prompt: 'A white siamese cat',
  n: 1,
  size: '1024x1024'
});

console.log(response.data[0].url);
```

### With Transparent Background

```python
response = client.images.generate(
    model="gpt-image-2",
    prompt="A logo of a blue bird on transparent background",
    n=1,
    size="1024x1024",
    background="transparent"
)
```

## Response Format

### URL Response

```json
{
  "created": 1699000000,
  "data": [
    {
      "url": "https://...",
      "revised_prompt": "A cute baby sea otter floating on its back..."
    }
  ]
}
```

### GPT Image Response (base64)

```json
{
  "created": 1699000000,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAA..."
    }
  ],
  "usage": {
    "total_tokens": 100,
    "input_tokens": 50,
    "output_tokens": 50
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `created` | integer | Unix timestamp of when the image was created |
| `data` | array | Array of generated image objects |
| `data[].url` | string | URL of the generated image, for models that return URLs (valid for 60 minutes) |
| `data[].b64_json` | string | Base64-encoded image (GPT image models, or when `response_format` is `b64_json`) |
| `data[].revised_prompt` | string | The prompt used to generate the image (may be revised by the model) |
| `usage` | object | Token usage information (GPT image models only) |
| `usage.total_tokens` | integer | Total tokens used |
| `usage.input_tokens` | integer | Input tokens used |
| `usage.output_tokens` | integer | Output tokens used |

## Supported Models

| Model | Description |
|-------|-------------|
| `gpt-image-2` | OpenAI image generation and editing, with transparent background support |

## Image Edits

```
POST /v1/images/edits
```

The Image Edits endpoint allows you to edit or extend existing images using GPT image models such as `gpt-image-2`.

### HTTP Request

```bash
curl https://api.apertis.ai/v1/images/edits \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -F "image=@original.png" \
    -F "prompt=Add a rainbow in the sky" \
    -F "model=gpt-image-2" \
    -F "size=1024x1024"
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | file | Yes | The image to edit. PNG, WebP, or JPG under 50MB for GPT image models |
| `prompt` | string | Yes | A text description of the desired edit. Max 32,000 characters for GPT image models |
| `mask` | file | No | Mask image indicating transparent areas to edit. PNG under 4MB |
| `model` | string | Yes | Model to use, e.g. `gpt-image-2`. Always set it: when omitted, the gateway falls back to `gpt-image-1`, which is no longer offered |
| `n` | integer | No | Number of images to generate (1-10). Default: 1 |
| `size` | string | No | Size: `1024x1024`, `1536x1024`, `1024x1536`, `auto`. Default: `auto` |
| `quality` | string | No | Quality: `high`, `medium`, `low`, `auto`. Default: `auto` |
| `response_format` | string | No | Response format: `url`, `b64_json`. GPT image models always return base64 |
| `user` | string | No | A unique identifier for the end-user |

### GPT Image Edit Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `background` | string | Background type: `transparent`, `opaque`, `auto`. Default: `auto` |
| `moderation` | string | Moderation level: `low`, `auto`. Default: `auto` |
| `output_format` | string | Output format: `png`, `jpeg`, `webp`. Default: `png` |
| `output_compression` | integer | Compression level (0-100%) for `jpeg`/`webp` output formats. Default: `100` |

### Example Usage

#### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.images.edit(
    model="gpt-image-2",
    image=open("original.png", "rb"),
    prompt="Add a sunset in the background",
    n=1,
    size="1024x1024"
)

print(response.data[0].url)
```

#### JavaScript

```javascript
import OpenAI from 'openai';
import fs from 'fs';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'https://api.apertis.ai/v1'
});

const response = await client.images.edit({
  model: 'gpt-image-2',
  image: fs.createReadStream('original.png'),
  prompt: 'Add a sunset in the background',
  n: 1,
  size: '1024x1024'
});

console.log(response.data[0].url);
```

#### With Mask for Inpainting

```python
response = client.images.edit(
    model="gpt-image-2",
    image=open("original.png", "rb"),
    mask=open("mask.png", "rb"),
    prompt="Replace the masked area with a beautiful garden",
    n=1,
    size="1024x1024"
)
```

## Related Topics

- [Chat Completions](/api/text-generation/chat-completions) - Text generation with chat models
- [Audio](/api/audio-video/audio) - Speech-to-text and text-to-speech
- [Models](/api/utilities/models) - List available models
