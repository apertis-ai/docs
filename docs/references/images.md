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

## Image Edits (Coming Soon)

```
POST /v1/images/edits
```

The Image Edits endpoint allows you to edit or extend existing images. This endpoint is currently in development.

### Planned Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `image` | file | The image to edit (PNG, max 4MB) |
| `prompt` | string | A text description of the desired edit |
| `mask` | file | Mask image indicating areas to edit |
| `model` | string | Model to use |
| `n` | integer | Number of images to generate |
| `size` | string | Size of the generated images |
| `background` | string | Background type (gpt-image-1 only) |
| `moderation` | string | Moderation level (gpt-image-1 only) |

## Related Topics

- [Chat Completions](./chat_completions) - Text generation with chat models
- [Audio](./audio) - Speech-to-text and text-to-speech
- [Models](./models) - List available models
