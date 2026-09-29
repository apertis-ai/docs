// Homepage hero code sample: shadcn Tabs over the Quick Start request (cURL, Python, Node.js). The code is
// highlighted at build time (Astro <Code>, Shiki) and arrives as Astro slots; this island only switches
// tabs and copies the raw source.
import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const SAMPLES = [
  { id: 'curl', label: 'cURL' },
  { id: 'python', label: 'Python' },
  { id: 'node', label: 'Node.js' },
] as const;
type SampleId = (typeof SAMPLES)[number]['id'];

type Props = Partial<Record<SampleId, ReactNode>> & { sources: Record<SampleId, string> };

export default function HeroCode(props: Props) {
  const [tab, setTab] = useState<SampleId>('curl');
  const [copied, setCopied] = useState<'ok' | 'error' | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.sources[tab]);
      setCopied('ok');
    } catch {
      setCopied('error');
    }
    setTimeout(() => setCopied(null), 1800);
  };
  return (
    <Tabs value={tab} onValueChange={(v) => { setTab(v as SampleId); setCopied(null); }} className="hero-code gap-0" data-hero-code>
      <div className="hero-code__bar">
        <TabsList variant="line" aria-label="Request samples" className="h-9">
          {SAMPLES.map((s) => <TabsTrigger key={s.id} value={s.id} className="px-2.5">{s.label}</TabsTrigger>)}
        </TabsList>
        <button type="button" onClick={copy} data-slot="button" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')} aria-label="Copy code">
          {copied === 'ok' ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          <span>{copied === 'ok' ? 'Copied' : copied === 'error' ? 'Copy blocked' : 'Copy'}</span>
        </button>
      </div>
      {SAMPLES.map((s) => <TabsContent key={s.id} value={s.id} className="hero-code__panel">{props[s.id]}</TabsContent>)}
    </Tabs>
  );
}
