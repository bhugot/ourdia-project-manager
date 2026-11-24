// The only way the views build DOM: elements, a short list of harmless attributes, text children.
// No event handler, inline style or HTML string can get through.

const ALLOWED = new Set(['class', 'href', 'type', 'disabled', 'checked', 'rel', 'target', 'id', 'for', 'name',
  'autocomplete', 'placeholder', 'inputmode', 'open', 'role', 'spellcheck', 'datetime', 'title', 'value', 'max']);

export function h(doc, tag, attrs, ...children) {
  const el = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (!ALLOWED.has(key) && !key.startsWith('aria-')) throw new Error(`attribute not allowed: ${key}`);
    if (key === 'href' && !/^(#|https:\/\/|http:\/\/)/.test(String(value))) throw new Error(`attribute href not allowed: ${value}`);
    if (value === false || value === null || value === undefined) continue;
    el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(typeof child === 'string' || typeof child === 'number' ? doc.createTextNode(String(child)) : child);
  }
  return el;
}
