---
title: "Balance Alerts and Webhooks"
---

# Balance Alerts and Webhooks

Apertis can tell you when your credit balance runs low, by email and by a signed webhook to your own application. Both use the same alert threshold.

## Set the alert threshold

In the dashboard, open **Settings → Preferences → Low balance alert**. Turn the alert on and choose a threshold in US dollars.

An alert fires once, when a request moves your balance from above the threshold to at or below it. It fires again only after your balance has gone back above the threshold (for example, after you add credits) and then crosses it again.

## Email alerts

When email notifications are on, the alert email shows your current balance and your threshold. Its **Add credits** button opens the credits page in your dashboard.

To stop alert emails, turn off email notifications in **Preferences** or use the unsubscribe link in the email. Webhooks keep working either way.

## Webhooks

Add a webhook endpoint to receive the alert in your own system, such as a Slack bot, an auto top-up script or an on-call pager.

### Add an endpoint

1. Open **Settings → Preferences → Webhooks** and select **Add endpoint**.
2. Enter a public `https://` URL. URLs that resolve to private, loopback, link-local or cloud-metadata addresses are refused.
3. Copy the **signing secret** (`whsec_…`). It is shown only once. If you lose it, rotate the secret to get a new one.
4. Select **Send test event** to confirm your endpoint answers.

You can have up to 5 endpoints.

### Events

| Type | Sent when |
|------|-----------|
| `balance.low` | Your balance crossed your alert threshold. |
| `webhook.test` | You sent a test event from the dashboard. |

Every event is a JSON `POST` with this shape:

```json
{
  "id": "evt_3f9a1c0d2b7e4a5f6c8d9e0a",
  "type": "balance.low",
  "created": 1764057600,
  "data": {
    "user_id": 1234,
    "balance_usd": 4.82,
    "threshold_usd": 5,
    "currency": "USD",
    "add_credits_url": "https://apertis.ai/setting?tab=credits&utm_source=email&utm_medium=transactional&utm_campaign=balance-alert-webhook"
  }
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique event id. Use it to ignore duplicates. |
| `type` | Event type. |
| `created` | When the event happened, in Unix seconds. |
| `data.user_id` | Your Apertis account id. |
| `data.balance_usd` | Balance right after the request that crossed the threshold. |
| `data.threshold_usd` | Your alert threshold. |
| `data.add_credits_url` | Link to the credits page. |

A `webhook.test` event carries `data.endpoint_id`.

### Headers

| Header | Value |
|--------|-------|
| `Apertis-Event-Id` | The event `id`. |
| `Apertis-Signature` | `t=<unix seconds>,v1=<hex signature>` |
| `Content-Type` | `application/json` |
| `User-Agent` | `Apertis-Webhooks/1` |

### Verify the signature

`v1` is the hex HMAC-SHA256 of `t`, a dot and the **raw request body**, keyed with your signing secret:

```
v1 = hex(HMAC_SHA256(secret, t + "." + raw_body))
```

Verify against the raw bytes you received, before you parse the JSON. Reject a timestamp older than a few minutes, to stop replays.

**Node.js (Express)**

```javascript
import crypto from "node:crypto";
import express from "express";

const app = express();
const secret = process.env.APERTIS_WEBHOOK_SECRET;

app.post("/apertis/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const header = req.get("Apertis-Signature") ?? "";
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = crypto
    .createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${parts.t}.`), req.body]))
    .digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  const valid =
    parts.v1?.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(parts.v1), Buffer.from(expected));
  if (!fresh || !valid) return res.sendStatus(400);

  const event = JSON.parse(req.body);
  // Ignore an event id you have already handled, then act on it.
  res.sendStatus(200);
});
```

**Python (Flask)**

```python
import hashlib, hmac, json, os, time
from flask import Flask, request, abort

app = Flask(__name__)
secret = os.environ["APERTIS_WEBHOOK_SECRET"].encode()

@app.post("/apertis/webhook")
def apertis_webhook():
    parts = dict(p.split("=", 1) for p in request.headers.get("Apertis-Signature", "").split(","))
    body = request.get_data()  # raw bytes
    expected = hmac.new(secret, parts.get("t", "").encode() + b"." + body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, parts.get("v1", "")) or abs(time.time() - int(parts.get("t", 0))) > 300:
        abort(400)
    event = json.loads(body)
    # Ignore an event id you have already handled, then act on it.
    return "", 200
```

### Responses, retries and duplicates

- Answer with any `2xx` status within 10 seconds to acknowledge an event. Redirects are not followed.
- Any other answer, a timeout or a connection error is retried with exponential backoff: 1 minute, 2 minutes, 4 minutes and so on, up to 13 attempts over about 3 days. After that the delivery is marked failed.
- A `webhook.test` event is sent once and not retried.
- Each retry sends the same `id` and the same body, with a fresh signature. An event can arrive more than once, so deduplicate on `id`.
- In **Webhooks → Deliveries** you can see each attempt's status and resend any failed or delivered event. A resend uses the same `id` and body.
- Deliveries are kept for 30 days.

### Rotate or remove an endpoint

**Rotate secret** replaces the signing secret right away. Deploy the new secret to your receiver at the same time. Disabling an endpoint stops new deliveries to it. Deleting an endpoint also removes its delivery history.
