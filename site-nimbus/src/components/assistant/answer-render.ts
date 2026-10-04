// Ask Docs answer renderer: the answer's Markdown as DOM nodes (createElement and text nodes, never
// innerHTML), links only to internal paths and https. Moved unchanged out of assistant.ts.
import { isInternalHref } from './wire.ts';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, ...children: (Node | string)[]) => {
  const el = document.createElement(tag);
  el.append(...children);
  return el;
};

/** Inline Markdown as DOM nodes: code spans, bold, emphasis and links (internal paths and https only). */
export function inlineNodes(text: string): (Node | string)[] {
  const out: (Node | string)[] = [];
  let last = 0;
  for (const m of text.matchAll(/`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w*])[*_]([^*_\s](?:[^*_]*[^*_\s])?)[*_](?![\w*])/g)) {
    const [whole, code, bold, label, href, em] = m;
    let node: Node | null = null;
    if (code !== undefined) node = h('code', code);
    else if (bold !== undefined) node = h('strong', ...inlineNodes(bold));
    else if (em !== undefined) node = h('em', ...inlineNodes(em));
    else if (isInternalHref(href) || href.startsWith('https://')) node = Object.assign(h('a', ...inlineNodes(label)), { href });
    if (!node) continue;
    out.push(text.slice(last, m.index), node);
    last = m.index! + whole.length;
  }
  out.push(text.slice(last));
  return out;
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

/**
 * The answer's Markdown as DOM nodes, like the legacy widget's react-markdown + GFM: paragraphs, headings,
 * lists, fenced code, tables and quotes. Built with createElement and text nodes, so answer HTML stays text.
 * ponytail: flat lists only (nested items render at one level); add nesting if answers need it.
 */
export function answerNodes(text: string): Node[] {
  const lines = text.split('\n');
  const out: Node[] = [];
  let i = 0;
  const isList = (l: string) => /^\s*([-*+]|\d+[.)])\s+/.test(l);
  const isTableSep = (l: string | undefined) => !!l && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i]);
      i++;
      out.push(h('pre', h('code', body.join('\n'))));
      continue;
    }
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) { out.push(h('h4', ...inlineNodes(heading[1]))); i++; continue; }
    if (line.includes('|') && isTableSep(lines[i + 1])) {
      const head = h('tr', ...cells(line).map((c) => h('th', ...inlineNodes(c))));
      const rows: Node[] = [];
      for (i += 2; i < lines.length && lines[i].includes('|') && lines[i].trim(); i++) rows.push(h('tr', ...cells(lines[i]).map((c) => h('td', ...inlineNodes(c)))));
      out.push(h('div', h('table', h('thead', head), h('tbody', ...rows))));
      (out.at(-1) as HTMLElement).className = 'aa-table';
      continue;
    }
    if (isList(line)) {
      const ordered = /^\s*\d/.test(line);
      const list = h(ordered ? 'ol' : 'ul');
      for (; i < lines.length && isList(lines[i]); i++) list.append(h('li', ...inlineNodes(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''))));
      out.push(list);
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) body.push(lines[i].replace(/^\s*>\s?/, ''));
      out.push(h('blockquote', ...answerNodes(body.join('\n'))));
      continue;
    }
    const para: string[] = [];
    for (; i < lines.length && lines[i].trim() && !/^\s*(```|~~~|#{1,6}\s|>)/.test(lines[i]) && !isList(lines[i]) && !(lines[i].includes('|') && isTableSep(lines[i + 1])); i++) para.push(lines[i]);
    out.push(h('p', ...inlineNodes(para.join('\n'))));
  }
  return out;
}
