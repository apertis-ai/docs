# Organization Usage and Costs

```json
GET /v1/organization/usage/completions
GET /v1/organization/costs
```

Two read-only endpoints let an organization's administrators export the organization's token usage and the amount it was charged, by day, from scripts and finance tooling. The request and response shapes follow OpenAI's organization usage and costs API, so existing clients for that API work by changing the base URL and key. Fields OpenAI does not define are marked **Apertis extension**.

| Endpoint | Returns |
|---|---|
| `GET /v1/organization/usage/completions` | Input, output and cached tokens, and request counts |
| `GET /v1/organization/costs` | The amount charged, in USD |

## Authentication

These endpoints take an **organization admin key** (`sk-admin_...`), not an inference key. An inference key (`sk-...`, `sk-org_...`) is refused with `401`, and an admin key cannot call model endpoints.

1. In the dashboard, open **Organization → Admin Keys** (owners, or members whose role allows managing admin keys).
2. Create a key with permission **All**, **Read-only**, or **Restricted** with `usage.read` (or the whole `usage` family).
3. Store it only on trusted servers. Send it as `Authorization: Bearer sk-admin_...` (`x-api-key: sk-admin_...` is also accepted).

The organization is always the key's own organization; no parameter or page cursor can name another one.

- A revoked key, or a missing or unknown key, is `401 invalid_api_key`.
- A key without `usage.read` is `403 insufficient_permissions`.
- A key whose creator was disabled, left the organization, or lost the right to manage admin keys is `403`.

See [Organizations, Members, Projects, Groups, and Roles](/authentication/organizations) for roles and admin key management.

## Rate limit

Both endpoints share the log-query rate limit of the **member who created the key**: 60 requests per 60 seconds, then `429`. The budget belongs to that member, not to the key: the same member's dashboard log and usage views draw on it, and every admin key that member created shares it. Poll at a moderate interval; daily buckets do not need more than a few requests per hour.

## Parameters

| Parameter | Usage | Costs | Meaning |
|---|---|---|---|
| `start_time` | required | required | Unix seconds, inclusive. |
| `end_time` | optional | optional | Unix seconds, exclusive. Defaults to now. At most one day in the future. |
| `bucket_width` | `1d` | `1d` | Only `1d`. Buckets are UTC days; the first and last bucket are clipped to the range. |
| `group_by` | `project_id`, `api_key_id`, `model`, `user_id` | `project_id`, `api_key_id` (Apertis extension), `line_item` | Repeat the parameter or separate values with commas. Results are always also split by `charge_basis`. |
| `project_ids` | ✓ | ✓ | Filter by project, `proj_<id>`. |
| `api_key_ids` | ✓ | ✓ | Filter by API key, `key_<id>`. |
| `models` | ✓ | | Filter by model name. |
| `user_ids` | ✓ | | Filter by member, `user_<id>`. |
| `limit` | 1–31, default 7 | 1–31, default 7 | Buckets per page. |
| `page` | ✓ | ✓ | The `next_page` cursor from the previous response. |
| `format` | `json` or `csv` | `json` or `csv` | Default `json`. |

The range from `start_time` to `end_time` may span at most 366 days. `start_time` cannot be earlier than the oldest usage still retained; such a request is refused with `400 range_not_available`, and the message names the earliest time you can request.

`end_time` is exclusive: a request recorded at exactly `end_time` is not counted. The dashboard's Usage tab treats its end as inclusive, so to compare the two for the same range, give the Usage tab `end_time - 1`.

## Examples

### Costs per project for the last 7 days

```bash
curl "https://api.apertis.ai/v1/organization/costs?start_time=$(( $(date +%s) - 7*86400 ))&group_by=project_id" \
  -H "Authorization: Bearer $APERTIS_ADMIN_KEY"
```

```json
{
  "object": "page",
  "data": [
    {
      "object": "bucket",
      "start_time": 1790035200,
      "end_time": 1790121600,
      "results": [
        {
          "object": "organization.costs.result",
          "amount": {"value": 1.234567, "currency": "usd"},
          "line_item": null,
          "project_id": "proj_12",
          "api_key_id": null,
          "charge_basis": "configured_price"
        }
      ]
    }
  ],
  "has_more": false,
  "next_page": null,
  "totals_by_charge_basis": {
    "configured_price": {"value": 1.234567, "currency": "usd"},
    "unknown_model_fallback": {"value": 0.000000, "currency": "usd"},
    "not_recorded": {"value": 0.000000, "currency": "usd"}
  }
}
```

### Token usage per model and API key

```bash
curl "https://api.apertis.ai/v1/organization/usage/completions?start_time=1790035200&end_time=1790640000&group_by=model,api_key_id" \
  -H "Authorization: Bearer $APERTIS_ADMIN_KEY"
```

```json
{
  "object": "page",
  "data": [
    {
      "object": "bucket",
      "start_time": 1790035200,
      "end_time": 1790121600,
      "results": [
        {
          "object": "organization.usage.completions.result",
          "input_tokens": 182340,
          "output_tokens": 20411,
          "input_cached_tokens": 120000,
          "cache_write_tokens": 8000,
          "input_audio_tokens": 0,
          "output_audio_tokens": 0,
          "num_model_requests": 96,
          "project_id": null,
          "user_id": null,
          "api_key_id": "key_34",
          "api_key_name": "ci",
          "model": "claude-sonnet-4-5",
          "batch": null,
          "charge_basis": "configured_price"
        }
      ]
    }
  ],
  "has_more": false,
  "next_page": null
}
```

