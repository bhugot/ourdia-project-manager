import { test } from 'node:test';
import assert from 'node:assert/strict';
import { h } from '../src/dom.js';
import { fakeDocument, text } from './fakedom.js';

test('h builds elements with text children', () => {
  const doc = fakeDocument();
  const el = h(doc, 'a', { href: '#/issue/3', class: 'card', 'aria-label': 'x' }, 'Issue ', h(doc, 'strong', null, '#3'), null, false);
  assert.equal(el.tagName, 'A');
  assert.deepEqual(el.attributes, { href: '#/issue/3', class: 'card', 'aria-label': 'x' });
  assert.equal(el.children[0].nodeType, 3);
  assert.equal(text(el), 'Issue #3');
});

test('h refuses event handlers, inline style and HTML properties', () => {
  const doc = fakeDocument();
  for (const bad of ['onclick', 'style', 'innerHTML', 'srcdoc', 'src']) {
    assert.throws(() => h(doc, 'div', { [bad]: 'x' }), /attribute/, bad);
  }
});

test('h skips false attributes and sets true ones empty', () => {
  const doc = fakeDocument();
  const el = h(doc, 'input', { type: 'checkbox', disabled: true, checked: false });
  assert.deepEqual(el.attributes, { type: 'checkbox', disabled: '' });
});
