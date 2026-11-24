// Reading aids for long texts: is it long, its first paragraph, its outline.
import { inlineText, parseMarkdown } from './markdown.js';

const LONG_BLOCKS = 5;
const LONG_CHARS = 1200;

export function isLong(body) {
  const text = body || '';
  return text.length > LONG_CHARS || parseMarkdown(text).length > LONG_BLOCKS;
}

/** First top-level paragraph as plain text, or null. */
export function lead(body) {
  const first = parseMarkdown(body).find(b => b.type === 'paragraph');
  return first ? inlineText(first.inlines).replace(/\s+/g, ' ').trim() : null;
}

/** `##` and `###` top-level headings; `index` matches the ids given by renderMarkdown's headingIds. */
export function outline(body) {
  return parseMarkdown(body).filter(b => b.type === 'heading')
    .map((b, index) => ({ level: b.level, text: inlineText(b.inlines).trim(), index }))
    .filter(h => h.level === 2 || h.level === 3);
}
