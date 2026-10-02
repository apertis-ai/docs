// Homepage "Latest" release notes (openspec docs-shell-interfaces, homepage as revised on 2026-10-02): the
// committed snapshot of the public changelog (release-notes.json, scripts/nimbus/release-notes-snapshot.mjs),
// newest first, as dated rows that open the entry on apertis.ai/changelog. Server-rendered, no client JS.
import { Badge } from '@/components/ui/badge';
import { displayDate } from '../shell/page-header.ts';
import snapshot from './release-notes.json';

export default function ReleaseNotes() {
  return (
    <ol className="release-list">
      {snapshot.notes.map((n) => (
        <li key={n.version}>
          <a className="release-row" href={`https://apertis.ai/changelog/${encodeURIComponent(n.version)}`} target="_blank" rel="noopener noreferrer">
            <time className="release-row__date" dateTime={n.date}>{displayDate(n.date)}</time>
            <span className="release-row__text">
              <span className="release-row__desc">{n.description || n.title}</span>
              <span className="release-row__title">{n.title}</span>
            </span>
            <Badge variant="outline" className="font-mono text-muted-foreground">v{n.version}</Badge>
          </a>
        </li>
      ))}
    </ol>
  );
}
