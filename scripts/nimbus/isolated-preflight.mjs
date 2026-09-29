// Fail-closed preflight for .github/workflows/nimbus-isolated.yml (issue #12). Reads only the
// environment, prints no secret value, exits 1 with every reason when the run must not proceed.
//
// Required: TARGET_URL, NIMBUS_ISOLATED_HOST (non-secret allowlist, exact host), GEN_ENV,
// PREVIEW_GEN_ENV (the preview's ASK_GENERATION_ENVIRONMENT), ACTIVATE / ALREADY_ACTIVE,
// DATABASE_URL, SUPABASE_URL (same Supabase project), NIMBUS_PRODUCTION_PROJECT_REF (denied).
import fs from 'node:fs';

const env = process.env;
const failures = [];
const host = (h) => String(h ?? '').trim().toLowerCase().replace(/\.$/, '');

// Target: https, exactly the allowlisted host, never production, a pages.dev host of the production
// project, 0.0.0.0 or loopback.
const rollback = JSON.parse(fs.readFileSync(new URL('../../migration/nimbus/legacy-rollback.json', import.meta.url), 'utf8'));
const production = rollback.pages.domains.map(host);
const productionPagesDev = production.filter((d) => d.endsWith('.pages.dev'));
let target = null;
try { target = new URL(env.TARGET_URL); } catch { failures.push('target_url is not a URL'); }
if (target) {
  const h = host(target.hostname);
  if (target.protocol !== 'https:') failures.push('target_url must be https');
  if (!env.NIMBUS_ISOLATED_HOST) failures.push('NIMBUS_ISOLATED_HOST is not set');
  else if (h !== host(env.NIMBUS_ISOLATED_HOST)) failures.push('target host is not the allowlisted NIMBUS_ISOLATED_HOST');
  if (production.includes(h) || productionPagesDev.some((d) => h.endsWith(`.${d}`)) || h === 'apertis.ai' || h.endsWith('.apertis.ai')) failures.push(`target host ${h} is a production host`);
  if (/^(localhost|0\.0\.0\.0|127(\.\d+){3}|\[?::1\]?|\[?::\]?)$/.test(h)) failures.push(`target host ${h} is loopback or unspecified`);
}

// Generation environment: valid, not production, equal to what the preview reads, and active.
if (!/^[a-z][a-z0-9-]{0,31}$/.test(env.GEN_ENV ?? '')) failures.push('invalid generation_environment');
if (env.GEN_ENV === 'production') failures.push('refusing the production generation environment');
if (env.GEN_ENV !== env.PREVIEW_GEN_ENV) failures.push('generation_environment differs from the preview\'s ASK_GENERATION_ENVIRONMENT');
if (env.ACTIVATE !== 'true' && env.ALREADY_ACTIVE !== 'true') failures.push('real evidence needs activate_generation or an explicit generation_already_active confirmation');

// Supabase project: DATABASE_URL and SUPABASE_URL name the same project, and it is not production.
const supabaseRef = (() => { try { return new URL(env.SUPABASE_URL).hostname.match(/^([a-z0-9]{15,})\.supabase\.(co|in)$/)?.[1] ?? null; } catch { return null; } })();
const databaseRef = (() => {
  try {
    const u = new URL(env.DATABASE_URL);
    return decodeURIComponent(u.username).match(/^postgres\.([a-z0-9]{15,})$/)?.[1] ?? u.hostname.match(/^db\.([a-z0-9]{15,})\.supabase\.(co|in)$/)?.[1] ?? null;
  } catch { return null; }
})();
if (!supabaseRef) failures.push('SUPABASE_URL does not name a Supabase project');
if (!databaseRef) failures.push('DATABASE_URL does not name a Supabase project');
if (supabaseRef && databaseRef && supabaseRef !== databaseRef) failures.push('DATABASE_URL and SUPABASE_URL are different projects');
if (!env.NIMBUS_PRODUCTION_PROJECT_REF) failures.push('NIMBUS_PRODUCTION_PROJECT_REF is not set');
else if ([supabaseRef, databaseRef].includes(env.NIMBUS_PRODUCTION_PROJECT_REF.trim())) failures.push('the isolated project is the production project');

for (const f of failures) console.error(`preflight: ${f}`);
if (failures.length) process.exit(1);
console.log(`preflight passed: target ${host(target.hostname)}, generation environment ${env.GEN_ENV}, isolated project confirmed`);
