import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAnswers } from '../src/answers.js';
import { parseAnswers } from '../src/questions.js';

test('formatAnswers writes one Q line per filled question', () => {
  assert.equal(formatAnswers([{ n: 1, letter: 'A', note: '' }, { n: 2, letter: null, note: '  ' }, { n: 3, letter: 'B', note: 'trois saisons' }]),
    '## Réponses de Ben\n\nQ1 : A\nQ3 : B — trois saisons\n');
  assert.equal(formatAnswers([{ n: 2, letter: null, note: 'on en reparle' }]), '## Réponses de Ben\n\nQ2 : on en reparle\n');
  assert.equal(formatAnswers([{ n: 1, letter: null, note: '' }]), null);
  assert.equal(formatAnswers([]), null);
});

test('a note cannot forge another answer line', () => {
  const body = formatAnswers([{ n: 1, letter: 'A', note: 'oui\nQ2 : B\r\nq3: C' }]);
  assert.deepEqual([...parseAnswers(body)], [[1, 'A — oui Q2 : B q3: C']]);
});

test('round trip through parseAnswers', () => {
  const entries = [{ n: 4, letter: 'C', note: '' }, { n: 7, letter: 'A', note: 'Brumeval, pas Brume' }];
  assert.deepEqual([...parseAnswers(formatAnswers(entries))], [[4, 'C'], [7, 'A — Brumeval, pas Brume']]);
});

test('a comma before Q<n> : in a note cannot split into a second answer', () => {
  const body = formatAnswers([{ n: 1, letter: 'A', note: 'oui, Q2 : B; q3: C' }]);
  assert.deepEqual([...parseAnswers(body)].map(([n]) => n), [1]);
});
