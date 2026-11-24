import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allDecisions, answerText, decisionsOf } from '../src/decisions.js';

const ASK_A = '## En attente de Ben\n### Q1 — Taille\n- **A.** Trois (recommandé)\n- **B.** Autre (préciser)\n### Q2 — Nom\n- **A.** Brume\n- **B.** Autre (préciser)\n';
const ASK_B = '## En attente de Ben\n### Q1 — Taille, reposée\n- **A.** Quatre\n- **B.** Autre (préciser)\n### Q3 — Hiver (peut attendre)\n- **A.** Court\n';
const c = (body, createdAt) => ({ body, createdAt });
const issue = (number, comments) => ({ number, title: `Issue ${number}`, comments });

test('answerText replaces a known letter by its option', () => {
  const q = { options: [{ letter: 'A', label: 'Trois' }, { letter: 'B', label: 'Autre (préciser)' }] };
  assert.equal(answerText(q, 'A'), 'A. Trois');
  assert.equal(answerText(q, 'a — pas plus'), 'A. Trois — pas plus');
  assert.equal(answerText(q, 'Z'), 'Z');
  assert.equal(answerText(q, 'je préfère en reparler'), 'je préfère en reparler');
});

test('decisionsOf ties each answer to its own series', () => {
  const d = decisionsOf(issue(7, [
    c(ASK_A, '2026-11-20T10:00:00Z'), c('Q1 : A\nQ2 : B — Brumeval', '2026-11-20T12:00:00Z'),
    c(ASK_B, '2026-11-21T10:00:00Z'), c('## Réponses de Ben\n\nQ1 : A', '2026-11-21T11:00:00Z'),
  ]));
  assert.deepEqual(d.map(x => [x.n, x.question, x.answerText, x.answeredAt]), [
    [1, 'Taille', 'A. Trois', '2026-11-20T12:00:00Z'],
    [2, 'Nom', 'B. Autre (préciser) — Brumeval', '2026-11-20T12:00:00Z'],
    [1, 'Taille, reposée', 'A. Quatre', '2026-11-21T11:00:00Z'],
    [3, 'Hiver', null, null],
  ]);
  assert.equal(d[3].optional, true);
  assert.equal(d[0].issue, 7);
});

test('the last answer to a question wins', () => {
  const d = decisionsOf(issue(7, [c(ASK_A, '2026-11-20T10:00:00Z'), c('Q1 : A', '2026-11-20T11:00:00Z'), c('Q1 : B', '2026-11-20T12:00:00Z')]));
  assert.equal(d[0].answerText, 'B. Autre (préciser)');
  assert.equal(d[0].answeredAt, '2026-11-20T12:00:00Z');
});

test('allDecisions: answered newest first, then pending with required first', () => {
  const all = allDecisions([
    issue(1, [c(ASK_A, '2026-11-20T10:00:00Z'), c('Q2 : A', '2026-11-20T11:00:00Z')]),
    issue(2, [c(ASK_B, '2026-11-21T10:00:00Z'), c('Q1 : A', '2026-11-22T10:00:00Z')]),
  ]);
  assert.deepEqual(all.answered.map(x => `${x.issue}-${x.n}`), ['2-1', '1-2']);
  assert.deepEqual(all.pending.map(x => `${x.issue}-${x.n}`), ['1-1', '2-3']);
});
