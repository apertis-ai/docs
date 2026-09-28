// #7 phase 2, run by `astro build` (astro:build:done):
//   1. copy src/content/public/** (clean Markdown artifacts, bundled images) into dist verbatim;
//   2. set contentSha256 of every manifest entry without Markdown (page:index) from its built <main>;
//   3. fail the build unless validateManifest(manifest, { inventory, outDir: dist }) returns [] and
//      nothing is emitted at /api/ask.
// No HTML embeds contentSha256 (test:dist checks), so step 2 never invalidates the pages just built:
// one build reaches the fixed point, and a rebuild leaves the manifest byte-identical.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

import type { ManifestV1 } from '../src/contracts/manifest.ts';
import type { RouteInventory } from '../src/contracts/navigation.ts';
import { validateManifest } from '../src/contracts/validate-manifest.ts';
import { GENERATED_PUBLIC, INVENTORY_PATH, REPO_ROOT, SITE_ROOT, mainTextSha256, writeManifest } from './convert.ts';

export function finalize(outDir: string, siteRoot = SITE_ROOT): string[] {
  const log: string[] = [];
  const pub = path.join(siteRoot, GENERATED_PUBLIC);
  for (const e of fs.readdirSync(pub, { recursive: true, withFileTypes: true }).filter((x) => x.isFile())) {
    const rel = path.relative(pub, path.join(e.parentPath, e.name));
    const dest = path.join(outDir, rel);
    if (fs.existsSync(dest)) throw new Error(`m2: ${rel} is already emitted by the build; refusing to overwrite`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(pub, rel), dest);
  }

  const manifestFile = path.join(siteRoot, 'src/manifest/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as ManifestV1;
  let changed = false;
  for (const d of manifest.documents.filter((x) => x.markdown === null)) {
    const hash = mainTextSha256(fs.readFileSync(path.join(outDir, `.${d.servedPath}index.html`), 'utf8'));
    if (hash !== d.contentSha256) {
      log.push(`${d.id}: contentSha256 ${d.contentSha256.slice(0, 12)} -> ${hash.slice(0, 12)}`);
      d.contentSha256 = hash;
      changed = true;
    }
  }
  if (changed) writeManifest(siteRoot, manifest);

  const inventory = (JSON.parse(fs.readFileSync(path.join(REPO_ROOT, INVENTORY_PATH), 'utf8')) as RouteInventory).routes;
  const errors = validateManifest(manifest, { inventory, outDir });
  for (const reserved of ['api/ask', 'api/ask/index.html', 'api/ask.html']) {
    if (fs.existsSync(path.join(outDir, reserved))) errors.push(`dist: ${reserved} shadows the reserved runtime path`);
  }
  if (errors.length) throw new Error(`m2: manifest validation failed:\n${errors.join('\n')}`);
  return log;
}

export default function publication(): AstroIntegration {
  return {
    name: 'apertis-m2-publication',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        for (const line of finalize(fileURLToPath(dir))) logger.info(line);
        logger.info('manifest finalized and validated');
      },
    },
  };
}
