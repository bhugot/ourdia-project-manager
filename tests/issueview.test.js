import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueView } from '../src/views/issue.js';
import { fakeDocument, text } from './fakedom.js';

test('failed comment load is shown as an error, not as complete', () => {
  const doc = fakeDocument();
  const issue = { number: 4, title: 'T', body: '', state: 'CLOSED', labels: [], assignees: [], comments: [{ body: 'dernier', createdAt: '2026-11-23T10:00:00Z' }],
    commentsComplete: false, commentsError: 'GitHub a répondu 502', parent: null, subIssues: [] };
  let asked = 0;
  const ctx = { doc, now: new Date(), demo: false, home: '#/', loadedAt: null, board: { issues: [issue], refs: new Map(), warnings: [] },
    issueHref: n => `#/issue/${n}`, refresh() {}, loadComments() { asked++; } };
  const out = text(issueView(ctx, 4));
  assert.match(out, /Commentaires illisibles : GitHub a répondu 502/);
  assert.equal(asked, 0);
});

const ASK2 = '## En attente de Ben\n### Q1 — Taille\n- **A.** Trois\n- **B.** Autre (préciser)\n### Q2 — Nom (peut attendre)\n- **A.** Brume\n- **B.** Autre (préciser)\n';
function ctxFor(issue, extra = {}) {
  const doc = fakeDocument();
  return { doc, now: new Date(), demo: false, home: '#/', loadedAt: null, board: { issues: [issue], refs: new Map(), warnings: [] },
    issueHref: n => `#/issue/${n}`, refresh() {}, loadComments() {}, confirm: () => true,
    sendAnswers: async () => {}, setStandby: async () => {}, ...extra };
}
const openIssue = (labels, comments = []) => ({ number: 12, title: 'T', body: '', state: 'OPEN', labels, assignees: [],
  comments, commentsComplete: true, parent: null, subIssues: [] });

test('unanswered questions get letter buttons and a send button', () => {
  const ctx = ctxFor(openIssue(['attente-ben'], [{ body: ASK2, createdAt: '2026-11-23T10:00:00Z' }, { body: 'Q2 : A', createdAt: '2026-11-23T11:00:00Z' }]));
  issueView(ctx, 12);
  const buttons = ctx.doc.created.filter(e => e.tagName === 'BUTTON').map(e => text(e));
  assert.ok(buttons.includes('Envoyer les réponses'));
  assert.deepEqual(buttons.filter(b => /^[A-Z]$/.test(b)), ['A', 'B']); // only Q1, Q2 is answered
});

test('stand-by button toggles its label', () => {
  const labelOf = labels => { const ctx = ctxFor(openIssue(labels)); issueView(ctx, 12); return ctx.doc.created.filter(e => e.tagName === 'BUTTON').map(e => text(e)); };
  assert.ok(labelOf([]).includes('Mettre en stand-by'));
  assert.ok(labelOf(['stand-by']).includes('Reprendre'));
});
