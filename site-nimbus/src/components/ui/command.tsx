// shadcn/ui Command (new-york), vendored WITHOUT cmdk. cmdk replaces each item's id with its own useId and
// filters on its own; the search contract (openspec docs-shell-interfaces "Keyboard contract", m4-e2e)
// needs stable option ids (`aa-result-N`) for aria-activedescendant and Pagefind's ranking, so these are
// the shadcn Command parts with the same slots and classes, and the owner (Assistant.tsx) keeps the
// listbox state. Selection is `aria-selected="true"` instead of cmdk's data-selected.
import * as React from 'react';
import { SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function Command({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="command"
      className={cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', className)}
      {...props}
    />
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-12 items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
      <input
        data-slot="command-input"
        className={cn(
          'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="command-list"
      className={cn('max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto', className)}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="command-empty" className={cn('py-6 text-center text-sm', className)} {...props} />;
}

function CommandItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="command-item"
      role="option"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none aria-selected:bg-accent aria-selected:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return <span data-slot="command-shortcut" className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...props} />;
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandShortcut };
