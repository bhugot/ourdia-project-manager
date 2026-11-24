import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../src/synthesis.js';
import { classify } from '../src/classify.js';
import { ASK } from './fixtures.js';

const NOW = new Date('2026-11-23T12:00:00Z');
const ago = ({ hours = 0, minutes = 0 }) => new Date(NOW - (hours * 60 + minutes) * 60000).toISOString();
const c = (body, when) => ({ body, createdAt: ago(when) });
const mk = (number, labels, { assigned = false, body = '', comments = [], closedAt = null } = {}) => ({
  number, title: `Issue ${number}`, body, state: closedAt ? 'CLOSED' : 'OPEN', labels, assignees: assigned ? ['bhugot'] : [],
  createdAt: ago({ hours: 48 }), updatedAt: ago({ minutes: 1 }), closedAt, comments, commentsComplete: true, parent: null, subIssues: [],
});
function run(issues, { since = new Date(ago({ hours: 6 })), pilotageDate = null } = {}) {
  const board = { issues, states: new Map(), refs: new Map(), pilotageDate };
  return summarize(board, classify(issues, { now: NOW, states: board.states, pilotageDate }), { since, now: NOW });
}
const flat = line => line.map(p => (typeof p === 'string' ? p : `#${p.issue}`)).join('');
const lines = r => r.lines.map(flat);

test('nothing at all', () => {
  assert.deepEqual(lines(run([])), ['Rien de nouveau depuis ta dernière visite.']);
});

test('pending questions, answers received, blocked, finished', () => {
  const r = run([
    mk(12, ['attente-ben', 'cloud-plus'], { comments: [c(ASK, { hours: 2 }), c('Q1 : A', { hours: 1 })] }),
    mk(13, ['attente-ben', 'cloud-plus'], { comments: [c(ASK, { hours: 2 }), c('Q1 : A\nQ3 : B', { hours: 1 })] }),
    mk(20, ['cloud'], { assigned: true, comments: [c('point', { hours: 4, minutes: 10 })] }),
    mk(1, [], { closedAt: ago({ hours: 1 }) }),
    mk(2, [], { closedAt: ago({ hours: 10 }) }),
  ]);
  assert.deepEqual(lines(r), [
    "1 question t'attend : #12 (Durée d'un hiver)",
    'Réponses reçues, à relancer : #13 en Opus',
    'Bloquée : #20 depuis 4 h',
    'Finie depuis ta dernière visite : #1',
  ]);
  assert.deepEqual(r.lines[0][1], { issue: 12 });
});

test('several questions, running, queued, idle PC', () => {
  const r = run([
    mk(12, ['attente-ben'], { comments: [c(ASK, { hours: 2 })] }),
    mk(5, ['attente-ben'], { comments: [c('## En attente de Ben : on garde ?', { hours: 2 })] }),
    mk(20, ['cloud'], { assigned: true, comments: [c('point', { minutes: 10 })] }),
    mk(21, ['cloud'], { assigned: true, comments: [c('point', { minutes: 20 })] }),
    mk(30, ['pilotage']), mk(31, ['cloud']),
  ], { pilotageDate: ago({ hours: 3 }) });
  assert.deepEqual(lines(r), [
    "3 questions t'attendent : #12 (Taille des groupes ; Durée d'un hiver), #5 (question libre)",
    'En cours : #21, #20',
    'En file : 2 issues',
    'PC inactif depuis 3 h',
  ]);
});

test('stand-by issues are left out', () => {
  const r = run([mk(12, ['attente-ben', 'stand-by'], { comments: [c(ASK, { hours: 2 })] })]);
  assert.deepEqual(lines(r), ['Rien de nouveau depuis ta dernière visite.']);
  assert.deepEqual(r.reports, []);
});

test('reports: last comment of active and finished issues, fresh after the last visit', () => {
  const r = run([
    mk(20, ['cloud'], { assigned: true, comments: [c('vieux', { hours: 8 }), c('Point : tests verts', { hours: 1 })] }),
    mk(12, ['attente-ben'], { comments: [c(ASK, { hours: 7 })] }),
    mk(30, ['cloud']),
    mk(1, [], { closedAt: ago({ hours: 1 }) }),
  ]);
  assert.deepEqual(r.reports.map(x => [x.number, x.section, x.fresh, x.body.slice(0, 7)]), [
    [12, 'waiting', false, '## En a'], [20, 'running', true, 'Point :'], [1, 'done', true, ''],
  ]);
});

test('a closed stand-by issue is not listed as finished', () => {
  assert.deepEqual(lines(run([mk(1, ['stand-by'], { closedAt: ago({ hours: 1 }) })])), ['Rien de nouveau depuis ta dernière visite.']);
});
