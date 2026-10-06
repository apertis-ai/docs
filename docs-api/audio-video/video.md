# Video API

:::caution Not currently available
Video generation is not available on `api.apertis.ai`. Requests to `/v1/video/create`, `/v1/video/query`, `/v1/videos` (including its `/{id}`, `/{id}/content` and `/{id}/remix` routes) and `/sora/v1/characters` return HTTP 404 `Invalid URL` (checked 2026-10-06).
:::

The [model catalog](/models/) lists Veo models in its video category, but no API endpoint serves them at the moment.

## Video understanding

To have a model analyse a video rather than generate one, send the video to a video-capable chat model through Chat Completions. See [Video understanding with the Python SDK](/api/sdks/python-sdk/video).
