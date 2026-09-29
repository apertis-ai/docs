// Navigation sheet (<= 1023 px) and sidebar drawer (<= 996 px): a shadcn Sheet (Radix Dialog), so focus
// containment, Escape, the overlay click and the wheel/touch scroll lock (body[data-scroll-locked]) are
// Radix's. The menu button is server-rendered in the header; shell.client.ts forwards its clicks through
// the bridge, so a click before this island hydrates still opens it. Closing is instant (no exit
// animation), like the native drawer it replaces, so focus returns at once. It layers above the sticky
// header (z-index 100) and the non-modal Ask Docs panel (z-index 1000).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { ArrowUpRight, Moon, Sun, X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { receive } from '@/lib/bridge';
import { OPEN_EVENT } from '../../contracts/events.ts';

interface Props {
  /** The page's sidebar (Sidebar.astro), passed as an Astro slot; absent on pages without one. */
  sidebar?: ReactNode;
  current: 'tutorialSidebar' | 'apiSidebar' | null;
}

const external = { target: '_blank', rel: 'noopener noreferrer' };
const opener = () => document.querySelector<HTMLElement>('[data-drawer-open]');

export default function NavSheet({ sidebar, current }: Props) {
  const [open, setOpen] = useState(false);

  const returnFocus = useRef(true);

  useEffect(() => receive('nav', () => setOpen(true)), []);
  useEffect(() => {
    const button = opener();
    button?.setAttribute('aria-expanded', String(open));
    // aria-controls only while the controlled element exists.
    if (open) button?.setAttribute('aria-controls', 'shell-drawer');
    else button?.removeAttribute('aria-controls');
    if (!open) return;
    // Search or Ask Docs opening (the open event, or Cmd/Ctrl+K) closes the sheet first, synchronously and
    // without taking focus back: otherwise Radix's focus trap, hideOthers (aria-hidden) and scroll lock
    // would hold the search dialog. Capture phase, so this runs before assistant.ts; nothing is stopped.
    const yieldTo = () => close(false);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') yieldTo();
    };
    window.addEventListener(OPEN_EVENT, yieldTo, { capture: true });
    window.addEventListener('keydown', onKey, { capture: true });
    // Leaving the compact breakpoint with the sheet open would leave the page locked.
    const wide = matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => { if (e.matches) setOpen(false); };
    wide.addEventListener('change', onChange);
    requestAnimationFrame(() => document.querySelector('#shell-drawer [aria-current="page"]')?.scrollIntoView({ block: 'center' }));
    return () => {
      wide.removeEventListener('change', onChange);
      window.removeEventListener(OPEN_EVENT, yieldTo, { capture: true });
      window.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [open]);

  // Focus returns to the menu button synchronously on close, as with the native drawer (Radix alone restores
  // it a task later). The overlay closes on click too: Radix arms its outside-pointer listener a task after
  // opening, and a click that soon would otherwise be lost.
  function close(backToButton = true) {
    returnFocus.current = backToButton;
    flushSync(() => setOpen(false));
    if (backToButton) opener()?.focus();
  }
  const item = 'block rounded-md px-2 py-2 text-base text-foreground hover:bg-accent';
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <SheetContent
        side="left"
        id="shell-drawer"
        showCloseButton={false}
        aria-label="Navigation"
        className="z-[1100] w-[min(83vw,360px)] gap-0 p-0 sm:max-w-[360px] data-[state=closed]:animate-none!"
        overlayProps={{ className: 'z-[1100] data-[state=closed]:animate-none!', onClick: () => close() }}
        onCloseAutoFocus={(e) => { e.preventDefault(); if (returnFocus.current) opener()?.focus(); }}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Site navigation and the documentation sidebar</SheetDescription>
        <div className="drawer__head">
          <a className="brand" href="/"><img src="/img/logo.svg" alt="" width={24} height={24} /><span>Apertis Docs</span></a>
          <button type="button" data-slot="button" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'icon-button ml-auto')} data-theme-toggle aria-label="Toggle dark mode">
            <Sun className="icon-sun size-[18px]" aria-hidden="true" />
            <Moon className="icon-moon size-[18px]" aria-hidden="true" />
          </button>
          <SheetClose data-slot="button" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'icon-button')} data-drawer-close aria-label="Close navigation">
            <X className="size-5" aria-hidden="true" />
          </SheetClose>
        </div>
        <div className="drawer__body">
          <nav aria-label="Main" className="drawer__menu">
            <a className={cn(item, current === 'tutorialSidebar' && 'font-medium')} href="/intro" aria-current={current === 'tutorialSidebar' ? 'true' : undefined}>Docs</a>
            <a className={cn(item, current === 'apiSidebar' && 'font-medium')} href="/api" aria-current={current === 'apiSidebar' ? 'true' : undefined}>API Reference</a>
            <a className={cn(item, 'flex items-center justify-between')} href="https://apertis.ai/changelog" {...external}>Release Notes<ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" /></a>
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a data-slot="button" className={buttonVariants({ variant: 'outline' })} href="https://apertis.ai/login" {...external}>Log in</a>
            <a data-slot="button" className={buttonVariants()} href="https://apertis.ai/register" {...external}>Create account</a>
          </div>
          {sidebar && (
            <div className="drawer__sidebar">
              <Separator className="my-5" />
              {sidebar}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
