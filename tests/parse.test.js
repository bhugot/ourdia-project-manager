import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAfter, sessionLinks, mentions, finishedWhen, short } from '../src/parse.js';

test('parseAfter reads every apres line', () => {
  assert.deepEqual(parseAfter('voie: design\napres: #55, #56\napres: #60\n'), [55, 56, 60]);
  assert.deepEqual(parseAfter('apres: #5\n  apres: #5, #6'), [5, 6]);
  assert.deepEqual(parseAfter('rien'), []);
  assert.deepEqual(parseAfter(null), []);
});

test('sessionLinks skips struck comments and duplicates', () => {
  assert.deepEqual(sessionLinks([
    { body: 'Prise — session : https://claude.ai/code/session_A1' },
    { body: '~~https://claude.ai/code/session_B2~~' },
    { body: 'encore https://claude.ai/code/session_A1 et https://claude.ai/code/session_C3' },
  ]), ['https://claude.ai/code/session_A1', 'https://claude.ai/code/session_C3']);
});

test('mentions ignore code blocks and apres lines', () => {
  assert.deepEqual(mentions('voir #12 et #7\n```\n#99\n```\napres: #5\nencore #12'), [12, 7]);
  assert.deepEqual(mentions('`#8` puis a#9 puis (#10)'), [10]);
});

test('finishedWhen counts checkboxes of the section', () => {
  assert.deepEqual(finishedWhen('## Fini quand\n- [x] a\n- [ ] b\n- c\n## Suite\n- [ ] d'),
    { items: [{ text: 'a', done: true }, { text: 'b', done: false }, { text: 'c', done: null }], done: 1, total: 2 });
  assert.deepEqual(finishedWhen('## Fini quand\n- [X] a\n'), { items: [{ text: 'a', done: true }], done: 1, total: 1 });
  assert.equal(finishedWhen('pas de section'), null);
});

test('short collapses spaces and cuts with an ellipsis', () => {
  assert.equal(short('a'.repeat(100)).length, 90);
  assert.equal(short('a'.repeat(100)).at(-1), '…');
  assert.equal(short('  a \n b  '), 'a b');
  assert.equal(short('abcdef', 4), 'abc…');
});

test('parseAfter is case-sensitive like common.py', () => {
  assert.deepEqual(parseAfter('Apres: #5\nAPRES: #6\napres: #7'), [7]);
});
