#!/usr/bin/env bash
# The root `npm run build` after the Nimbus cutover (#14): Cloudflare Pages project `docs` runs it on
# every push and publishes `build/`, with the Pages Functions under `functions/`. The project's build
# settings stay as they are; switching back to Docusaurus is `npm run build:legacy`.
set -euo pipefail
cd "$(dirname "$0")/../.."
# The candidate's sourceSha is the last commit touching the legacy roots, so the build needs full
# history; Pages clones shallow.
if [ "$(git rev-parse --is-shallow-repository)" = true ]; then git fetch --quiet --unshallow; fi
npm ci --prefix site-nimbus --no-audit --no-fund
# A checked build: it fails on a stale committed manifest, so Pages keeps serving the previous deployment.
CI=1 npm run build --prefix site-nimbus
rm -rf build
cp -R site-nimbus/dist build
