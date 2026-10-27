---
title: "Per-Key Limits and Budget Blocks"
---

# Per-Key Limits and Budget Blocks

Each API key can carry its own limits. This page lists every limit you can set on a key, when Apertis checks it, and the exact response your client gets when a request is refused. It also separates the two kinds of refusal:

- A **budget block** means the key or account has used up what it may spend. Waiting a few seconds does not help: wait for the reset time, or raise the limit.
- A **rate limit** means too many requests or too much spend in a short window. Retrying after `Retry-After` seconds works.

Every check on this page runs **before the request is sent to a model provider**. A refused request is not forwarded and is not charged.

## Limits you can set on a key

You set these in the dashboard when you create or edit a key.

| Limit | What it does | Resets |
|-------|--------------|--------|
| **Quota** (or **Unlimited**) | Total amount the key may spend over its lifetime. | Never. Add quota to the key to continue. |
| **Monthly limit** | Maximum the key may spend in one monthly window. | Every month on your account's monthly reset day, at 00:00 UTC. A reset day past the end of a month uses that month's last day. |
| **Hourly spend limit** | Maximum the key may spend in any trailing hour, in US dollars. | Continuously: spend older than one hour stops counting. |
| **Expiration** | Date after which the key stops working. | Never. Edit the expiration or create a new key. |
| **Allowed models** | The only models the key may call. Empty means all models available to you. | — |
| **IP allowlist** (subnet) | The only client addresses the key may be used from. | — |

Your account can also have its own **monthly spending limit**, and an organization workspace can have a **monthly spending cap**. Both are checked at the same point as a key's monthly limit and use the same error code.

<aside class="admonition admonition-tip">
<p class="admonition-title">Use a monthly limit for a hard budget</p>

A key's monthly limit is checked against an up-front estimate of each request's cost before the request is sent, so it is the setting to use when a key must not go past a fixed amount. The lifetime quota refuses a key once it reaches zero.

</aside>

## Budget blocks

| Situation | HTTP status | `error.code` | `error.message` |
|-----------|-------------|--------------|-----------------|
| Key's quota is used up | `401` | — | `This API Key's quota has been exhausted` |
| Key's remaining quota is below the request's estimated cost, when that cost is reserved up front (see below) | `403` | `pre_consume_token_quota_failed` | `the API key's remaining quota does not cover this request` |
| Key's monthly limit reached | `403` | `pre_consume_token_quota_failed` | `This API key's monthly limit is reached; it resets at <time>` |
| Account's monthly spending limit reached | `403` | `pre_consume_token_quota_failed` | `This account's monthly spending limit is reached; it resets at <time>` |
| Workspace's monthly spending cap reached | `403` | `pre_consume_token_quota_failed` | `This workspace's monthly spending cap is reached; it resets at <time>` |
| Account's PAYG credits used up | `403` | `insufficient_user_quota` | `PAYG credits must be positive. Please top up credits and try again.` |
| Account's PAYG credits do not cover the request's estimated cost | `403` | `insufficient_user_quota` | starts with `user quota is not enough` |
| Organization's PAYG balance used up | `403` | `insufficient_org_quota` | `Organization PAYG balance must be positive. Please top up the organization balance and try again.` |

`<time>` is an RFC 3339 timestamp in UTC, for example `2026-11-01T00:00:00Z`.

A request's estimated cost is always reserved up front when the key or the account has a monthly limit. Without a monthly limit, an account whose balance is far larger than the estimate skips the reservation, so a key with a small amount of quota left is not refused until its quota reaches zero.

## Rate limits

| Situation | HTTP status | `Retry-After` | `error.code` |
|-----------|-------------|---------------|--------------|
| Key's hourly spend limit reached | `429` | Yes | `api_key_spend_rate_exceeded` |
| Too many requests to one model with one key | `429` | Yes | `rate_limit_exceeded` |

The hourly spend limit's message names the limit and the wait: `This API key has reached its spend limit of US$<amount> per hour. Retry after <seconds> seconds, or raise the limit in the key's settings.`

The other request-rate limits, and how to retry them, are in [Rate Limits](/billing/rate-limits).

## Access refusals

These are not budget or rate problems. Retrying the same request does not help until the key or the request changes.

| Situation | HTTP status | `error.message` |
|-----------|-------------|-----------------|
| Key has expired | `401` | `This API Key has expired` |
| Key is disabled or revoked, or does not exist | `401` | `Invalid API Key` |
| Model is not in the key's allowed models | `403` | `Token not authorized to use model: <model>` |
| Request comes from an address outside the key's IP allowlist | `403` | `Token restricted to subnet: <subnet>, current IP: <ip>` |

On the Anthropic-compatible `POST /v1/messages` endpoint, a model outside the key's allowed models returns `404` in Anthropic's error shape:

```json
{
  "type": "error",
  "error": {
    "type": "not_found_error",
    "message": "The model 'gpt-4o' does not exist or you do not have access to it."
  }
}
```

## Response format

On `POST /v1/chat/completions`, refusals use the OpenAI error shape:

```json
{
  "error": {
    "message": "This API key's monthly limit is reached; it resets at 2026-11-01T00:00:00Z",
    "type": "api_error",
    "code": "pre_consume_token_quota_failed"
  }
}
```

- `401` refusals and the access refusals above have no `code` field. Match on the HTTP status.
- Rate-limit refusals have `type` `rate_limit_error`.
- The message may end with a request ID. Include it when you contact support.

## Requests already running

Limits are checked when a request is admitted. A request that has been admitted, including a streaming response, is not stopped part-way because a limit was reached during it. The limit applies to the next request.

## Handling a refusal

```python
from openai import OpenAI, APIStatusError

client = OpenAI(api_key="sk-your-api-key", base_url="https://api.apertis.ai/v1")

try:
    client.chat.completions.create(
        model="gpt-5.5",
        messages=[{"role": "user", "content": "Hello"}],
    )
except APIStatusError as e:
    if e.status_code == 429:
        retry_after = int(e.response.headers.get("Retry-After", "1"))
        # Rate limit: wait retry_after seconds, then retry.
    elif e.code in ("pre_consume_token_quota_failed", "insufficient_user_quota", "insufficient_org_quota"):
        # Budget block: do not retry; raise the limit, add quota, or wait for the reset time in the message.
        raise
    else:
        # 401 or 403 access refusal: fix the key or the request.
        raise
```

## Related Topics

- [API Keys](/authentication/api-keys) - Create keys and set their limits
- [Quota Management](/billing/quota-management) - How quota is counted
- [Rate Limits](/billing/rate-limits) - Request-rate limits and retry strategy
