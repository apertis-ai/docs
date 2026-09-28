#!/bin/bash
# Probes a local `wrangler pages dev build` server (see README.md). Calls no paid provider.
# usage: assistant/pages-probe.sh BASE MODE   (MODE=configured|unconfigured)
B=$1; MODE=$2; fail=0
check() { # name method path body expect_status expect_body_substr
  local out code
  out=$(curl -s -w '\n%{http_code} %{content_type}' -X "$2" "$B$3" ${4:+-H 'Content-Type: application/json' --data-binary "$4"})
  code=$(tail -1 <<<"$out"); body=$(sed '$d' <<<"$out")
  if [[ "$code" == $5* ]] && [[ "$body" == *"$6"* ]]; then echo "PASS $1: $code ${body:0:110}"; else echo "FAIL $1: $code ${body:0:200}"; fail=1; fi
}
LONG=$(printf 'a%.0s' $(seq 1 2001))
if [ "$MODE" = configured ]; then
check invalid-json POST /api/ask '{' '400 application/json' '{"error":"Invalid JSON body"}'
check empty POST /api/ask '{}' '400 application/json' '{"error":"Missing or invalid question"}'
check no-session POST /api/ask '{"question":"hi"}' '400' '{"error":"Missing or invalid sessionId"}'
check no-turnstile POST /api/ask '{"question":"hi","sessionId":"m5-local"}' '400' '{"error":"Missing Turnstile token"}'
check question-too-long POST /api/ask "{\"question\":\"$LONG\",\"sessionId\":\"m5\"}" '400' '{"error":"Question too long (max 2000 characters)"}'
check null-body POST /api/ask 'null' '400' '{"error":"Missing or invalid question"}'
check body-too-large POST /api/ask "{\"pad\":\"$(head -c 70000 /dev/zero | tr '\0' x)\"}" '413 application/json' '{"error":"Request body too large"}'
check bad-turnstile POST /api/ask '{"question":"hi","sessionId":"m5-local","turnstileToken":"XXXX.DUMMY.TOKEN.XXXX"}' '403 application/json' '{"error":"Turnstile verification failed","codes":["invalid-input-response"]}'
else
check missing-retrieval-source POST /api/ask '{"question":"hi","sessionId":"m5"}' '500 application/json' '{"error":"Server configuration error"}'
fi
check get-404 GET /api/ask '' '404 text/html' ''
check preflight OPTIONS /api/ask '' '200' ''
curl -s -D - -o /dev/null -X OPTIONS "$B/api/ask" | grep -i '^access-control-allow-methods: POST, OPTIONS' >/dev/null && echo "PASS preflight-headers" || { echo "FAIL preflight-headers"; fail=1; }
check static-api-doc GET /api/text-generation/chat-completions/ '' '200 text/html' 'chat'
check static-api-root GET /api/ '' '200 text/html' ''
exit $fail
