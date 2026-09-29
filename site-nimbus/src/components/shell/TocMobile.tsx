// Mobile "On this page" disclosure: a native <details> (it works without JavaScript) whose summary states
// its expanded state in ARIA once hydrated; before that, the native state is the only one. The TOC list
// (Toc.astro) arrives as the Astro slot.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export default function TocMobile({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const details = useRef<HTMLDetailsElement>(null);
  // The reader may have opened the native disclosure before hydration: state what it is now.
  useEffect(() => setOpen(details.current?.open ?? false), []);
  return (
    <details ref={details} className="toc-mobile" data-pagefind-ignore="all" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary aria-expanded={open === null ? undefined : open}>On this page<ChevronDown className="size-4" aria-hidden="true" /></summary>
      {children}
    </details>
  );
}
