// Homepage "Start building" (openspec docs-shell-interfaces, homepage as revised on 2026-10-03): the legacy
// feature-card destinations (`.feature-card`, same hrefs as before the redesign; the Playground card is gone,
// operator review 2026-10-03) as shadcn Items with an icon, a title and one line; no border or fill. Server-rendered, no client JS.
import { BookOpen, Code, CreditCard, Layers, Package, SquareTerminal } from 'lucide-react';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

const items = [
  { icon: BookOpen, title: 'Introduction', line: 'What Apertis is, and how one key reaches every provider.', href: '/intro' },
  { icon: Layers, title: 'Models', line: 'Compare models across providers and pick one for each task.', href: '/installation/models' },
  { icon: Code, title: 'API reference', line: 'Chat completions, Messages, streaming and every other endpoint.', href: '/api' },
  { icon: SquareTerminal, title: 'Coding agents', line: 'Connect Claude Code, Cursor, Cline and other coding tools.', href: '/installation/claude-code' },
  { icon: Package, title: 'SDKs', line: 'Point the OpenAI SDK you already use at Apertis.', href: '/installation/scripts' },
  { icon: CreditCard, title: 'Plans and billing', line: 'Subscription plans with fixed quota, or pay as you go per token.', href: '/billing/subscription-plans' },
];

export default function StartBuilding() {
  return (
    <ul className="start m-0 list-none p-0">
      {items.map((it) => (
        <li key={it.href}>
          <Item asChild className="start-item feature-card px-0 py-3 [a]:hover:bg-transparent">
            <a href={it.href}>
              <ItemMedia variant="icon" className="size-10 rounded-md border-border text-foreground">
                <it.icon aria-hidden="true" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className="text-[length:var(--fs-md)]">{it.title}</ItemTitle>
                <ItemDescription className="m-0">{it.line}</ItemDescription>
              </ItemContent>
            </a>
          </Item>
        </li>
      ))}
    </ul>
  );
}
