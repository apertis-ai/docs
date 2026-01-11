# Images API

```
POST /v1/images/generations
```

The Images API generates images from text prompts using models like DALL-E and gpt-image-1.

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

### gpt-image-1 Specific Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `background` | string | Background type: `transparent`, `opaque`, `auto`. Default: `auto` |
| `moderation` | string | Moderation level: `low`, `auto`. Default: `auto` |

### Size Options

| Model | Supported Sizes |
|-------|-----------------|
| `dall-e-2` | `256x256`, `512x512`, `1024x1024` |
| `dall-e-3` | `1024x1024`, `1792x1024`, `1024x1792` |
| `gpt-image-1` | `1024x1024`, `1536x1024`, `1024x1536`, `auto` |

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

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `created` | integer | Unix timestamp of when the image was created |
| `data` | array | Array of generated image objects |
| `data[].url` | string | URL of the generated image (when response_format is `url`) |
| `data[].b64_json` | string | Base64-encoded image (when response_format is `b64_json`) |
| `data[].revised_prompt` | string | The prompt used to generate the image (may be revised by the model) |

## Supported Models

| Model | Description |
|-------|-------------|
| `dall-e-2` | Original DALL-E model, fast generation |
| `dall-e-3` | Higher quality, better prompt following |
| `gpt-image-1` | Latest model with transparent background support |

## Image Edits

```
POST /v1/images/edits
```

The Image Edits endpoint allows you to edit or extend existing images using models like gpt-image-1.

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
| `image` | file | Yes | The image to edit. PNG, WebP, or JPG under 25MB for gpt-image-1 |
| `prompt` | string | Yes | A text description of the desired edit. Max 32,000 characters for gpt-image-1 |
| `mask` | file | No | Mask image indicating transparent areas to edit. PNG under 4MB |
| `model` | string | No | Model to use: `gpt-image-1`, `gpt-image-1-all`, `flux-kontext-pro`, `flux-kontext-max` |
| `n` | integer | No | Number of images to generate (1-10). Default: 1 |
| `size` | string | No | Size: `1024x1024`, `1536x1024`, `1024x1536`, `auto`. Default: `1024x1024` |
| `quality` | string | No | Quality: `high`, `medium`, `low`. Default for gpt-image-1 |
| `response_format` | string | No | Response format: `url`, `b64_json`. gpt-image-1 always returns base64 |
| `background` | string | No | Background type: `transparent`, `opaque`, `auto`. Default: `auto` |
| `moderation` | string | No | Moderation level: `low`, `auto`. Default: `auto` |

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
