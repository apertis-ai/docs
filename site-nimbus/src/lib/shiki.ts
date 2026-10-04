// Shiki stops tokenizing a line after `tokenizeTimeLimit` (500 ms by default), so on a loaded machine the
// same code block renders with different tokens and the build is no longer deterministic (#13). Astro
// exposes no option for it; Shiki passes the same options object to `preprocess` and then to the
// tokenizer, and 0 means no limit. Used by the Markdown pipeline and by every <Code> (the hero sample).
export const noTokenizeTimeLimit = {
  name: 'apertis:no-tokenize-time-limit',
  preprocess(_code: string, options: { tokenizeTimeLimit?: number }) {
    options.tokenizeTimeLimit = 0;
  },
};
