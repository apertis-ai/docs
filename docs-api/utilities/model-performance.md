# Model Performance

```json
GET /api/v2/model-performance
```

Returns, for each public model, the P50 and P95 of end-to-end latency and of time to first token
(TTFT), the share of finished requests that were delivered, and the model's current service state,
over the last 1, 24 or 168 hours. The endpoint is public: it takes no API key.

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `window` | `24h` | One of `1h`, `24h`, `7d`. Any other value is `400 invalid_window`. |
| `ids` | all public models | Model ids, repeated (`ids=a&ids=b`), comma-separated (`ids=a,b`) or both. At most 100 per request; more is `400 too_many_ids`. |

## Example

```bash tab="cURL"
curl "https://api.apertis.ai/api/v2/model-performance?window=24h&ids=gpt-5.5,unknown-model"
```

```python tab="Python"
import requests

response = requests.get(
    "https://api.apertis.ai/api/v2/model-performance",
    params={"window": "24h", "ids": "gpt-5.5,unknown-model"},
)
for item in response.json()["models"]:
    print(item["model_id"], item["latency"]["p50_seconds"], item["ttft"]["p50_seconds"])
```

### Response

```json
{
  "schema_version": 1,
  "window": "24h",
  "window_start": "2026-11-24T03:00:00Z",
  "window_end": "2026-11-25T03:00:00Z",
  "generated_at": "2026-11-25T04:02:11Z",
  "models": [
    {
      "model_id": "gpt-5.5",
      "service_state": "accepting_requests",
      "latency": {"p50_seconds": 1.84, "p95_seconds": 6.12, "data_state": "observed"},
      "ttft": {"p50_seconds": 0.62, "p95_seconds": null, "data_state": "observed"},
      "success_ratio": {"value": 0.991, "data_state": "observed"}
    }
  ],
  "not_found": ["unknown-model"]
}
```

## Window

The window ends at the last full hour that Apertis has finished measuring, which is usually one to
two hours ago, and covers the 1, 24 or 168 hours before it. `window_start` and `window_end` give the
exact bounds. Measurements started when this endpoint was released, so for its first week the `24h` and `7d`
windows hold fewer hours than they span.

## Metrics

- **`latency`**: end-to-end time of successful non-streamed requests with 1 to 256 output tokens.
- **`ttft`**: time from dispatching a streamed request to its first output token, over successful
  streamed requests.
- Both are computed from histograms with buckets a factor of 1.25 wide, so a value is within one
  bucket of the exact percentile. Values are in seconds, rounded to 0.01.
- **`success_ratio`**: delivered requests out of finished requests, rounded to 0.001. Client errors
  and cancellations are not counted.
- **`service_state`**: the model's current state, the same value the model status page shows.

## `data_state`

Request counts are never returned. Instead each metric says how much it rests on:

| `data_state` | Meaning |
|---|---|
| `observed` | P50 needs 20 samples and P95 needs 100; below 100, `p95_seconds` is `null`. The success ratio needs 100 finished requests. |
| `insufficient_samples` | There were samples, but fewer than the floor; the values are `null`. |
| `no_data` | There were no samples in the window. |
| `unavailable` | Measurement is delayed by more than 2 hours; all values are `null`, and so are `window_start` and `window_end`. |

Hidden, unknown and non-public ids are listed in `not_found`, in request order. Without `ids`, every
public model is returned, sorted by id.

## Errors

Errors carry a fixed code and message:

```json
{"error": {"code": "invalid_window", "message": "window must be one of 1h, 24h, 7d."}}
```

| Status | `code` |
|---|---|
| 400 | `invalid_window`, `too_many_ids` |
| 503 | `unavailable` |

## Caching

Successful responses carry `Cache-Control: public, max-age=60, s-maxage=300`, and the values change
at most once an hour. Errors are `no-store`.
