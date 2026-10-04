// Homepage "Latest" release notes (openspec docs-shell-interfaces, homepage as revised on 2026-10-03): the
// newest entries of the public changelog as dated rows that open the entry on apertis.ai/changelog. Rendered
// at build time from home-feed.json; the homepage swap script refills the same markup from
// /_nimbus/home-feed (the `data-f` fields, feed.ts noteView).
import { Badge } from '@/components/ui/badge';
import { noteView, type ReleaseNote } from './feed.ts';

export default function ReleaseNotes({ notes }: { notes: ReleaseNote[] }) {
  return (
    <ol className="release-list" data-feed="notes">
      {notes.map(noteView).map((v) => (
        <li key={v.href}>
          <a className="release-row" data-f="href" href={v.href} target="_blank" rel="noopener noreferrer">
            <time className="release-row__date" data-f="date" dateTime={v.datetime}>{v.date}</time>
            <span className="release-row__text">
              <span className="release-row__desc" data-f="description">{v.description}</span>
              <span className="release-row__title" data-f="title">{v.title}</span>
            </span>
            <Badge variant="outline" className="font-mono text-muted-foreground" data-f="version">{v.version}</Badge>
          </a>
        </li>
      ))}
    </ol>
  );
}
