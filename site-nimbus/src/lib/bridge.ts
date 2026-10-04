// Hand-off from the always-loaded page scripts to React islands that hydrate later (`client:idle`):
// a message sent before its island has mounted is kept (the latest per channel) and delivered on mount.
// State lives on window so every bundle that imports this module shares it.
type Handler = (detail: unknown) => void;
interface BridgeState {
  pending: Record<string, unknown>;
  handlers: Record<string, Handler>;
}
const state = ((globalThis as { __apertisBridge?: BridgeState }).__apertisBridge ??= { pending: {}, handlers: {} });

export function send(channel: string, detail: unknown = null): void {
  const handler = state.handlers[channel];
  if (handler) handler(detail);
  else state.pending[channel] = detail;
}

/** Registers the island's handler and delivers a message that arrived before it. Returns an unsubscribe. */
export function receive(channel: string, handler: Handler): () => void {
  state.handlers[channel] = handler;
  if (channel in state.pending) {
    const detail = state.pending[channel];
    delete state.pending[channel];
    handler(detail);
  }
  return () => {
    if (state.handlers[channel] === handler) delete state.handlers[channel];
  };
}