### Python: read every page

```python
import os, requests

def read_all(path, **params):
    headers = {"Authorization": f"Bearer {os.environ['APERTIS_ADMIN_KEY']}"}
    while True:
        r = requests.get(f"https://api.apertis.ai/v1/organization/{path}", headers=headers, params=params)
        r.raise_for_status()
        body = r.json()
        yield from body["data"]
        if not body["has_more"]:
            return
        params["page"] = body["next_page"]

total = 0.0
for bucket in read_all("costs", start_time=1790035200, end_time=1790640000, group_by="project_id"):
    for result in bucket["results"]:
        total += result["amount"]["value"]
print(f"{total:.6f} USD")
```

## Response fields

### Usage results

An `organization.usage.completions.result` carries `input_tokens`, `output_tokens`, `input_cached_tokens`, `input_audio_tokens` (always 0), `output_audio_tokens` (always 0), `num_model_requests`, `project_id`, `user_id`, `api_key_id`, `model` and `batch` (always null). A field whose dimension is not in `group_by` is null.

### Cost results

An `organization.costs.result` carries `amount` (`value` in USD, `currency: "usd"`), `line_item` (the model, when grouped by `line_item`), and `project_id` when grouped by project.

### Apertis extensions

- `cache_write_tokens` (usage): prompt-cache write tokens, 5-minute and 1-hour writes together.
- `charge_basis` (both): how the charge was priced. See [Charge basis](#charge-basis).
- `api_key_id` on costs, and `api_key_name` on both, when grouping by key.
- `totals_by_charge_basis` (costs): this page's amounts per charge basis. The three values sum to the page's total.

## How amounts are calculated

`amount.value` is exactly what the organization was charged for the requests in that bucket, in USD to six decimal places (1 USD = 1,000,000 quota), written as a JSON number with no floating-point rounding. It is the same figure the dashboard's Usage tab sums for the same range and filters. Each request is charged by its model's published price per input, output, cached-input and cache-write token, as listed on the [Models](https://apertis.ai/models) page and described in [Quota Management](/billing/quota-management).

### Charge basis

Every result says how its charge was priced, and the three bases are always separate results:

| `charge_basis` | Meaning |
|---|---|
| `configured_price` | A published price for the model priced the request. |
| `unknown_model_fallback` | The model had no published price, and the fallback rate priced it. |
| `not_recorded` | The request was served before the basis was recorded, or by a path that does not record it (images, audio, video, asynchronous tasks, per-request prices). |

A charge is never reported as `configured_price` unless it was one.

### Projects and keys

- Spend outside any project is reported under the organization's default project, as the dashboard shows it.
- Keys are identified by id. Two members' keys with the same name are separate results.
- Usage recorded before key ids were recorded is attributed to the one current key with that member and name. When no such key exists, or more than one does, it is reported with `api_key_id: null` and the key name it was recorded under.

## Pagination

Results are never dropped to fit a page. A page holds at most `limit` buckets and at most 1,000 results; a bucket with more results continues on the next page under the same `start_time`. `has_more` is true until the last result has been returned.

Pass `next_page` as `page`, with the same other parameters, to read the next page. If the first request omitted `end_time`, keep omitting it: the cursor carries the end the first page resolved, so later pages cover the same range however much time has passed. A cursor sent for another organization or with different parameters is refused with `400 invalid_page`.

## CSV

`format=csv` returns one row per result with the columns `bucket_start_time`, `bucket_end_time`, `project_id`, `project_name`, `api_key_id`, `api_key_name`, `model`, `user_id`, `input_tokens`, `output_tokens`, `input_cached_tokens`, `cache_write_tokens`, `num_model_requests`, `amount_usd` and `charge_basis`. The page cursor is in the `X-Next-Page` response header and `has_more` in `X-Has-More`. A name starting with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with a single quote so a spreadsheet does not run it as a formula.

```bash
curl -D headers.txt -o costs.csv \
  "https://api.apertis.ai/v1/organization/costs?start_time=1790035200&group_by=project_id,api_key_id&format=csv" \
  -H "Authorization: Bearer $APERTIS_ADMIN_KEY"
```

## Errors

Errors use the OpenAI envelope `{"error": {"message", "type", "param", "code"}}`.

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_request_error` | Missing or invalid `start_time`/`end_time`, `end_time` not after `start_time`, a range over 366 days, an unknown `group_by`, `bucket_width` other than `1d`, `limit` outside 1–31, an invalid `format`, or a malformed id filter |
| 400 | `range_not_available` | `start_time` is earlier than the oldest retained usage; the message names that time |
| 400 | `invalid_page` | `page` is not a cursor returned for this organization and these parameters |
| 401 | `invalid_api_key` | Missing, unknown or revoked admin key, or an inference key |
| 403 | `insufficient_permissions` | The key does not allow `usage.read` |
| 429 | | The rate limit above |

## Dashboard export

The dashboard's Usage tab export reads at most 10,000 rows. When the range holds more, the export response carries `X-Apertis-Truncated: true` and `X-Apertis-Total-Rows: <count>`; use this API for the complete range.
