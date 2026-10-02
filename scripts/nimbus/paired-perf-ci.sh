#!/usr/bin/env bash
# One CI paired-perf runner (.github/workflows/nimbus-paired-perf.yml): serves the recorded legacy build on
# 8791 and the candidate dist (with the root Pages Function) on 8806, then runs `paired-perf.mjs run` for
# each page given as an argument into $OUT/<page>.json. A run that yields no valid samples is retried up to
# 3 times; a page with none after that fails the runner.
#   BUILD_ID PLAYWRIGHT PAKO OUT LEGACY_BUILD (directory) bash scripts/nimbus/paired-perf-ci.sh /page/ ...
set -euo pipefail
: "${BUILD_ID:?}" "${PLAYWRIGHT:?}" "${PAKO:?}" "${OUT:?}" "${LEGACY_BUILD:?}"
root=$(git rev-parse --show-toplevel)
logs=$(mktemp -d)

(cd "$(dirname "$LEGACY_BUILD")" && nohup "$root/site-nimbus/node_modules/.bin/wrangler" pages dev "$(basename "$LEGACY_BUILD")" \
  --port 8791 --ip 127.0.0.1 --inspector-port 9230 --compatibility-date=2024-01-01 > "$logs/legacy.log" 2>&1 &)
(cd "$root/site-nimbus" && nohup npm run preview -- --port 8806 --ip 127.0.0.1 > "$logs/candidate.log" 2>&1 &)
for port in 8791 8806; do
  for _ in $(seq 1 90); do curl -fs -o /dev/null "http://127.0.0.1:$port/" && continue 2; sleep 1; done
  cat "$logs/legacy.log" "$logs/candidate.log"; exit 1
done
served=$(curl -fs http://127.0.0.1:8806/ | grep -o 'apertis-docs:build" content="[^"]*' | cut -d'"' -f3)
test "$served" = "$BUILD_ID"
nproc; uptime

mkdir -p "$OUT"
for p in "$@"; do
  f="$OUT/$(echo "$p" | tr '/' '_').json"
  for attempt in 1 2 3; do
    if node "$root/scripts/nimbus/paired-perf.mjs" run --legacy http://127.0.0.1:8791 --candidate http://127.0.0.1:8806 \
         --build-id "$BUILD_ID" --set full --page "$p" --out "$f.tmp" > "$f.log" 2>&1 || [ -s "$f.tmp" ]; then
      if jq -e '.samples | length > 0' "$f.tmp" > /dev/null 2>&1; then mv "$f.tmp" "$f"; echo "$p ok (attempt $attempt)"; break; fi
    fi
    rm -f "$f.tmp"; echo "$p attempt $attempt failed:"; grep -m3 -E 'Error|Timeout|refused' "$f.log" || true
  done
  test -s "$f" || { echo "$p: no valid samples after 3 attempts"; exit 1; }
done
