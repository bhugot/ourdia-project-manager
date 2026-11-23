import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAsk, parseQuestions, parseAnswers, questionStatus } from '../src/questions.js';
import { ASK } from './fixtures.js';

const triples = qs => qs.map(q => [q.n, q.title, q.optional]);

test('parseQuestions reads numbers, titles, optional flag and options', () => {
  assert.deepEqual(triples(parseQuestions(ASK)),
    [[1, 'Taille des groupes', false], [2, 'Nom du village', true], [3, "Durée d'un hiver", false]]);
  assert.deepEqual(parseQuestions(ASK)[2].options,
    [{ letter: 'A', text: '3 jours' }, { letter: 'B', text: 'Autre (préciser)' }]);
  assert.deepEqual(parseQuestions(ASK)[0].options[0], { letter: 'A', text: 'Trois (recommandé)' });
  assert.deepEqual(triples(parseQuestions('### q1 Taille\n### Q2 — Nom (Peut attendre).\n')),
    [[1, 'Taille', false], [2, 'Nom', true]]);
});

test('parseAnswers tolerates phone typing', () => {
  assert.deepEqual([...parseAnswers('Q1 : B — trois, pas plus\n- **Q3**: A\nrien\n')], [[1, 'B — trois, pas plus'], [3, 'A']]);
  assert.deepEqual([...parseAnswers('q1 : b\nQ2 :\nQ3: A\n')], [[1, 'b'], [3, 'A']]);
  assert.deepEqual([...parseAnswers('Q1 :\nB')], []);
  assert.deepEqual([...parseAnswers('Q1 : A, Q2 : B — libre, oui ; q3: C')], [[1, 'A'], [2, 'B — libre, oui'], [3, 'C']]);
  assert.deepEqual([...parseAnswers('Q1 ： A')], [[1, 'A']]);
});

test('isAsk only when the comment starts with the heading', () => {
  assert.equal(isAsk('  ## En attente de Ben\n### Q1 — x'), true);
  assert.equal(isAsk('Remontée vers Opus.\n## En attente de Ben'), false);
});

test('questionStatus counts answers after the last ask only', () => {
  assert.equal(questionStatus([{ body: "Prise par l'exécutant cloud" }]), null);
  assert.equal(questionStatus([{ body: '## En attente de Ben\nTexte libre ?' }]), null);
  const c = [{ body: 'Q1 : A' }, { body: ASK }, { body: 'Q1 : B\nQ9 : A' }];
  const s = questionStatus(c);
  assert.deepEqual([...s.answers], [[1, 'B']]);
  assert.deepEqual(s.pending, [3]);
  c.push({ body: 'Q3 : A' });
  assert.deepEqual(questionStatus(c).pending, []);
});
