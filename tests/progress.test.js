import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressOf } from '../src/progress.js';

const c = (body, createdAt = '2026-11-23T10:00:00Z') => ({ body, createdAt });
const base = { number: 20, title: 'T', state: 'OPEN', labels: [], comments: [], subIssues: [], body: '' };

test('goal is the first prose paragraph, without headers or headings', () => {
  const p = progressOf({ ...base, body: 'voie: serveur\napres: #3\n\n## À faire\n1. x\n\nGénérer la météo\npar région.\n\n## Fini quand\n- [x] a\n- [ ] b' }, {});
  assert.equal(p.goal, 'Générer la météo par région.');
  assert.deepEqual([p.finished.done, p.finished.total], [1, 2]);
  const p2 = progressOf({ ...base, body: 'voie: design\nProposer le rythme.\n' }, {});
  assert.equal(p2.goal, 'Proposer le rythme.');
  assert.equal(progressOf({ ...base, body: 'x'.repeat(300) }, {}).goal.length, 200);
  assert.equal(progressOf(base, {}).goal, null);
});

test('sub-issues counted from loaded issues and cited refs, unknown otherwise', () => {
  const issues = [{ number: 21, title: 'A', state: 'CLOSED' }, { number: 22, title: 'B', state: 'OPEN' }];
  const refs = new Map([[23, { title: 'C', state: 'CLOSED' }]]);
  const p = progressOf({ ...base, subIssues: [21, 22, 23, 24] }, { issues, refs });
  assert.deepEqual([p.sub.done, p.sub.total], [2, 4]);
  assert.deepEqual(p.sub.items.map(i => [i.number, i.state]), [[21, 'CLOSED'], [22, 'OPEN'], [23, 'CLOSED'], [24, null]]);
  assert.equal(progressOf(base, {}).sub, null);
});

test('last progress note skips asks and Ben\'s answers', () => {
  const p = progressOf({ ...base, comments: [
    c('Prise par Sonnet', '2026-11-23T08:00:00Z'), c('### Point d\'étape\n\nModèle fait, reste le branchement.', '2026-11-23T09:00:00Z'),
    c('## En attente de Ben\n### Q1 — x', '2026-11-23T10:00:00Z'), c('## Réponses de Ben\n\nQ1 : A', '2026-11-23T11:00:00Z'), c('q1 : b', '2026-11-23T12:00:00Z'),
  ] }, {});
  assert.deepEqual(p.lastNote, { createdAt: '2026-11-23T09:00:00Z', line: "Point d'étape" });
  assert.equal(progressOf(base, {}).lastNote, null);
});

test('status is the section the board puts the issue in', () => {
  const sections = { waiting: [], running: [{ number: 20, detail: 'prise par Sonnet' }] };
  assert.deepEqual(progressOf(base, { sections }).status, { title: 'En cours', detail: 'prise par Sonnet' });
  assert.equal(progressOf(base, {}).status, null);
});
