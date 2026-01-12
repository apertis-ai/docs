# Video API

The Video API generates videos from text prompts using models like Veo2 and Veo3. Video generation is asynchronous - you create a task and poll for completion.

## Create Video

```
POST /v1/video/create
```

Creates an asynchronous video generation task.

### HTTP Request

```bash
curl https://api.apertis.ai/v1/video/create \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -d '{
        "model": "veo3",
        "prompt": "A serene lake with mountains in the background at sunset",
        "enhance_prompt": true,
        "aspect_ratio": "16:9"
    }'
```

### Authentication

| Header | Format | Example |
|--------|--------|---------|
| `Authorization` | Bearer token | `Authorization: Bearer sk-your-api-key` |

### Parameters

#### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | The model to use for video generation (see Supported Models below) |
| `prompt` | string | A text description of the desired video |

#### Optional Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `enhance_prompt` | boolean | Automatically enhance and translate prompts (Chinese to English). Default: false |
| `enable_upsample` | boolean | Upscale video quality. Default: false |
| `aspect_ratio` | string | Video aspect ratio: `16:9` or `9:16`. Only supported by veo3 models |
| `images` | array | Reference images for frame control (model-specific limits, see below) |

#### Image Reference Limits by Model

| Model Variant | Max Images | Description |
|---------------|------------|-------------|
| `veo2-fast-frames` | 2 | First and last frame references |
| `veo3-pro-frames` | 1 | First frame reference only |
| `veo2-fast-components` | 3 | Video element components |

### Response Format

```json
{
  "id": "veo3:1234567890-abcdefgh",
  "status": "pending",
  "status_update_time": 1704067200,
  "enhanced_prompt": "A tranquil mountain lake reflecting golden sunset light..."
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier for polling status |
| `status` | string | Current task status: `pending`, `processing`, `completed`, `failed` |
| `status_update_time` | integer | Unix timestamp of last status update |
| `enhanced_prompt` | string | The processed/enhanced prompt used for generation |

## Query Video Status

```
GET /v1/video/query
```

Query the status of a video generation task.

### HTTP Request

```bash
curl "https://api.apertis.ai/v1/video/query?id=veo3:1234567890-abcdefgh" \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The task ID returned from `/v1/video/create` |

### Response Format

#### Pending/Processing

```json
{
  "id": "veo3:1234567890-abcdefgh",
  "status": "processing",
  "video_url": null,
  "enhanced_prompt": "A tranquil mountain lake reflecting golden sunset light...",
  "status_update_time": 1704067200
}
```

#### Completed

```json
{
  "id": "veo3:1234567890-abcdefgh",
  "status": "completed",
  "video_url": "https://storage.example.com/videos/output.mp4",
  "enhanced_prompt": "A tranquil mountain lake reflecting golden sunset light...",
  "status_update_time": 1704067500
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Task identifier |
| `status` | string | Task status: `pending`, `processing`, `completed`, `failed` |
| `video_url` | string/null | URL to the generated video (available when status is `completed`) |
| `enhanced_prompt` | string | The processed prompt used for generation |
| `status_update_time` | integer | Unix timestamp of last status update |

## Example Usage

### Python - Complete Workflow

```python
import httpx
import time

client_headers = {
    "Authorization": "Bearer sk-your-api-key",
    "Content-Type": "application/json"
}

# Step 1: Create video generation task
response = httpx.post(
    "https://api.apertis.ai/v1/video/create",
    headers=client_headers,
    json={
        "model": "veo3",
        "prompt": "A serene lake with mountains in the background at sunset",
        "enhance_prompt": True,
        "aspect_ratio": "16:9"
    }
)

task = response.json()
task_id = task["id"]
print(f"Task created: {task_id}")
print(f"Enhanced prompt: {task.get('enhanced_prompt', 'N/A')}")

# Step 2: Poll for completion
while True:
    query_response = httpx.get(
        f"https://api.apertis.ai/v1/video/query?id={task_id}",
        headers=client_headers
    )
    result = query_response.json()
    status = result["status"]
    print(f"Status: {status}")

    if status == "completed":
        print(f"Video URL: {result['video_url']}")
        break
    elif status == "failed":
        print("Video generation failed")
        break

    time.sleep(10)  # Poll every 10 seconds
```

### JavaScript - Complete Workflow

```javascript
const headers = {
  'Authorization': 'Bearer sk-your-api-key',
  'Content-Type': 'application/json'
};

// Step 1: Create video generation task
const createResponse = await fetch('https://api.apertis.ai/v1/video/create', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    model: 'veo3',
    prompt: 'A serene lake with mountains in the background at sunset',
    enhance_prompt: true,
    aspect_ratio: '16:9'
  })
});

const task = await createResponse.json();
const taskId = task.id;
console.log('Task created:', taskId);

// Step 2: Poll for completion
const pollStatus = async () => {
  const queryResponse = await fetch(
    `https://api.apertis.ai/v1/video/query?id=${taskId}`,
    { headers }
  );
  const result = await queryResponse.json();
  console.log('Status:', result.status);

  if (result.status === 'completed') {
    console.log('Video URL:', result.video_url);
    return result;
  } else if (result.status === 'failed') {
    throw new Error('Video generation failed');
  }

  await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds
  return pollStatus();
};

await pollStatus();
```

### With Frame References (veo2-fast-frames)

```python
response = httpx.post(
    "https://api.apertis.ai/v1/video/create",
    headers=client_headers,
    json={
        "model": "veo2-fast-frames",
        "prompt": "A bird flying across the sky",
        "images": [
            "https://example.com/first-frame.jpg",  # First frame
            "https://example.com/last-frame.jpg"    # Last frame
        ]
    }
)
```

## Supported Models

| Model | Description | Aspect Ratio Support |
|-------|-------------|---------------------|
| `veo2` | Veo 2 base model | No |
| `veo2-fast` | Veo 2 fast generation | No |
| `veo2-pro` | Veo 2 professional quality | No |
| `veo2-fast-frames` | Veo 2 with frame references (max 2 images) | No |
| `veo2-fast-components` | Veo 2 with component references (max 3 images) | No |
| `veo3` | Veo 3 base model | Yes (`16:9`, `9:16`) |
| `veo3-fast` | Veo 3 fast generation | Yes (`16:9`, `9:16`) |
| `veo3-pro` | Veo 3 professional quality | Yes (`16:9`, `9:16`) |
| `veo3-pro-frames` | Veo 3 with frame reference (max 1 image) | Yes (`16:9`, `9:16`) |
| `veo3.1` | Veo 3.1 latest model | Yes (`16:9`, `9:16`) |
| `veo3.1-fast` | Veo 3.1 fast generation | Yes (`16:9`, `9:16`) |

## Error Responses

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 402 | Payment Required - Insufficient quota |
| 404 | Not Found - Task ID not found |
| 429 | Rate Limited - Too many requests |
| 500 | Internal Server Error |

## Related Topics

- [Images API](./images) - Image generation
- [Chat Completions](./chat_completions) - Text generation
- [Models](./models) - List available models
