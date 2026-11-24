// Safe markdown: parse to a small tree, then build DOM nodes one by one.
// Never innerHTML: raw HTML in an issue stays text, only http(s) links become links.

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE_RE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE_RE = /^\s{0,3}>\s?(.*)$/;
const ITEM_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TASK_RE = /^\[([ xX])\]\s+(.*)$/s;

/** http(s) URL normalised by the URL parser, or null. */
export function safeHref(href) {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

const startsBlock = line => FENCE_RE.test(line) || HEADING_RE.test(line) || RULE_RE.test(line)
  || QUOTE_RE.test(line) || ITEM_RE.test(line);

export function parseMarkdown(src) {
  const text = (src || '').replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n');
  return parseBlocks(text.split('\n'));
}

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = line.match(FENCE_RE);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, inlines: parseInlines(heading[2]) });
      i++;
      continue;
    }
    if (RULE_RE.test(line)) { blocks.push({ type: 'rule' }); i++; continue; }
    if (QUOTE_RE.test(line)) {
      const body = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) body.push(lines[i++].match(QUOTE_RE)[1]);
      blocks.push({ type: 'quote', blocks: parseBlocks(body) });
      continue;
    }
    if (ITEM_RE.test(line)) { i = parseList(lines, i, blocks); continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !startsBlock(lines[i]))) para.push(lines[i++].trim());
    blocks.push({ type: 'paragraph', inlines: parseInlines(para.join('\n')) });
  }
  return blocks;
}

function parseList(lines, i, blocks) {
  const first = lines[i].match(ITEM_RE);
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  while (i < lines.length) {
    const m = lines[i].match(ITEM_RE);
    if (!m || m[1].length !== indent || /\d/.test(m[2]) !== ordered) break;
    const content = [m[3]];
    const inner = indent + m[2].length + 1;
    i++;
    while (i < lines.length) {
      const l = lines[i];
      const lead = l.match(/^\s*/)[0].length;
      if (!l.trim()) {
        const next = lines.slice(i + 1).find(x => x.trim());
        if (next !== undefined && next.match(/^\s*/)[0].length > indent) { content.push(''); i++; continue; }
        break;
      }
      if (lead > indent) { content.push(l.slice(Math.min(lead, inner))); i++; continue; }
      if (startsBlock(l)) break;
      content.push(l.trim()); // lazy continuation
      i++;
    }
    const task = content[0].match(TASK_RE);
    if (task) content[0] = task[2];
    items.push({ checked: task ? task[1] !== ' ' : null, blocks: parseBlocks(content) });
    while (i < lines.length && !lines[i].trim()) {
      const next = lines.slice(i).find(x => x.trim());
      const nm = next && next.match(ITEM_RE);
      if (nm && nm[1].length === indent) i++; else break;
    }
  }
  blocks.push({ type: 'list', ordered, items });
  return i;
}

// ---- inlines

