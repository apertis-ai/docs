# Change: Ask Docs Agent Panel

## Why
Ask Docs currently opens as a centered, blocking modal. Users reading documentation lose page context when they ask a question, and answer trust depends too heavily on inline markdown citations rather than a dedicated source UI.

## What Changes
- Replace the Ask Docs modal presentation with a docked right-side assistant panel on desktop.
- Use a mobile bottom sheet layout for small screens.
- Keep search in the existing command-modal flow, while Ask Docs gets its own panel shell.
- Add current-page context, compact starter prompts, source extraction, answer actions, and chat persistence.

## Impact
- Affects `src/components/UnifiedSearchModal/*`.
- Keeps the existing `/api/ask` streaming endpoint.
- Does not change RAG, database schema, or model configuration.
