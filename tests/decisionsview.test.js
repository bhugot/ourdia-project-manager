import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decisionsView } from '../src/views/decisions.js';
import { fakeDocument, fire, text } from './fakedom.js';

const ASK = '## En attente de Ben\n### Q1 — Taille\n- **A.** Trois (recommandé)\n- **B.** Autre (préciser)\n### Q2 — Nom\n- **A.** Brume\n';
const c = (body, createdAt) => ({ body, createdAt });
const open = { number: 5, title: 'Ouverte', state: 'OPEN', labels: [], comments: [c(ASK, '2026-11-22T10:00:00Z'), c('Q1 : A', '2026-11-22T11:00:00Z')] };
const closedShort = { number: 4, title: 'Fermée', state: 'CLOSED', labels: [], comments: [c('Fini.', '2026-11-21T12:00:00Z')] };
const closedFull = { ...closedShort, comments: [c(ASK, '2026-11-21T09:00:00Z'), c('Q1 : B — quatre\nQ2 : A', '2026-11-21T10:00:00Z'), c('Fini.', '2026-11-21T12:00:00Z')] };

function ctxFor(extra = {}) {
  const doc = fakeDocument();
  const calls = { history: 0, filter: [] };
  const ctx = { doc, now: new Date('2026-11-24T10:00:00Z'), demo: false, home: '#/', listHref: '#/list', decisionsHref: '#/decisions', route: 'decisions',
    loadedAt: null, board: { issues: [open, closedShort], warnings: [] }, issueHref: n => `#/issue/${n}`, refresh() {},
    history: null, historyError: null, decisionFilter: 'answered',
    loadHistory() { calls.history++; }, setDecisionFilter(f) { calls.filter.push(f); }, ...extra };
  return { ctx, calls };
}

test('asks for the closed history while it is not loaded', () => {
  const { ctx, calls } = ctxFor();
  const out = text(decisionsView(ctx));
  assert.equal(calls.history, 1);
  assert.match(out, /Chargement des issues fermées/);
  assert.match(out, /A\. Trois/);
});

test('answered decisions use the full closed history, newest first', () => {
  const { ctx, calls } = ctxFor({ history: [closedFull] });
  const view = decisionsView(ctx);
  assert.equal(calls.history, 0);
  const lines = ctx.doc.created.filter(e => e.attributes.class === 'decision').map(text);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /#5.*Taille.*A\. Trois/);
  assert.match(lines[1], /#4.*Taille.*B\. Autre \(préciser\) — quatre/);
  assert.match(text(view), /Décisions des 50 dernières issues fermées/);
});

test('the filter shows pending questions and switches', async () => {
  const { ctx, calls } = ctxFor({ history: [closedFull], decisionFilter: 'pending' });
  decisionsView(ctx);
  const lines = ctx.doc.created.filter(e => e.attributes.class === 'decision pending').map(text);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /#5.*Nom.*sans réponse/);
  const answeredButton = ctx.doc.created.find(e => e.tagName === 'BUTTON' && text(e) === 'Répondues');
  await fire(answeredButton, 'click');
  assert.deepEqual(calls.filter, ['answered']);
});

test('a history error is shown and open issues still listed', () => {
  const { ctx } = ctxFor({ historyError: 'GitHub a répondu 502' });
  const out = text(decisionsView(ctx));
  assert.match(out, /Issues fermées illisibles : GitHub a répondu 502/);
  assert.match(out, /A\. Trois/);
});
