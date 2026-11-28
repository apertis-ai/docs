# Quota Management

Understanding how quota works is essential for managing your API usage and costs effectively. This guide explains the quota system in detail.

## Quota Overview

Quota represents your available API usage credits. Every API request consumes quota based on token usage and model pricing.

```
Request → Token Count → Model Multiplier → Quota Consumed
```

## Types of Quota

### 1. API Key Quota

Each API key has its own quota allocation:

| Setting | Description |
|---------|-------------|
| **Remaining Quota** | Available credits for this key |
| **Used Quota** | Total consumed by this key |
| **Unlimited** | No quota limit (uses account balance) |

### 2. Subscription Quota

Subscription plans include monthly quota that resets each billing cycle:

| Component | Description |
|-----------|-------------|
| **Cycle Limit** | Total quota for current cycle |
| **Cycle Used** | Quota consumed this cycle |
| **Reset Date** | When quota resets to full |

### 3. Account Balance

Your account balance for Pay-As-You-Go (PAYG) usage:

| Component | Description |
|-----------|-------------|
| **Balance** | Current available funds |
| **Used** | Total spent on PAYG |

## Quota Calculation

### Subscription Quota — Per-Request Billing

Subscription plans use a **per-request** billing model. Each API request consumes a fixed amount of quota based on the model's multiplier rate:

```
Quota Consumed per Request = Model Rate (fixed multiplier)
```

This is independent of token usage — a short response and a long response cost the same quota for the same model. Different plans offer different rates for the same model — higher-tier plans have lower multipliers, giving you more requests per quota.

### PAYG — Per-Token Billing

PAYG (Pay-As-You-Go) uses a **per-token** billing model. Each request is charged based on actual token consumption:

```
Cost = (Input Tokens × Input Rate) + (Output Tokens × Output Rate)
```

### Model Pricing

