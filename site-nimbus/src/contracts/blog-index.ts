// The Markdown of the /blog/ index (/blog/index.md): its title and description, then one line per article. Shared by the
// build (src/pages/blog/index.md.ts) and the edge, which appends the live articles.
import { BLOG_DESCRIPTION } from './articles.ts';

export interface BlogLine {
  title: string;
  url: string;
  description: string;
}

/** One article's line: `- [title](url): description` (the llms.txt entry shape). */
export const blogLine = (a: BlogLine): string => `- [${a.title.replace(/[\\[\]]/g, '\\$&')}](${a.url})${a.description ? `: ${a.description.replace(/\s+/g, ' ').trim()}` : ''}`;

export const blogMarkdown = (articles: BlogLine[]): string => `# Apertis blog\n\n${BLOG_DESCRIPTION}\n\n## Articles\n\n${articles.map(blogLine).join('\n')}\n`;
