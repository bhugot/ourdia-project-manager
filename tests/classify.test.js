import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, SECTIONS } from '../src/classify.js';
import { ASK } from './fixtures.js';

const NOW = new Date('2026-11-23T12:00:00Z');
const ago = ({ hours = 0, minutes = 0 }) => new Date(NOW - (hours * 60 + minutes) * 60000).toISOString();
const c = (body, when) => ({ body, createdAt: ago(when) });

function mk(number, labels, { assigned = false, body = '', comments = [], updatedAt, closedAt = null } = {}) {
  return {
    number, title: `Issue ${number}`, body, state: closedAt ? 'CLOSED' : 'OPEN', labels,
    assignees: assigned ? ['bhugot'] : [], createdAt: ago({ hours: 48 }), updatedAt: updatedAt || ago({ minutes: 1 }),
    closedAt, comments, commentsComplete: !closedAt, parent: null, subIssues: [],
  };
}
const run = (issues, opts = {}) => classify(issues, { now: NOW, states: new Map(), pilotageDate: null, ...opts });
const detailOf = (cards, n) => cards.find(x => x.number === n)?.detail;

test('SECTIONS order and titles', () => {
  assert.deepEqual(SECTIONS.map(s => s[0]), ['waiting', 'blocked', 'running', 'queued', 'done', 'other', 'standby']);
});

test('waiting lists pending questions, then answers received', () => {
  const issue = mk(12, ['attente-ben', 'cloud-plus'], { comments: [c(ASK, { hours: 2 }), c('Q1 : A', { hours: 1 })] });
  assert.equal(detailOf(run([issue]).waiting, 12), "Q3 Durée d'un hiver (1/3 répondues)");
  issue.comments.push(c('Q3 : A', { minutes: 10 }));
  const r = run([issue]);
  assert.equal(detailOf(r.waiting, 12), 'réponses reçues, à relancer en Opus');
  assert.equal(r.queued.length, 0);
});

test('waiting with only optional questions unanswered', () => {
  const ask = '## En attente de Ben\n### Q1 — Nom du village (peut attendre)\n- **A.** Brume\n';
  assert.equal(detailOf(run([mk(12, ['attente-ben', 'cloud'], { comments: [c(ask, { hours: 1 })] })]).waiting, 12),
    'Q1 Nom du village (facultatives)');
});

test('waiting relaunch label: pilotage or none', () => {
  const comments = [c('## En attente de Ben\n### Q1 — Taille\n- **A.** x', { hours: 2 }), c('Q1 : A', { hours: 1 })];
  assert.equal(detailOf(run([mk(1, ['attente-ben', 'pilotage'], { comments })]).waiting, 1), 'réponses reçues, à relancer (pilotage)');
  assert.equal(detailOf(run([mk(1, ['attente-ben'], { comments })]).waiting, 1), 'réponses reçues, à relancer');
});

test('waiting free-form ask shows the start of the last comment', () => {
  assert.equal(detailOf(run([mk(1, ['attente-ben'], { comments: [c('## En attente de Ben : quelle taille ?', { hours: 1 })] })]).waiting, 1),
    'quelle taille ?');
  assert.equal(detailOf(run([mk(2, ['attente-ben'])]).waiting, 2), 'question en attente');
});

test('running and blocked', () => {
  assert.equal(run([mk(20, ['cloud'], { assigned: true, comments: [c('point', { hours: 1 })] })]).running[0].number, 20);
  assert.equal(detailOf(run([mk(20, ['cloud'], { assigned: true, comments: [c('point', { hours: 4 })] })]).blocked, 20),
    'cloud, sans nouvelle depuis plus de 3 h');
  assert.equal(detailOf(run([mk(21, [], { assigned: true, updatedAt: ago({ hours: 5 }) })]).blocked, 21),
    "sans label d'exécution, sans nouvelle depuis plus de 3 h");
  assert.equal(run([mk(22, ['en-cours', 'pilotage'], { comments: [c('x', { minutes: 5 })] })]).running[0].detail, 'pilotage');
});

test('cloud issue picked by the executor counts as running', () => {
  const r = run([mk(30, ['cloud'], { comments: [c("Prise par l'exécutant cloud", { minutes: 10 })] })]);
  assert.equal(r.running[0].number, 30);
});

test('queued lists open dependencies from every apres line', () => {
  const r = run([mk(57, ['cloud-plus', 'cloud'], { body: 'apres: #55, #56\napres: #60' }), mk(55, ['pilotage'])],
    { states: new Map([[56, 'CLOSED'], [60, 'OPEN']]) });
  assert.equal(detailOf(r.queued, 57), 'cloud-plus, attend #55, #60');
  assert.equal(detailOf(r.queued, 55), 'pilotage');
});

test('board excluded, unlabelled issues go to other', () => {
  const r = run([mk(43, ['tableau-de-bord']), mk(70, ['zone:client'])]);
  for (const [key] of SECTIONS) assert.ok(!r[key].some(x => x.number === 43));
  assert.deepEqual(r.other.map(x => x.number), [70]);
});

test('done: closed in the last 24 h, most recent first, last comment as detail', () => {
  const r = run([
    mk(1, [], { closedAt: ago({ hours: 2 }), comments: [c('Fini : tout   vert', { hours: 2 })] }),
    mk(2, [], { closedAt: ago({ hours: 1 }) }),
    mk(3, [], { closedAt: ago({ hours: 30 }) }),
  ]);
  assert.deepEqual(r.done.map(x => [x.number, x.detail]), [[2, 'fermée'], [1, 'Fini : tout vert']]);
});

test('done keeps 10 at most', () => {
  const issues = Array.from({ length: 12 }, (_, i) => mk(i + 1, [], { closedAt: ago({ minutes: i + 1 }) }));
  assert.equal(run(issues).done.length, 10);
});

test('pc idle when pilotage queued and last commit older than 2 h', () => {
  const issues = [mk(48, ['pilotage'])];
  assert.deepEqual(run(issues, { pilotageDate: ago({ hours: 3 }) }).pc, { date: ago({ hours: 3 }), idle: true });
  assert.equal(run(issues, { pilotageDate: ago({ hours: 1 }) }).pc.idle, false);
  assert.equal(run([], { pilotageDate: ago({ hours: 3 }) }).pc.idle, false);
});

test('cards carry session links, oldest first', () => {
  const r = run([mk(20, ['cloud'], { assigned: true, comments: [c('Prise — session : https://claude.ai/code/session_X1', { minutes: 5 })] })]);
  assert.deepEqual(r.running[0].sessions, ['https://claude.ai/code/session_X1']);
});

test('stand-by issues go only to the standby section', () => {
  const r = run([
    mk(12, ['attente-ben', 'stand-by'], { comments: [c(ASK, { hours: 2 })] }),
    mk(20, ['cloud', 'stand-by'], { assigned: true, comments: [c('x', { minutes: 5 })] }),
  ]);
  assert.deepEqual(r.standby.map(x => [x.number, x.detail]), [[20, ''], [12, '']]);
  for (const [key] of SECTIONS) if (key !== 'standby') assert.equal(r[key].length, 0, key);
});
