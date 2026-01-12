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

---

## Alternative API: /v1/videos

An alternative video generation API using multipart/form-data with reference images.

### Create Video with Reference Image

```
POST /v1/videos
```

Creates a video generation task with a reference image input.

#### HTTP Request

```bash
curl https://api.apertis.ai/v1/videos \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -F "model=veo_3_1" \
    -F "prompt=A serene lake with mountains" \
    -F "seconds=5" \
    -F "size=16x9" \
    -F "input_reference=@reference.jpg"
```

#### Parameters (multipart/form-data)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model ID: `veo_3_1`, `veo_3_1-fast` |
| `prompt` | string | Yes | Text description of the desired video |
| `seconds` | string | Yes | Video duration in seconds |
| `size` | string | Yes | Aspect ratio: `16x9` (landscape) or `720x1280` (portrait) |
| `input_reference` | file | Yes | Reference image file (base image for video) |
| `watermark` | string | No | Enable watermark: `true` or `false` |

#### Response Format

```json
{
  "id": "video_55cb73b3-60af-40c8-95fd-eae8fd758ade",
  "object": "video",
  "model": "veo_3_1",
  "status": "queued",
  "progress": 0,
  "created_at": 1704067200,
  "seconds": 5,
  "size": "16x9"
}
```

### Get Video Status

```
GET /v1/videos/{id}
```

Query the status of a video generation task.

#### HTTP Request

```bash
curl "https://api.apertis.ai/v1/videos/video_55cb73b3-60af-40c8-95fd-eae8fd758ade" \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

#### Response Format

```json
{
  "id": "video_55cb73b3-60af-40c8-95fd-eae8fd758ade",
  "status": "completed",
  "progress": 100,
  "video_url": "https://storage.example.com/videos/output.mp4",
  "enhanced_prompt": "A serene mountain lake...",
  "status_update_time": 1704067500
}
```

### Get Video Content

```
GET /v1/videos/{id}/content
```

Retrieve the video content directly.

#### HTTP Request

```bash
curl "https://api.apertis.ai/v1/videos/video_55cb73b3-60af-40c8-95fd-eae8fd758ade/content" \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

### Example: Complete Workflow

```python
import httpx
import time

headers = {"Authorization": "Bearer sk-your-api-key"}

# Step 1: Create video with reference image
with open("reference.jpg", "rb") as f:
    response = httpx.post(
        "https://api.apertis.ai/v1/videos",
        headers=headers,
        data={
            "model": "veo_3_1",
            "prompt": "A serene lake with mountains",
            "seconds": "5",
            "size": "16x9"
        },
        files={"input_reference": f}
    )

task = response.json()
video_id = task["id"]
print(f"Video created: {video_id}")

# Step 2: Poll for completion
while True:
    status_resp = httpx.get(
        f"https://api.apertis.ai/v1/videos/{video_id}",
        headers=headers
    )
    result = status_resp.json()
    print(f"Status: {result['status']}, Progress: {result.get('progress', 0)}%")

    if result["status"] == "completed":
        print(f"Video URL: {result['video_url']}")
        break

    time.sleep(10)
```

---

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
| `veo_3_1` | Veo 3.1 (for /v1/videos API) | Yes (`16x9`, `720x1280`) |
| `veo_3_1-fast` | Veo 3.1 fast (for /v1/videos API) | Yes (`16x9`, `720x1280`) |

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
