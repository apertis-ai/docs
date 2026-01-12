# Video API

The Video API generates videos from text prompts using models like Veo2, Veo3, and Sora-2. Video generation is asynchronous - you create a task and poll for completion.

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

#### Sora-2 Specific Parameters

For Sora-2 models (`sora-2`, `sora-2-pro`), the following parameters are used instead:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model ID: `sora-2`, `sora-2-pro` |
| `prompt` | string | Yes | Text description of the desired video |
| `images` | array | Yes | Array of image URLs for reference |
| `orientation` | string | No | Video orientation: `portrait` or `landscape` |
| `size` | string | No | Quality level: `small` (~720p) or `large` (1080p HD) |
| `duration` | integer | No | Video duration: `10`, `15`, or `25` seconds |
| `watermark` | boolean | No | Enable watermark. Default: true |
| `private` | boolean | No | Keep video private (unpublished). Default: false |
| `character_url` | string | No | Video URL (1-3 seconds) for character creation |
| `character_timestamps` | string | No | Character timing in `{start},{end}` format |

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

### Sora-2 Complete Workflow

```python
import httpx
import time

client_headers = {
    "Authorization": "Bearer sk-your-api-key",
    "Content-Type": "application/json"
}

# Step 1: Create video generation task with Sora-2
response = httpx.post(
    "https://api.apertis.ai/v1/video/create",
    headers=client_headers,
    json={
        "model": "sora-2",
        "prompt": "A cinematic scene of a person walking through a forest",
        "images": ["https://example.com/reference.jpg"],
        "orientation": "landscape",  # "portrait" or "landscape"
        "size": "large",  # "small" (~720p) or "large" (1080p)
        "duration": 10,  # 10, 15, or 25 seconds
        "watermark": True,
        "private": False
    }
)

task = response.json()
task_id = task["id"]
print(f"Task created: {task_id}")

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

    time.sleep(10)
```

### Sora-2 with Character Creation

```python
# Create video with custom character
response = httpx.post(
    "https://api.apertis.ai/v1/video/create",
    headers=client_headers,
    json={
        "model": "sora-2-pro",
        "prompt": "A character dancing in a studio",
        "images": ["https://example.com/reference.jpg"],
        "orientation": "portrait",
        "size": "large",
        "duration": 15,
        "character_url": "https://example.com/character-video.mp4",  # 1-3 second video
        "character_timestamps": "0,3"  # Use frames 0-3 seconds
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

### Veo Models

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

### Sora Models

| Model | Description | Duration Support |
|-------|-------------|------------------|
| `sora-2` | Sora 2 base model | 10 seconds |
| `sora-2-pro` | Sora 2 professional quality | 10, 15, or 25 seconds |

:::note Sora-2 Model Parameters
Sora-2 models use different parameters than Veo models:
- **orientation**: `portrait` or `landscape` (instead of `aspect_ratio`)
- **size**: `small` (~720p) or `large` (1080p HD)
- **duration**: Video length in seconds (10, 15, or 25)
- **images**: Required array of reference image URLs
- **character_url** / **character_timestamps**: Optional character creation support
:::

---

## Sora-2 Chat Completions API

Sora-2 models also support video generation through the standard `/v1/chat/completions` endpoint with streaming responses.

### HTTP Request

```bash
curl https://api.apertis.ai/v1/chat/completions \
    -H "Authorization: Bearer <APERTIS_API_KEY>" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "sora-2",
        "stream": true,
        "messages": [
            {
                "role": "user",
                "content": "Generate a video of a serene lake with mountains"
            }
        ]
    }'
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model ID: `sora-2`, `sora-2-pro` |
| `stream` | boolean | Recommended | Enable streaming responses (recommended: `true`) |
| `messages` | array | Yes | Message array with video prompt in content |

### Streaming Response

The response uses Server-Sent Events (SSE) format with progress updates:

```
data: {"choices":[{"delta":{"content":"task_id: sora-2:1234567890-abcdefgh"}}]}

data: {"choices":[{"delta":{"content":"progress: 25%"}}]}

data: {"choices":[{"delta":{"content":"video_url: https://storage.example.com/videos/output.mp4"}}]}

data: [DONE]
```

### Python Example

```python
import httpx

# Sora-2 video generation via chat/completions with streaming
with httpx.stream(
    "POST",
    "https://api.apertis.ai/v1/chat/completions",
    headers={
        "Authorization": "Bearer sk-your-api-key",
        "Content-Type": "application/json"
    },
    json={
        "model": "sora-2",
        "stream": True,
        "messages": [
            {
                "role": "user",
                "content": "Generate a video of a serene lake with mountains"
            }
        ]
    }
) as response:
    for line in response.iter_lines():
        if line.startswith("data: "):
            data = line[6:]
            if data == "[DONE]":
                break
            # Parse SSE data for task_id and video_url
            print(data)
```

### JavaScript Example

```javascript
// Sora-2 video generation via chat/completions with streaming
const response = await fetch('https://api.apertis.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk-your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'sora-2',
    stream: true,
    messages: [
      {
        role: 'user',
        content: 'Generate a video of a serene lake with mountains'
      }
    ]
  })
});

// Process SSE stream for video generation progress
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      // Parse SSE data for task_id and video_url
      console.log(JSON.parse(data));
    }
  }
}
```

:::tip When to Use Chat Completions vs Video Create
- Use `/v1/chat/completions` for simple video generation with streaming progress
- Use `/v1/video/create` when you need full control over parameters like `orientation`, `size`, `duration`, `character_url`, etc.
:::

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
