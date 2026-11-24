// Minimal document for tests: records every element and attribute, no HTML parsing at all.
export function fakeDocument() {
  const created = [];
  const node = (props) => ({ ...props, children: [], appendChild(child) { this.children.push(child); return child; },
    removeChild(child) { this.children = this.children.filter(c => c !== child); return child; },
    append(...kids) { for (const k of kids) this.children.push(typeof k === 'string' ? doc.createTextNode(k) : k); } });
  const doc = {
    created,
    createElement(tag) {
      const el = node({ nodeType: 1, tagName: tag.toUpperCase(), attributes: {} });
      el.setAttribute = (k, v) => { el.attributes[k] = String(v); };
      el.listeners = {};
      el.addEventListener = (type, fn) => { (el.listeners[type] ||= []).push(fn); };
      Object.defineProperty(el, 'textContent', { get: () => text(el), set: v => { el.children = [doc.createTextNode(v)]; } });
      created.push(el);
      return el;
    },
    createTextNode(data) { return { nodeType: 3, data: String(data) }; },
    createDocumentFragment() { return node({ nodeType: 11 }); },
  };
  return doc;
}
export function text(n) { return n.nodeType === 3 ? n.data : n.children.map(text).join(''); }

/** Runs the listeners of one event, like a user action would. */
export async function fire(el, type) { for (const fn of el.listeners[type] || []) await fn({ target: el }); }
