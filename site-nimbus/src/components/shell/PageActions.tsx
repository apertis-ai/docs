// Page actions (openspec docs-shell-interfaces "Same-release Markdown actions"): Copy as Markdown and a
// shadcn DropdownMenu with the AI-tool links, Copy content URL and View as Markdown. Every action uses
// `<this origin><apertis-docs:markdown path>` (page-actions.ts). The menu is non-modal, so the page keeps
// scrolling. While it is closed its links stay in the DOM (hidden), so they carry their hrefs at all times;
// Radix unmounts a closed menu, and a force-mounted one would still claim Escape from the search dialog.
// Server-rendered hidden: without JavaScript, or before hydration, no dead action is shown.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, FileText, Link, MessageSquare, Sparkles, SquareArrowOutUpRight, Box } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PAGE_META } from '../../contracts/page.ts';
import { aiToolUrls, markdownUrl } from './page-actions.ts';

type Status = { message: string; ok: boolean } | null;
const ext = { target: '_blank', rel: 'noopener noreferrer' };

export default function PageActions({ markdownPath }: { markdownPath: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [label, setLabel] = useState('Copy as Markdown');
  const reset = useRef<number | undefined>(undefined);

  useEffect(() => {
    setUrl(markdownUrl(location.origin, document.querySelector<HTMLMetaElement>(`meta[name="${PAGE_META.markdown}"]`)?.content ?? markdownPath));
  }, [markdownPath]);

  const report = (message: string, ok: boolean, short?: string) => {
    setStatus({ message, ok });
    setLabel(short ?? 'Copy as Markdown');
    clearTimeout(reset.current);
    if (ok) reset.current = window.setTimeout(() => { setStatus(null); setLabel('Copy as Markdown'); }, 1800);
  };
  const clipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      report('Copying is blocked in this browser. Use View as Markdown to open the file instead.', false);
      return false;
    }
  };
  const copyMarkdown = async () => {
    if (!url) return;
    let text: string;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (err) {
      // No silent fallback to rendered text: the reader is told nothing was copied.
      report(`Could not load this page's Markdown (${(err as Error).message}). Nothing was copied.`, false);
      return;
    }
    if (await clipboard(text)) report('Page copied as Markdown.', true, 'Copied');
  };
  const copyUrl = async () => {
    if (url && (await clipboard(url))) report('Markdown URL copied.', true, 'URL Copied');
  };

  // No same-origin Markdown URL: no actions at all.
  if (url === null) return null;
  const tools = url ? aiToolUrls(url) : null;
  const item = 'gap-2.5 text-sm text-foreground';
  const links = [
    { action: 'claude', href: tools?.claude, label: 'Ask Claude', Icon: Sparkles },
    { action: 'chatgpt', href: tools?.chatgpt, label: 'Ask ChatGPT', Icon: MessageSquare },
    { action: 'cursor', href: tools?.cursor, label: 'Open in Cursor', Icon: Box },
    { action: 'view', href: url ?? undefined, label: 'View as Markdown', Icon: FileText },
  ];
  const anchor = ({ action, href, label, Icon }: (typeof links)[number]) => (
    <a key={action} data-action={action} href={href} {...ext}>
      <Icon aria-hidden="true" /><span>{label}</span><SquareArrowOutUpRight className="ml-auto size-3.5" aria-hidden="true" />
    </a>
  );
  return (
    <div className="page-actions" data-page-actions data-ready={url ? '' : undefined}>
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <div className="page-actions__split">
          <button type="button" className="page-actions__primary" data-action="copy-markdown" onClick={copyMarkdown}>
            <Copy className="size-4" aria-hidden="true" /><span data-copy-label>{label}</span>
          </button>
          <DropdownMenuTrigger className="page-actions__toggle" aria-label="Open AI tools">
            <ChevronDown className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent align="end" className="page-actions__menu z-[150] w-56 data-[state=closed]:animate-none!">
          {links.slice(0, 3).map((l) => <DropdownMenuItem key={l.action} asChild className={item}>{anchor(l)}</DropdownMenuItem>)}
          <DropdownMenuSeparator />
          <DropdownMenuItem className={item} data-action="copy-markdown" onSelect={() => void copyMarkdown()}><Copy aria-hidden="true" /><span>Copy as Markdown</span></DropdownMenuItem>
          <DropdownMenuItem className={item} data-action="copy-url" onSelect={() => void copyUrl()}><Link aria-hidden="true" /><span>Copy content URL</span></DropdownMenuItem>
          <DropdownMenuItem asChild className={item}>{anchor(links[3])}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!open && <div className="page-actions__menu" hidden>{links.map(anchor)}</div>}
      <p className="page-actions__status" role="status" aria-live="polite" data-state={status ? (status.ok ? 'ok' : 'error') : undefined}>{status?.message}</p>
    </div>
  );
}
