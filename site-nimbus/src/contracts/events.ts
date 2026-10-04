// The one way to open Search or Ask Docs (openspec docs-shell-interfaces "Surface open event").
// The shell (#8) dispatches; the search/Ask Docs client (#9) is the only listener.

export const OPEN_EVENT = 'apertis-docs:open';

export interface OpenSurfaceDetail {
  surface: 'search' | 'ask';
  query?: string;
}

declare global {
  interface WindowEventMap {
    'apertis-docs:open': CustomEvent<OpenSurfaceDetail>;
  }
}

function open(detail: OpenSurfaceDetail): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));
}

export function openSearch(query?: string): void {
  open(query === undefined ? { surface: 'search' } : { surface: 'search', query });
}

export function openAskDocs(): void {
  open({ surface: 'ask' });
}
