import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, renderMarkdown } from '../src/markdown.js';
import { fakeDocument, text } from './fakedom.js';

const one = src => parseMarkdown(src)[0];
const inlinesOf = src => one(src).inlines;
const ALLOWED = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'INPUT', 'PRE', 'CODE', 'BLOCKQUOTE', 'HR',
  'STRONG', 'EM', 'DEL', 'A', 'SPAN']);
const render = src => { const doc = fakeDocument(); const frag = renderMarkdown(src, doc, { issueHref: n => `#/issue/${n}` }); return { doc, frag }; };

test('raw HTML stays text', () => {
  const src = '<script>alert(1)</script> <img src=x onerror=alert(1)>';
  assert.deepEqual(parseMarkdown(src), [{ type: 'paragraph', inlines: [{ type: 'text', text: src }] }]);
  const { doc, frag } = render(src);
  assert.deepEqual(doc.created.map(e => e.tagName), ['P']);
  assert.equal(text(frag), src);
});

test('HTML comments are hidden', () => {
  assert.deepEqual(parseMarkdown('<!-- dernier-signal: x -->\nTexte'), [{ type: 'paragraph', inlines: [{ type: 'text', text: 'Texte' }] }]);
  assert.deepEqual(parseMarkdown('a <!-- b --> c'), [{ type: 'paragraph', inlines: [{ type: 'text', text: 'a  c' }] }]);
});

test('only http(s) links are links', () => {
  for (const src of ['[a](javascript:alert(1))', '[a](data:text/html,x)', '[a](JaVaScript:x)', '[a](//evil.example)']) {
    assert.ok(!JSON.stringify(parseMarkdown(src)).includes('"link"'), src);
  }
  assert.deepEqual(inlinesOf('[a](https://x.y)'), [{ type: 'link', href: 'https://x.y/', inlines: [{ type: 'text', text: 'a' }] }]);
  assert.deepEqual(inlinesOf('voir https://x.y/p'), [{ type: 'text', text: 'voir ' }, { type: 'link', href: 'https://x.y/p', inlines: [{ type: 'text', text: 'https://x.y/p' }] }]);
});

test('images become text links', () => {
  assert.deepEqual(inlinesOf('![img](https://x.y/p.png)'), [{ type: 'link', href: 'https://x.y/p.png', inlines: [{ type: 'text', text: 'img' }] }]);
});

test('task lists', () => {
  const list = one('- [x] a\n- [ ] b\n- c');
  assert.equal(list.type, 'list');
  assert.deepEqual(list.items.map(i => i.checked), [true, false, null]);
  assert.equal(one('1. a\n2. b').ordered, true);
});

test('issue references and emphasis', () => {
  assert.deepEqual(inlinesOf('voir #12'), [{ type: 'text', text: 'voir ' }, { type: 'issue', number: 12 }]);
  assert.deepEqual(inlinesOf('**gras** _it_ ~~barré~~ `code #3`').filter(x => x.type !== 'text').map(x => x.type),
    ['strong', 'em', 'del', 'code']);
});

test('blocks: headings, code, quote, rule, table as text', () => {
  assert.deepEqual(parseMarkdown('## Titre').map(b => [b.type, b.level]), [['heading', 2]]);
  assert.deepEqual(parseMarkdown('```js\n<b>x</b>\n```'), [{ type: 'code', text: '<b>x</b>' }]);
  assert.equal(one('> cité').type, 'quote');
  assert.equal(one('---').type, 'rule');
  assert.deepEqual(parseMarkdown('| a | b |\n|---|---|'), [{ type: 'paragraph', inlines: [{ type: 'text', text: '| a | b |\n|---|---|' }] }]);
});

test('render uses allowed elements and safe attributes only', () => {
  const { doc } = render('# T\n\n- [x] a **b** [l](https://x.y) #4\n\n> q\n\n```\nc\n```\n\n---\n\n1. n');
  for (const el of doc.created) assert.ok(ALLOWED.has(el.tagName), el.tagName);
  const input = doc.created.find(e => e.tagName === 'INPUT');
  assert.deepEqual(input.attributes, { type: 'checkbox', disabled: '', checked: '' });
  const [ext, internal] = doc.created.filter(e => e.tagName === 'A');
  assert.deepEqual(ext.attributes, { href: 'https://x.y/', rel: 'noopener noreferrer', target: '_blank' });
  assert.deepEqual(internal.attributes, { href: '#/issue/4', class: 'issue-ref' });
  for (const el of doc.created) for (const k of Object.keys(el.attributes)) assert.ok(!/^on|style/i.test(k));
});
