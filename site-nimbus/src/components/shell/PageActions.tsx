// Page actions (openspec docs-shell-interfaces "Same-release Markdown actions"): a "Copy page" split button
// (Copy as Markdown) and a shadcn DropdownMenu whose items carry a title and a one-line description, as in
// the Claude Docs page actions: Copy page, Copy content URL, View as Markdown and the AI-tool links. Every action uses
// `<this origin><apertis-docs:markdown path>` (page-actions.ts). The menu is non-modal, so the page keeps
// scrolling; Radix mounts it only while open.
// Server-rendered hidden: without JavaScript, or before hydration, no dead action is shown.
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Box, ChevronDown, Copy, FileText, Link, MessageSquare, Sparkles } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PAGE_META } from '../../contracts/page.ts';
import { aiToolUrls, markdownUrl } from './page-actions.ts';

type Status = { message: string; ok: boolean } | null;
const ext = { target: '_blank', rel: 'noopener noreferrer' };

export default function PageActions({ markdownPath }: { markdownPath: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [label, setLabel] = useState('Copy page');
  const reset = useRef<number | undefined>(undefined);

  useEffect(() => {
    setUrl(markdownUrl(location.origin, document.querySelector<HTMLMetaElement>(`meta[name="${PAGE_META.markdown}"]`)?.content ?? markdownPath));
  }, [markdownPath]);

  const report = (message: string, ok: boolean, short?: string) => {
    setStatus({ message, ok });
    setLabel(short ?? 'Copy page');
    clearTimeout(reset.current);
    if (ok) reset.current = window.setTimeout(() => { setStatus(null); setLabel('Copy page'); }, 1800);
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
  const item = 'items-start gap-3 py-2 text-foreground';
  const body = (title: string, desc: string, Icon: typeof Copy, external = false) => (
    <>
      <span className="page-actions__icon" aria-hidden="true"><Icon /></span>
      <span className="grid gap-0.5">
        <span data-item-title className="flex items-center gap-1 text-sm font-medium">{title}{external && <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden="true" />}</span>
        <span data-item-desc className="text-xs text-muted-foreground">{desc}</span>
      </span>
    </>
  );
  const links = [
    { action: 'view', href: url ?? undefined, title: 'View as Markdown', desc: 'View this page as plain text', Icon: FileText },
    { action: 'claude', href: tools?.claude, title: 'Ask Claude', desc: 'Ask questions about this page', Icon: Sparkles },
    { action: 'chatgpt', href: tools?.chatgpt, title: 'Ask ChatGPT', desc: 'Ask questions about this page', Icon: MessageSquare },
    { action: 'cursor', href: tools?.cursor, title: 'Open in Cursor', desc: 'Load this page into Cursor', Icon: Box },
  ];
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
        <DropdownMenuContent align="end" className="page-actions__menu z-[150] w-72 data-[state=closed]:animate-none!">
          <DropdownMenuItem className={item} data-action="copy-markdown" onSelect={() => void copyMarkdown()}>{body('Copy page', 'Copy page as Markdown for LLMs', Copy)}</DropdownMenuItem>
          <DropdownMenuItem className={item} data-action="copy-url" onSelect={() => void copyUrl()}>{body('Copy content URL', 'Copy the Markdown link for this page', Link)}</DropdownMenuItem>
          <DropdownMenuItem asChild className={item}><a data-action="view" href={links[0].href} {...ext}>{body(links[0].title, links[0].desc, links[0].Icon, true)}</a></DropdownMenuItem>
          <DropdownMenuSeparator />
          {links.slice(1).map((l) => (
            <DropdownMenuItem key={l.action} asChild className={item}><a data-action={l.action} href={l.href} {...ext}>{body(l.title, l.desc, l.Icon, true)}</a></DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="page-actions__status" role="status" aria-live="polite" data-state={status ? (status.ok ? 'ok' : 'error') : undefined}>{status?.message}</p>
    </div>
  );
}