For current model rates and pricing, visit the [Subscribe page](https://apertis.ai/subscribe).

## Monitoring Quota Usage

### Dashboard Overview

View your quota status in the dashboard:

1. **Account Overview** - Total balance and usage
2. **API Keys** - Per-key quota status
3. **Subscription** - Cycle quota remaining
4. **Usage History** - Detailed consumption logs

### API Endpoints

Check quota programmatically:

```python
import requests

response = requests.get(
    "https://api.apertis.ai/v1/dashboard/billing/credits",
    headers={"Authorization": "Bearer sk-your-api-key"}
)

credits = response.json()
payg = credits["payg"]

if payg["token_is_unlimited"]:
    print("Token quota: unlimited")
else:
    print(f"Remaining token credits: ${payg['token_remaining']:.2f}")
    print(f"Used token credits: ${payg['token_used']:.2f}")

if credits["is_subscriber"]:
    subscription = credits["subscription"]
    print(f"Cycle quota remaining: {subscription['cycle_quota_remaining']}")
```

### Response Headers

API responses include usage information:

```json
{
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 100,
    "total_tokens": 150
  }
}
```

## Managing Quota Effectively

### 1. Choose the Right Model

Match model capabilities to your needs:

| Task | Recommended Model | Cost Level |
|------|-------------------|------------|
| Simple Q&A | GPT-5.4 nano | $ |
| Code generation | GPT-5.5 | $$ |
| Complex reasoning | Claude Opus 4.8 | $$$ |
| Long documents | Claude Sonnet 4.6 | $$ |

### 2. Optimize Prompts

Reduce token usage with efficient prompts:

```python
# Inefficient (high token usage)
prompt = """
I would like you to please help me with the following task.
I need you to summarize the following text for me.
Please make sure the summary is comprehensive and detailed.
Here is the text:
{long_text}
"""

# Efficient (lower token usage)
prompt = f"Summarize:\n{long_text}"
```

### 3. Use System Messages Wisely

System messages persist across turns. Keep them concise:

```python
# Good - concise system message
messages = [
    {"role": "system", "content": "You are a helpful coding assistant."},
    {"role": "user", "content": "..."}
]

# Avoid - overly detailed system message
messages = [
    {"role": "system", "content": "You are an extremely helpful assistant..."},  # 500+ tokens
    {"role": "user", "content": "..."}
]
```

### 4. Implement Caching

Cache responses for identical queries:

```python
import hashlib
from functools import lru_cache

@lru_cache(maxsize=1000)
def get_cached_response(prompt_hash, model):
    return client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )

# Create hash for caching
prompt_hash = hashlib.md5(prompt.encode()).hexdigest()
response = get_cached_response(prompt_hash, "gpt-5.5")
```

### 5. Set Quota Limits

Configure API key quota limits to prevent overspending:

1. Go to **API Keys** in dashboard
2. Edit the key
3. Set **Quota Limit**
4. Save changes

## Quota Alerts

### Setting Up Alerts

Configure alerts to be notified when quota is low:

1. Navigate to **Settings** → **Notifications**
2. Enable **Low Quota Warning**
3. Set threshold percentage (e.g., 20%)
4. Choose notification method (email)

### Alert Thresholds

| Level | Threshold | Action |
|-------|-----------|--------|
| Warning | 20% remaining | Consider top-up |
| Critical | 10% remaining | Top-up soon |
| Exhausted | 0% remaining | Requests will fail |

## Quota Exhaustion

### What Happens

When quota is exhausted:

1. **API Key Quota**: Requests return `402 Payment Required`
2. **Subscription Quota**: Falls back to PAYG per-token billing (if enabled), otherwise returns `402`
3. **Account Balance**: All requests fail with `402`

### Error Response

```json
{
  "error": {
    "message": "You have exceeded your quota",
    "type": "billing_error",
    "code": "quota_exceeded"
  }
}
```

### Recovery Options

| Situation | Solution |
|-----------|----------|
| API key exhausted | Increase key quota or create new key |
| Subscription exhausted | Enable PAYG fallback |
| Balance exhausted | Add funds to account |

## Quota Reset

### Subscription Quota Reset

Subscription quota resets automatically at the start of each billing cycle:

```
Cycle Start (e.g., Jan 1) → Full Quota Available
                          ↓
                    Use Throughout Month
                          ↓
Cycle End (e.g., Jan 31) → Unused Quota Expires
                          ↓
Next Cycle (Feb 1)       → Full Quota Restored
```

:::note
Unused quota does not roll over to the next cycle.
:::

### Manual Quota Reset (Admin)

Account administrators can reset quota for:
- Individual API keys
- Subscription cycles
- User accounts

## Best Practices

### For Development

1. **Use separate keys** for development and production
2. **Set low limits** on development keys
3. **Monitor usage** during testing
4. **Use cheaper models** for development

### For Production

1. **Set appropriate limits** based on expected usage
2. **Enable auto top-up** to prevent service interruption
3. **Monitor alerts** and respond quickly
4. **Review usage regularly** for optimization opportunities

### Cost Control Strategies

| Strategy | Implementation |
|----------|----------------|
| Model tiering | Use cheaper models for simple tasks |
| Prompt optimization | Reduce token count in prompts |
| Response limits | Set `max_tokens` to limit output |
| Caching | Cache frequent identical queries |
| Rate limiting | Implement client-side rate limits |

## Usage Reports

### Accessing Reports

View detailed usage reports in the dashboard:

1. Go to **Usage** → **Reports**
2. Select date range
3. Filter by model, key, or endpoint
4. Export as CSV if needed

### CSV export

The usage export writes one row per model per UTC day for the selected range, up to 90 days back. The columns, in this order:

| Column | Description |
|--------|-------------|
| `date` | UTC day, `YYYY-MM-DD` |
| `model_id` | Model ID as requested |
| `model_name` | Display name of the model |
| `provider` | Model provider |
| `requests` | Charged requests |
| `quota` | Quota charged (1,000,000 quota = 1 USD) |
| `spend_usd` | Amount charged in USD |
| `prompt_tokens` | Input tokens |
| `completion_tokens` | Output tokens |
| `cache_read_tokens` | Input tokens read from the prompt cache |
| `cache_write_tokens` | Input tokens written to the prompt cache (5-minute and 1-hour) |

The token columns come after `spend_usd`, so a parser that reads the first seven columns by position keeps working. A blank token cell means the count was not available for that row, not zero usage.

### Request-level export through the API

The CSV export above summarizes usage per model per day. To export one row per request, start an export job and then fetch its file. Both calls authenticate with your dashboard access token in the `Authorization` header, not with an API key.

**1. Start the job**

```bash
curl -X POST "https://api.apertis.ai/api/log/self/usage-exports?start_timestamp=1795910400&end_timestamp=1796515200&model_name=<MODEL>" \
    -H "Authorization: <ACCESS_TOKEN>"
```

| Query parameter | Description |
|-----------------|-------------|
| `start_timestamp` | Start of the range, Unix seconds. Defaults to the start of the 30-day request-log window |
| `end_timestamp` | End of the range, Unix seconds |
| `model_name` | Only requests for this model |
| `token_name` | Only requests made with the API key of this name |

The call returns `202` with the job in `data`:

```json
{
  "success": true,
  "message": "",
  "data": {
    "job_id": "<JOB_ID>",
    "status": "running",
    "start_timestamp": 1795910400,
    "end_timestamp": 1796515200
  }
}
```

**2. Read the job**

```bash
curl "https://api.apertis.ai/api/log/self/usage-exports/<JOB_ID>" \
    -H "Authorization: <ACCESS_TOKEN>"
```

The state comes back in `data`. While the job runs, `status` is `running`. It becomes `done` or `failed`. A job that is `done` reports `total_rows` and `row_count`. When `status` is `done`, add `format=csv` or `format=json` to download the file:

```bash
curl "https://api.apertis.ai/api/log/self/usage-exports/<JOB_ID>?format=csv" \
    -H "Authorization: <ACCESS_TOKEN>" -o account-usage.csv
```

The JSON file is an object with `rows`, `total_rows`, `start_timestamp` and `end_timestamp`.

The file holds your requests, newest first, up to 10,000 rows. When the range has more rows, the file holds the newest 10,000, the response carries `X-Apertis-Truncated: true` and `X-Apertis-Total-Rows`, and `total_rows` is larger than `row_count`. Narrow the range and export again. A finished export is kept for one hour, and an account keeps one finished export: a job that finishes replaces the previous one.

| Column | Description |
|--------|-------------|
| `created_at` | Unix timestamp, in seconds |
| `request_id` | The request's `X-Apertis-Request-Id` |
| `api_key_name` | Name of the API key |
| `model_name` | Model |
| `prompt_tokens` | Input tokens |
| `completion_tokens` | Output tokens |
| `cache_read_tokens` | Input tokens read from the prompt cache |
| `cache_creation_5m_tokens` | Input tokens written to the 5-minute prompt cache |
| `cache_creation_1h_tokens` | Input tokens written to the 1-hour prompt cache |
| `reasoning_tokens` | Reasoning tokens. Blank when not counted |
| `quota` | Quota charged (1,000,000 quota = 1 USD) |
| `cost_usd` | Cost in USD |
| `charged_to_balance` | Whether the cost was charged to your credits |
| `is_stream` | Whether the request was streamed. Blank when not recorded |
| `latency_ms` | Total request time in milliseconds. Blank when not measured |
| `ttft_ms` | Time to first token in milliseconds. Blank when not measured |
| `finish_reason` | Why generation stopped. Blank when not recorded |

The export never includes request or response content.

Errors answer with `"success": false`, a `message`, and for the cases below an `error` field (`code` for `range_not_available`) that names the case:

| Status | Identifier | Meaning |
|--------|------------|---------|
| `400` | | `start_timestamp` is older than the 30-day request-log window |
| `400` | `range_not_available` | Request-level rows for the start of the range are no longer held |
| `400` | `invalid_format` | `format` is not `csv` or `json` |
| `404` | `export_not_found` | The job does not exist, belongs to another account, or has been replaced |
| `409` | `export_in_progress` | You already have a job running; wait for it to finish |
| `409` | `export_not_ready` | You asked for a file before the job is `done` |
| `429` | `export_busy` | Other exports are running; retry after the `Retry-After` interval (60 seconds) |
| `503` | `export_unavailable` | Exports are temporarily unavailable; nothing was started |

### Report Metrics

| Metric | Description |
|--------|-------------|
| Total Requests | Number of API calls |
| Total Tokens | Tokens consumed |
| Total Cost | Quota/money spent |
| Average Latency | Response time |
| Error Rate | Failed requests percentage |

## Related Topics

- [Subscription Plans](./subscription-plans) - Plan quotas and features
- [Rate Limits](./rate-limits) - Request rate limits
- [PAYG](./payg) - Pay-As-You-Go billing
- [API Keys](../authentication/api-keys) - Key management
