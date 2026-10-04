// Homepage "New models" (openspec docs-shell-interfaces, homepage as revised on 2026-10-03): the models most
// recently added to the public catalog, as shadcn Cards that open the model on apertis.ai/models. Rendered
// at build time from home-feed.json; the homepage swap script refills the same markup from
// /_nimbus/home-feed (the `data-f` fields, feed.ts modelView).
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { modelView, type NewModel } from './feed.ts';

export default function NewModels({ models }: { models: NewModel[] }) {
  return (
    <ul className="models" data-feed="models">
      {models.map(modelView).map((v) => (
        <li key={v.href}>
          <a className="model-card" data-f="href" href={v.href} target="_blank" rel="noopener noreferrer">
            <Card className="h-full gap-3 px-5 py-5 shadow-none">
              <span className="model-card__name" data-f="name">{v.name}</span>
              <span className="model-card__meta"><span data-f="provider">{v.provider}</span> · <span data-f="added">{v.added}</span></span>
              <span className="model-card__tags">
                <Badge variant="outline" className="text-muted-foreground" data-f="category">{v.category}</Badge>
                <Badge variant="outline" className="text-muted-foreground" data-f="context" hidden={!v.context}>{v.context}</Badge>
              </span>
              <span className="model-card__line" data-f="description" hidden={!v.description}>{v.description}</span>
            </Card>
          </a>
        </li>
      ))}
    </ul>
  );
}