const LINK_RE = /^(!?)\[([^\]\n]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/;
const AUTOLINK_RE = /^https?:\/\/[^\s<>()]+/;
const ISSUE_RE = /^#(\d+)\b/;

function parseInlines(src) {
  const out = [];
  const pushText = t => {
    if (!t) return;
    const last = out.at(-1);
    if (last && last.type === 'text') last.text += t; else out.push({ type: 'text', text: t });
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const prev = i > 0 ? src[i - 1] : '';
    const ch = src[i];
    if (ch === '`') {
      const run = rest.match(/^`+/)[0];
      const end = src.indexOf(run, i + run.length);
      if (end > 0) {
        out.push({ type: 'code', text: src.slice(i + run.length, end).trim() });
        i = end + run.length;
        continue;
      }
      pushText(run);
      i += run.length;
      continue;
    }
    if (ch === '[' || (ch === '!' && src[i + 1] === '[')) {
      const m = rest.match(LINK_RE);
      if (m) {
        const href = safeHref(m[3]);
        if (href) out.push({ type: 'link', href, inlines: m[1] ? [{ type: 'text', text: m[2] }] : parseInlines(m[2]) });
        else pushText(m[0]);
        i += m[0].length;
        continue;
      }
    }
    if (ch === 'h' && !/\w/.test(prev)) {
      const m = rest.match(AUTOLINK_RE);
      if (m) {
        const raw = m[0].replace(/[.,;:!?]+$/, '');
        const href = safeHref(raw);
        if (href) {
          out.push({ type: 'link', href, inlines: [{ type: 'text', text: raw }] });
          i += raw.length;
          continue;
        }
      }
    }
    if (ch === '#' && !/[\w#&/]/.test(prev)) {
      const m = rest.match(ISSUE_RE);
      if (m) {
        out.push({ type: 'issue', number: Number(m[1]) });
        i += m[0].length;
        continue;
      }
    }
    const span = emphasis(src, i, prev);
    if (span) {
      out.push({ type: span.type, inlines: parseInlines(span.inner) });
      i = span.end;
      continue;
    }
    pushText(ch);
    i++;
  }
  return out;
}

function emphasis(src, i, prev) {
  for (const [marker, type] of [['**', 'strong'], ['__', 'strong'], ['~~', 'del'], ['*', 'em'], ['_', 'em']]) {
    if (!src.startsWith(marker, i)) continue;
    if (marker[0] === '_' && /[\p{L}\p{N}]/u.test(prev)) return null;
    const from = i + marker.length;
    if (!src[from] || /\s/.test(src[from])) return null;
    let end = src.indexOf(marker, from + 1);
    while (end > 0 && (/\s/.test(src[end - 1]) || (marker[0] === '_' && /[\p{L}\p{N}]/u.test(src[end + marker.length] || ''))
      || (marker.length === 1 && src[end + 1] === marker))) {
      end = src.indexOf(marker, end + (marker.length === 1 && src[end + 1] === marker ? 2 : 1));
    }
    if (end < 0) return null;
    return { type, inner: src.slice(from, end), end: end + marker.length };
  }
  return null;
}

// ---- DOM

/**
 * DOM fragment of `src`. With `headingIds`, top-level headings get the id `<headingIds>-<i>`, i counting
 * those headings in order (see outline() in reading.js).
 */
export function renderMarkdown(src, doc, { issueHref, headingIds = null }) {
  const frag = doc.createDocumentFragment();
  let heading = 0;
  for (const block of parseMarkdown(src)) {
    const el = renderBlock(block, doc, issueHref);
    if (block.type === 'heading' && headingIds) el.setAttribute('id', `${headingIds}-${heading}`);
    if (block.type === 'heading') heading += 1;
    frag.appendChild(el);
  }
  return frag;
}

/** Text of parsed inlines, without any markup. */
export function inlineText(inlines) {
  return inlines.map(n => (n.type === 'text' || n.type === 'code' ? n.text : n.type === 'issue' ? `#${n.number}` : inlineText(n.inlines))).join('');
}

function renderBlock(block, doc, issueHref) {
  const el = tag => doc.createElement(tag);
  switch (block.type) {
    case 'heading': return fill(el(`h${block.level}`), block.inlines, doc, issueHref);
    case 'paragraph': return fill(el('p'), block.inlines, doc, issueHref);
    case 'rule': return el('hr');
    case 'code': {
      const pre = el('pre');
      const code = el('code');
      code.textContent = block.text;
      pre.appendChild(code);
      return pre;
    }
    case 'quote': {
      const q = el('blockquote');
      for (const b of block.blocks) q.appendChild(renderBlock(b, doc, issueHref));
      return q;
    }
    case 'list': {
      const list = el(block.ordered ? 'ol' : 'ul');
      for (const item of block.items) {
        const li = el('li');
        if (item.checked !== null) {
          const box = el('input');
          box.setAttribute('type', 'checkbox');
          box.setAttribute('disabled', '');
          if (item.checked) box.setAttribute('checked', '');
          li.appendChild(box);
        }
        const [only] = item.blocks;
        if (item.blocks.length === 1 && only.type === 'paragraph') fill(li, only.inlines, doc, issueHref);
        else for (const b of item.blocks) li.appendChild(renderBlock(b, doc, issueHref));
        list.appendChild(li);
      }
      return list;
    }
    default: throw new Error(`unknown block ${block.type}`);
  }
}

function fill(parent, inlines, doc, issueHref) {
  for (const node of inlines) parent.appendChild(renderInline(node, doc, issueHref));
  return parent;
}

function renderInline(node, doc, issueHref) {
  switch (node.type) {
    case 'text': return doc.createTextNode(node.text);
    case 'code': {
      const code = doc.createElement('code');
      code.textContent = node.text;
      return code;
    }
    case 'strong': case 'em': case 'del': return fill(doc.createElement(node.type), node.inlines, doc, issueHref);
    case 'link': {
      const a = doc.createElement('a');
      a.setAttribute('href', node.href);
      a.setAttribute('rel', 'noopener noreferrer');
      a.setAttribute('target', '_blank');
      return fill(a, node.inlines, doc, issueHref);
    }
    case 'issue': {
      const a = doc.createElement('a');
      a.setAttribute('href', issueHref(node.number));
      a.appendChild(doc.createTextNode(`#${node.number}`));
      return a;
    }
    default: throw new Error(`unknown inline ${node.type}`);
  }
}
