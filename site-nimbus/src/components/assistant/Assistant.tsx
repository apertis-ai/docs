// Search and Ask Docs view (#9), built from the vendored shadcn/ui parts: search is a Command inside a
// dialog, Ask Docs a sheet (a right-docked panel on desktop, a bottom sheet at <= 640 px).
// - One native <dialog> hosts both: the keyboard contract needs a real modal (showModal, `:modal`, the top
//   layer) for search and a non-blocking panel (show) for Ask Docs; Radix Dialog/Sheet render neither.
// - Rendered at build time and NOT hydrated: its behaviour is the existing client (assistant.ts), bound by
//   AssistantRoot's page script before the load event. As a `client:idle` island, Cmd/Ctrl+K and the
//   characters typed right after it were lost until hydration (m4-e2e: 10 of 35 failed, defect 10 among them).
// The ids and classes below are the stable hooks assistant.ts and the tests use.
import { X } from 'lucide-react';
import { Command, CommandInput, CommandList } from '@/components/ui/command';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const tab = cn(
  'inline-flex h-7 items-center rounded-md border border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors',
  'hover:text-foreground aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-sm focus-visible:outline-2 focus-visible:outline-ring',
);

export default function Assistant() {
  return (
    <dialog id="apertis-assistant" className="aa" aria-label="Search documentation" data-pagefind-ignore="all">
      <div className="aa-frame">
        <div className="aa-head">
          <div className="aa-tabs inline-flex h-9 items-center rounded-lg bg-muted p-[3px]" role="tablist" aria-label="Assistant" data-slot="tabs-list">
            <button type="button" role="tab" id="aa-tab-search" aria-controls="aa-search" aria-selected="true" data-surface="search" data-slot="tabs-trigger" className={tab}>Search</button>
            <button type="button" role="tab" id="aa-tab-ask" aria-controls="aa-ask" aria-selected="false" data-surface="ask" data-slot="tabs-trigger" className={tab}>Ask Docs</button>
          </div>
          <button type="button" className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'aa-close text-muted-foreground')} id="aa-close" aria-label="Close" data-slot="button">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <section id="aa-search" className="aa-search" role="tabpanel" aria-labelledby="aa-tab-search">
          <Command className="aa-command">
            <CommandInput
              id="aa-q" type="text" role="combobox" aria-label="Search the documentation" aria-expanded="false"
              aria-controls="aa-results" aria-autocomplete="list" autoComplete="off" spellCheck={false} placeholder="Search docs"
              className="text-base"
            />
            <p id="aa-status" className="aa-status" role="status" aria-live="polite">Type to search the documentation</p>
            <CommandList id="aa-results" className="aa-results max-h-none" role="listbox" aria-label="Search results" />
          </Command>
        </section>

        <section id="aa-ask" className="aa-ask" role="tabpanel" aria-labelledby="aa-tab-ask" hidden>
          <p className="aa-context">Using current page <span id="aa-context-title" className="aa-chip"></span></p>
          <div id="aa-messages" className="aa-messages" aria-live="polite"></div>
          <p id="aa-ask-status" className="aa-ask-status" role="alert"></p>
          <form id="aa-form" className="aa-form">
            <textarea id="aa-question" rows={2} maxLength={2000} aria-label="Ask a question about the documentation" placeholder="Ask a question..."></textarea>
            <button type="submit" id="aa-send" disabled className={buttonVariants({ size: 'sm' })} data-slot="button">Send</button>
          </form>
          <div className="aa-foot">
            <span>Enter to send, Shift+Enter for a new line.</span>
            <button type="button" id="aa-clear" className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'aa-clear text-muted-foreground [&[hidden]]:hidden')} data-slot="button" hidden>Clear chat</button>
          </div>
          <div id="aa-turnstile" className="aa-turnstile"></div>
        </section>
      </div>
    </dialog>
  );
}
