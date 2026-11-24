import { test } from 'node:test';
import assert from 'node:assert/strict';
import { header } from '../src/views/common.js';
import { fakeDocument, text } from './fakedom.js';

// The count itself is summarize().count (tests/synthesis.test.js), computed once in main.js.
const ctxWith = waiting => ({ doc: fakeDocument(), home: '#/', listHref: '#/list', decisionsHref: '#/decisions', route: 'synthesis',
  loadedAt: null, refresh() {}, waiting });
const decisionsTab = ctx => ctx.doc.created.find(e => e.tagName === 'A' && /^Décisions/.test(text(e)));

test('the Décisions tab shows how many questions wait for Ben', () => {
  for (const [n, label] of [[1, "Décisions, 1 question t'attend"], [3, "Décisions, 3 questions t'attendent"]]) {
    const ctx = ctxWith(n);
    header(ctx);
    const tab = decisionsTab(ctx);
    assert.equal(text(tab), `Décisions${n}`);
    assert.equal(tab.attributes['aria-label'], label);
    assert.equal(text(ctx.doc.created.find(e => e.attributes.class === 'tab-badge')), String(n));
  }
});

test('no count on the tab when nothing waits, or before the board is loaded', () => {
  for (const ctx of [ctxWith(0), ctxWith(undefined)]) {
    header(ctx);
    assert.equal(text(decisionsTab(ctx)), 'Décisions');
    assert.ok(!ctx.doc.created.some(e => e.attributes.class === 'tab-badge'));
  }
});
