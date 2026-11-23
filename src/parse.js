// Reading issue bodies and comments: dependencies, session links, mentions, "Fini quand".

const AFTER_LINE_RE = /^\s*apres:(.*)$/gim;
const SESSION_RE = /https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+/g;
const MENTION_RE = /(?<![\w#&/])#(\d+)\b/g;

const unique = list => [...new Set(list)];

/** Issue numbers of every `apres: #N, #M` line (the Python script reads the first one only). */
export function parseAfter(body) {
  const out = [];
  for (const m of (body || '').matchAll(AFTER_LINE_RE)) {
    for (const n of m[1].matchAll(/#(\d+)/g)) out.push(Number(n[1]));
  }
  return unique(out);
}

/** Claude session links of the comments, oldest first; struck comments (`~~…`) are withdrawn. */
export function sessionLinks(comments) {
  const out = [];
  for (const c of comments) {
    if ((c.body || '').trimStart().startsWith('~~')) continue;
    out.push(...(c.body || '').match(SESSION_RE) || []);
  }
  return unique(out);
}

/** `#N` references outside code and outside `apres:` lines. */
export function mentions(text) {
  const prose = (text || '')
    .replace(/^```[\s\S]*?^```/gm, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/^\s*apres:.*$/gim, '');
  return unique([...prose.matchAll(MENTION_RE)].map(m => Number(m[1])));
}

/** Items of the `## Fini quand` section; `done` is null for a bullet without a checkbox. */
export function finishedWhen(body) {
  const lines = (body || '').split(/\r?\n/);
  const start = lines.findIndex(l => /^##\s+Fini quand\s*$/i.test(l));
  if (start < 0) return null;
  const items = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    const m = line.match(/^\s*[-*]\s+(?:\[([ xX])\]\s+)?(.*\S)\s*$/);
    if (m) items.push({ text: m[2], done: m[1] === undefined ? null : m[1] !== ' ' });
  }
  const boxes = items.filter(i => i.done !== null);
  return { items, done: boxes.filter(i => i.done).length, total: boxes.length };
}

/** Whitespace collapsed, cut to n characters with an ellipsis. */
export function short(text, n = 90) {
  const t = (text || '').split(/\s+/).filter(Boolean).join(' ');
  return t.length <= n ? t : t.slice(0, n - 1) + '…';
}
