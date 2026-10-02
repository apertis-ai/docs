// The homepage's live data (openspec docs-shell-interfaces, homepage as revised on 2026-10-02), committed so
// the build never calls the network:
//   - release-notes.json: the public Apertis changelog's homepage view, newest first ("Latest");
//   - featured-models.json: the FEATURED models below as the public model catalog describes them now
//     (name, provider, context length), with the catalog's model count ("Models").
//   node scripts/nimbus/homepage-snapshot.mjs
// Rewrites both files under site-nimbus/src/components/home/; review and commit the diff like any content
// change. To change the featured models, edit FEATURED (the line and tags are ours; the rest is the catalog's).
import fs from 'node:fs';
import path from 'node:path';

const HOME = path.resolve(import.meta.dirname, '../../site-nimbus/src/components/home');
export const RELEASE_NOTES = { source: 'https://apertis.ai/api/changelog?view=homepage', file: path.join(HOME, 'release-notes.json') };
export const MODELS = { source: 'https://apertis.ai/api/v2/models/', file: path.join(HOME, 'featured-models.json') };

/** The homepage model family: one per use, across providers. */
export const FEATURED = [
  { id: 'claude-opus-5.5', line: 'Flagship reasoning for long-horizon agents and large codebases.', tags: ['Agents', 'Coding', 'Long tasks'] },
  { id: 'gpt-6.1-sol', line: 'Agentic coding, computer use and document-heavy work.', tags: ['Coding', 'Computer use', 'Documents'] },
  { id: 'gemini-3.8-flash', line: 'The most capable Flash model: fast, multimodal, agent-ready.', tags: ['Fast', 'Multimodal', 'Agents'] },
  { id: 'deepseek-v4.1-flash', line: 'A cost-efficient mixture of experts for coding and reasoning.', tags: ['Cost-efficient', 'Coding', 'Reasoning'] },
];

const text = (v) => typeof v === 'string' && v.trim() !== '';

/** The fields the homepage shows, newest first; throws on anything it could not render. */
export function releaseNotes(data) {
  if (!Array.isArray(data) || !data.length) throw new Error('release notes: expected a non-empty list');
  const notes = data.map((e, i) => {
    const note = { version: e?.version, date: e?.date, title: e?.title, description: e?.description ?? '' };
    for (const k of ['version', 'date', 'title']) if (!text(note[k])) throw new Error(`release notes: entry ${i} has no ${k}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(note.date)) throw new Error(`release notes: entry ${i} date ${note.date} is not YYYY-MM-DD`);
    if (typeof note.description !== 'string') throw new Error(`release notes: entry ${i} description is not text`);
    return note;
  });
  for (let i = 1; i < notes.length; i++) if (notes[i].date > notes[i - 1].date) throw new Error('release notes: not newest first');
  return notes;
}

/** One featured model from its catalog record; throws unless it is enabled, current and complete. */
export function featuredModel(pick, record) {
  if (!record || record.model_id !== pick.id) throw new Error(`featured models: ${pick.id} is not in the catalog`);
  if (record.is_enabled === false || record.is_deprecated) throw new Error(`featured models: ${pick.id} is disabled or deprecated`);
  const context = Number(record.context_length);
  if (!text(record.display_name) || !text(record.provider) || !(context > 0)) throw new Error(`featured models: ${pick.id} lacks a name, provider or context length`);
  if (!text(pick.line) || !Array.isArray(pick.tags) || !pick.tags.length || !pick.tags.every(text)) throw new Error(`featured models: ${pick.id} needs a line and tags`);
  return { id: pick.id, name: record.display_name, provider: record.provider, context, line: pick.line, tags: pick.tags };
}

async function json(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.success === false) throw new Error(`${url}: ${body.message || 'not successful'}`);
  return body;
}

if (process.argv[1] && import.meta.filename === fs.realpathSync(process.argv[1])) {
  const notes = releaseNotes((await json(RELEASE_NOTES.source)).data);
  fs.writeFileSync(RELEASE_NOTES.file, JSON.stringify({ source: RELEASE_NOTES.source, notes }, null, 2) + '\n');
  const total = (await json(`${MODELS.source}?page=1&page_size=1`)).data?.pagination?.total;
  if (!(total > 0)) throw new Error(`${MODELS.source}: no catalog total`);
  const models = [];
  for (const pick of FEATURED) models.push(featuredModel(pick, (await json(`${MODELS.source}${encodeURIComponent(pick.id)}`)).data?.model));
  fs.writeFileSync(MODELS.file, JSON.stringify({ source: MODELS.source, total, models }, null, 2) + '\n');
  console.log(`${notes.length} release notes (newest ${notes[0].version}), ${models.length} featured models of ${total}`);
}
