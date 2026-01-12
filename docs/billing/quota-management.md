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

### Token-Based Billing

Quota consumption is calculated per request:

```
Quota = (Prompt Tokens + Completion Tokens × Multiplier) × Model Rate
```

### Completion Multipliers

Output tokens typically cost more than input tokens:

| Model Category | Completion Multiplier |
|----------------|----------------------|
| Most models | 1.0x |
| GPT-3.5 series | 1.33x |
| GPT-4 series | 2.0x |

### Model Pricing

Different models have different costs per token. For current model pricing, please visit the [Models page](https://apertis.ai/models).

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
# Get token information (includes quota)
import requests

response = requests.get(
    "https://api.apertis.ai/api/user/token",
    headers={"Authorization": "Bearer sk-your-api-key"}
)

token_info = response.json()
print(f"Remaining quota: {token_info['data']['remain_quota']}")
print(f"Used quota: {token_info['data']['used_quota']}")
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
| Simple Q&A | GPT-3.5 Turbo | $ |
| Code generation | GPT-4o | $$ |
| Complex reasoning | Claude 3 Opus | $$$ |
| Long documents | Claude 3.5 Sonnet | $$ |

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
response = get_cached_response(prompt_hash, "gpt-4o")
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
2. **Subscription Quota**: Falls back to PAYG (if enabled)
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
