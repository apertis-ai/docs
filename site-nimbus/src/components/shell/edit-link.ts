// "Edit this page" (openspec docs-reader-shell-extras "Edit this page"): opens the GitHub editor at the
// manifest's own `sourcePath`, which is already repository-relative for both converted docs
// (docs/…, docs-api/…) and native articles (site-nimbus/src/articles/<slug>.md, see isNativeArticle).
// Never a path under the generated content tree (src/content/**).
const GENERATED_PREFIX = 'site-nimbus/src/content/';

export function editUrl(sourcePath: string): string {
  if (sourcePath.startsWith(GENERATED_PREFIX)) throw new Error(`editUrl: ${sourcePath} is a generated path, not a source`);
  return `https://github.com/apertis-ai/docs/edit/main/${sourcePath}`;
}
