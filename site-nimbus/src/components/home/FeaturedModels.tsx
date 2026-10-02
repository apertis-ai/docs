// Homepage "Models" (openspec docs-shell-interfaces, homepage as revised on 2026-10-02), after the Claude
// docs model family: the featured models of the committed catalog snapshot (featured-models.json,
// scripts/nimbus/homepage-snapshot.mjs) as shadcn Cards that open the model on apertis.ai/models. "New"
// marks a model the release-notes snapshot announces. Server-rendered, no client JS.
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import catalog from './featured-models.json';
import releases from './release-notes.json';

const context = (tokens: number) => (tokens >= 1e6 ? `${+(tokens / 1e6).toFixed(1)}M` : `${Math.round(tokens / 1e3)}K`);

export default function FeaturedModels() {
  return (
    <ul className="models">
      {catalog.models.map((m) => (
        <li key={m.id}>
          <a className="model-card" href={`https://apertis.ai/models/${encodeURIComponent(m.id)}`} target="_blank" rel="noopener noreferrer">
            <Card className="h-full gap-3 px-5 py-5 shadow-none">
              <span className="model-card__head">
                <span className="model-card__name">{m.name}</span>
                {releases.notes.some((n) => n.description.includes(m.name)) && <Badge variant="secondary">New</Badge>}
              </span>
              <span className="model-card__meta">{m.provider} · {context(m.context)} context</span>
              <span className="model-card__tags">
                {m.tags.map((t) => <Badge key={t} variant="outline" className="text-muted-foreground">{t}</Badge>)}
              </span>
              <span className="model-card__line">{m.line}</span>
            </Card>
          </a>
        </li>
      ))}
    </ul>
  );
}
