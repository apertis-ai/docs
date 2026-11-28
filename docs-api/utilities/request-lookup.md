# Request Lookup

```json
GET /v1/requests/{request_id}
```

Returns what one request made with your API key cost and how it ran: the model, the token counts (including prompt-cache reads and writes), the latency, the time to first token, the finish reason and the amount charged. Every response from the API carries the request's ID in the `X-Apertis-Request-Id` header; pass that ID here.

A key can look up only its own requests. The ID of another account's request, the ID of a request made with a different key, an ID that does not exist and an ID longer than 64 characters all return the same `404`.

## Example

```bash tab="cURL"
curl "https://api.apertis.ai/v1/requests/<REQUEST_ID>" \
    -H "Authorization: Bearer <APERTIS_API_KEY>"
```

```python tab="Python"
import requests

response = requests.get(
    "https://api.apertis.ai/v1/requests/<REQUEST_ID>",
    headers={"Authorization": "Bearer <APERTIS_API_KEY>"},
)
print(response.json()["data"]["total_charged_usd"])
```

```javascript tab="JavaScript"
const response = await fetch('https://api.apertis.ai/v1/requests/<REQUEST_ID>', {
  headers: { Authorization: 'Bearer <APERTIS_API_KEY>' },
});
const { data } = await response.json();
console.log(data.total_charged_usd);
```

- `<REQUEST_ID>`: The value of the `X-Apertis-Request-Id` response header
- `<APERTIS_API_KEY>`: The API key that made the request

## Response

```json
{
  "success": true,
  "data": {
    "request_id": "<REQUEST_ID>",
    "total_charged_usd": 0.001842,
    "entries": [
      {
        "created_at": 1795910400,
        "model": "gpt-5.5",
        "type": "request",
        "billed_to": "credits",
        "charged_usd": 0.001842,
        "usage": {
          "prompt_tokens": 1200,
          "completion_tokens": 310,
          "cache_read_tokens": 800,
          "cache_write_5m_tokens": 0,
          "cache_write_1h_tokens": 0,
          "reasoning_tokens": 64
        },
        "latency_ms": 2140,
        "ttft_ms": 480,
        "is_stream": true,
        "finish_reason": "stop"
      }
    ]
  }
}
```

### Data fields

| Field | Description |
|-------|-------------|
| `request_id` | The ID you asked for |
| `total_charged_usd` | Sum of the amounts in `entries` that were charged to your credits |
| `entries` | One entry per billed step of the request, oldest first, at most 20. A request can have more than one entry when part of its work was billed as a separate step under the same ID |

### Entry fields

| Field | Description |
|-------|-------------|
| `created_at` | Unix timestamp, in seconds |
| `model` | The model that was billed |
| `type` | `request`, or `cache_hit` when the response came from the response cache |
| `billed_to` | `credits`, `subscription` or `subscription_and_credits` |
| `charged_usd` | Amount charged to your credits, in USD. `0` when `billed_to` is `subscription`. `null` when `billed_to` is `subscription_and_credits`, because the split between the plan and your credits is not reported here |
| `usage.prompt_tokens` | Input tokens |
| `usage.completion_tokens` | Output tokens |
| `usage.cache_read_tokens` | Input tokens read from the prompt cache |
| `usage.cache_write_5m_tokens` | Input tokens written to the 5-minute prompt cache |
| `usage.cache_write_1h_tokens` | Input tokens written to the 1-hour prompt cache |
| `usage.reasoning_tokens` | Reasoning tokens, when the model reports them |
| `latency_ms` | Total request time in milliseconds, when measured |
| `ttft_ms` | Time to first token in milliseconds, when measured |
| `is_stream` | Whether the request was streamed, when recorded |
| `finish_reason` | Why generation stopped, when recorded |

Fields marked "when measured", "when recorded" or "when the model reports them" are left out of the entry when there is no value.

## Timing

A request is billed after its response has been sent. A lookup made immediately after the response can therefore return `404`; repeat it after a short wait.

## Errors

| Status | `error.code` | Meaning |
|--------|--------------|---------|
| `401` | | The API key is missing or not valid |
| `403` | | A restricted key without the `key_info` permission |
| `404` | `request_not_found` | The ID is unknown, belongs to another account or key, or is not billed yet |
| `429` | | Too many lookups. Retry after the `Retry-After` interval |

A key created with restricted permissions needs the **Read this key's info and usage** (`key_info`) permission to call this endpoint. Keys without permission restrictions can always call it.

Lookups are rate limited per account. See [Rate Limits](/billing/rate-limits).

## Reading the request ID in a browser

The `X-Apertis-Request-Id` header is exposed to browser code through CORS, so `response.headers.get('X-Apertis-Request-Id')` works in a `fetch` call to the API.
