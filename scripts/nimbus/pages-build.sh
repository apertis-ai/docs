#!/usr/bin/env bash
# The root `npm run build` after the Nimbus cutover (#14): Cloudflare Pages project `docs` runs it on
# every push and publishes `build/`, with the Pages Functions under `functions/`. The project's build
# settings stay as they are; switching back to Docusaurus is `npm run build:legacy`.
set -euo pipefail
cd "$(dirname "$0")/../.."
# The buildId check below recomputes sourceSha, the last commit touching the legacy roots, so it needs
# full history; Pages clones shallow.
if [ "$(git rev-parse --is-shallow-repository)" = true ]; then git fetch --quiet --unshallow; fi
npm ci --prefix site-nimbus --no-audit --no-fund
# Any failure below fails the Pages build, and Pages keeps serving the previous deployment.
# The committed manifest must be this checkout's: content merged without m2:regenerate is refused.
node scripts/nimbus/check-build-id.mjs
CI=1 npm run build --prefix site-nimbus
# The publication checks on the built site, including the real Turnstile sitekey (never a test key).
npm run test:dist --prefix site-nimbus
# Refund copy (apertis-ai/docs#39): no publication while a refund-policy date marker, a superseded refund promise
# or a dated Refund Policy link is in a source or the built site.
node scripts/nimbus/refund-policy-check.mjs
rm -rf build
cp -R site-nimbus/dist build
