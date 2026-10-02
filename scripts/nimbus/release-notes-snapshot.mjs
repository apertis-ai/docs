// The homepage "Latest" release notes (openspec docs-shell-interfaces, homepage as revised on 2026-10-02):
// a snapshot of the public Apertis changelog's homepage view, committed so the build never calls the network.
//   node scripts/nimbus/release-notes-snapshot.mjs
// Rewrites site-nimbus/src/components/home/release-notes.json; review and commit the diff like any content change.
import fs from 'node:fs';
import path from 'node:path';

export const SOURCE = 'https://apertis.ai/api/changelog?view=homepage';
export const FILE = path.resolve(import.meta.dirname, '../../site-nimbus/src/components/home/release-notes.json');

/** The fields the homepage shows, newest first; throws on anything it could not render. */
export function releaseNotes(data) {
  if (!Array.isArray(data) || !data.length) throw new Error('release notes: expected a non-empty list');
  const notes = data.map((e, i) => {
    const note = { version: e?.version, date: e?.date, title: e?.title, description: e?.description ?? '' };
    for (const k of ['version', 'date', 'title']) if (typeof note[k] !== 'string' || !note[k].trim()) throw new Error(`release notes: entry ${i} has no ${k}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(note.date)) throw new Error(`release notes: entry ${i} date ${note.date} is not YYYY-MM-DD`);
    if (typeof note.description !== 'string') throw new Error(`release notes: entry ${i} description is not text`);
    return note;
  });
  for (let i = 1; i < notes.length; i++) if (notes[i].date > notes[i - 1].date) throw new Error('release notes: not newest first');
  return notes;
}

if (process.argv[1] && import.meta.filename === fs.realpathSync(process.argv[1])) {
  const res = await fetch(SOURCE, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${SOURCE}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.success !== true) throw new Error(`${SOURCE}: ${body.message || 'not successful'}`);
  const notes = releaseNotes(body.data);
  fs.writeFileSync(FILE, JSON.stringify({ source: SOURCE, notes }, null, 2) + '\n');
  console.log(`${path.relative(process.cwd(), FILE)}: ${notes.length} release notes, newest ${notes[0].version} (${notes[0].date})`);
}
