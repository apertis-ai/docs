# Images API

```
POST /v1/images/generations
```

The Images API generates images from text prompts using models like DALL-E, gpt-image-1, and gpt-image-1.5.

## HTTP Request

```bash
curl https://api.apertis.ai/v1/images/generations \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "gpt-image-1",
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
| `prompt` | string | A text description of the desired image(s). Maximum 4000 characters |

### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | The model to use for image generation. Default: `dall-e-2` |
| `n` | integer | Number of images to generate (1-10). Default: 1 |
| `size` | string | Size of the generated images (see Size Options below) |
| `quality` | string | Quality of the image: `standard`, `hd`. Default: `standard` |
| `response_format` | string | Format of the response: `url`, `b64_json`. Default: `url` |
| `style` | string | Style of the image: `vivid`, `natural`. Default: `vivid` |
| `user` | string | A unique identifier for the end-user |

### gpt-image-1 and gpt-image-1.5 Specific Parameters

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
| `dall-e-2` | `256x256`, `512x512`, `1024x1024` |
| `dall-e-3` | `1024x1024`, `1792x1024`, `1024x1792` |
| `gpt-image-1` | `1024x1024`, `1536x1024`, `1024x1536`, `auto` |
| `gpt-image-1.5` | `1024x1024`, `1536x1024`, `1024x1536`, `auto` |

## Example Usage

### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.images.generate(
    model="gpt-image-1",
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
  model: 'gpt-image-1',
  prompt: 'A white siamese cat',
  n: 1,
  size: '1024x1024'
});

console.log(response.data[0].url);
```

### With Transparent Background (gpt-image-1)

```python
response = client.images.generate(
    model="gpt-image-1",
    prompt="A logo of a blue bird on transparent background",
    n=1,
    size="1024x1024",
    background="transparent"
)
```

### HD Quality with DALL-E 3

```python
response = client.images.generate(
    model="dall-e-3",
    prompt="A stunning sunset over mountains",
    n=1,
    size="1792x1024",
    quality="hd",
    style="vivid"
)
```

## Response Format

### DALL-E Response (with URL)

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
| `data[].url` | string | URL of the generated image (DALL-E models only, valid for 60 minutes) |
| `data[].b64_json` | string | Base64-encoded image (GPT image models, or when `response_format` is `b64_json`) |
| `data[].revised_prompt` | string | The prompt used to generate the image (may be revised by the model) |
| `usage` | object | Token usage information (GPT image models only) |
| `usage.total_tokens` | integer | Total tokens used |
| `usage.input_tokens` | integer | Input tokens used |
| `usage.output_tokens` | integer | Output tokens used |

## Supported Models

| Model | Description |
|-------|-------------|
| `dall-e-2` | Original DALL-E model, fast generation |
| `dall-e-3` | Higher quality, better prompt following |
| `gpt-image-1` | Advanced model with transparent background support |
| `gpt-image-1.5` | Latest model with enhanced image quality and transparent background support |

## Image Edits

```
POST /v1/images/edits
```

The Image Edits endpoint allows you to edit or extend existing images using models like gpt-image-1 and gpt-image-1.5.

### HTTP Request

```bash
curl https://api.apertis.ai/v1/images/edits \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -F "image=@original.png" \
    -F "prompt=Add a rainbow in the sky" \
    -F "model=gpt-image-1" \
    -F "size=1024x1024"
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | file | Yes | The image to edit. PNG, WebP, or JPG under 50MB for gpt-image-1/1.5 |
| `prompt` | string | Yes | A text description of the desired edit. Max 32,000 characters for gpt-image-1/1.5 |
| `mask` | file | No | Mask image indicating transparent areas to edit. PNG under 4MB |
| `model` | string | No | Model to use: `gpt-image-1`, `gpt-image-1.5`, `flux-kontext-pro`, `flux-kontext-max` |
| `n` | integer | No | Number of images to generate (1-10). Default: 1 |
| `size` | string | No | Size: `1024x1024`, `1536x1024`, `1024x1536`, `auto`. Default: `auto` |
| `quality` | string | No | Quality: `high`, `medium`, `low`, `auto`. Default: `auto` for gpt-image-1/1.5 |
| `response_format` | string | No | Response format: `url`, `b64_json`. GPT image models always return base64 |
| `user` | string | No | A unique identifier for the end-user |

### gpt-image-1 and gpt-image-1.5 Edit Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `background` | string | Background type: `transparent`, `opaque`, `auto`. Default: `auto` |
| `moderation` | string | Moderation level: `low`, `auto`. Default: `auto` |
| `output_format` | string | Output format: `png`, `jpeg`, `webp`. Default: `png` |
| `output_compression` | integer | Compression level (0-100%) for `jpeg`/`webp` output formats. Default: `100` |

### gpt-image-1 Only Parameter

| Parameter | Type | Description |
|-----------|------|-------------|
| `input_fidelity` | string | Control how much the model matches input image features: `high`, `low`. Default: `low` |

### Example Usage

#### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-api-key",
    base_url="https://api.apertis.ai/v1"
)

response = client.images.edit(
    model="gpt-image-1",
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
  model: 'gpt-image-1',
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
    model="gpt-image-1",
    image=open("original.png", "rb"),
    mask=open("mask.png", "rb"),
    prompt="Replace the masked area with a beautiful garden",
    n=1,
    size="1024x1024"
)
```

## Related Topics

- [Chat Completions](./chat_completions) - Text generation with chat models
- [Audio](./audio) - Speech-to-text and text-to-speech
- [Models](./models) - List available models
