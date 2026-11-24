import { test } from 'node:test';
import assert from 'node:assert/strict';
import { header } from '../src/views/common.js';
import { fakeDocument, text } from './fakedom.js';

const ASK = '## En attente de Ben\n### Q1 — Taille\n- **A.** Trois\n### Q2 — Nom (peut attendre)\n- **A.** Brume\n';
const issue = (number, state, comments) => ({ number, title: 'T', state, labels: [], comments });
const ctxWith = issues => ({ doc: fakeDocument(), home: '#/', listHref: '#/list', decisionsHref: '#/decisions', route: 'synthesis',
  loadedAt: null, refresh() {}, board: issues && { issues, refs: new Map(), warnings: [] } });
const decisionsTab = ctx => ctx.doc.created.find(e => e.tagName === 'A' && /^Décisions/.test(text(e)));

test('the Décisions tab shows how many required questions wait, as the summary does', () => {
  const ctx = ctxWith([
    issue(1, 'OPEN', [{ body: ASK, createdAt: '2026-11-24T10:00:00Z' }]),
    issue(2, 'CLOSED', [{ body: ASK, createdAt: '2026-11-24T10:00:00Z' }]),
  ]);
  header(ctx);
  const tab = decisionsTab(ctx);
  assert.equal(text(tab), 'Décisions1');
  assert.equal(tab.attributes['aria-label'], "Décisions, 1 question t'attend");
  assert.equal(text(ctx.doc.created.find(e => e.attributes.class === 'count')), '1');
});

test('no count on the tab when nothing waits, or before the board is loaded', () => {
  for (const ctx of [ctxWith([issue(1, 'OPEN', [{ body: ASK, createdAt: '2026-11-24T10:00:00Z' }, { body: 'Q1 : A\nQ2 : A', createdAt: '2026-11-24T11:00:00Z' }])]), ctxWith(null)]) {
    header(ctx);
    assert.equal(text(decisionsTab(ctx)), 'Décisions');
    assert.ok(!ctx.doc.created.some(e => e.attributes.class === 'count'));
  }
});
