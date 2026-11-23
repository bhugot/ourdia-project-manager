import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dependencies } from '../src/deps.js';

const mk = (number, body = '', comments = [], extra = {}) => ({ number, title: `T${number}`, body, state: 'OPEN',
  comments: comments.map(b => ({ body: b, createdAt: 'x' })), parent: null, subIssues: [], ...extra });

test('dependencies of an issue', () => {
  const a = mk(57, 'apres: #55, #56\nvoir #57 et #9', ['cf #70'], { parent: 50, subIssues: [58] });
  const b = mk(60, 'apres: #57');
  const c = mk(70, 'lié à #57');
  const refs = new Map([[56, { title: 'T56', state: 'CLOSED' }], [9, { title: 'T9', state: 'OPEN' }], [50, { title: 'T50', state: 'OPEN' }]]);
  const d = dependencies(a, [a, b, c, mk(55)], refs);
  assert.deepEqual(d.after, [{ number: 55, title: 'T55', state: 'OPEN' }, { number: 56, title: 'T56', state: 'CLOSED' }]);
  assert.deepEqual(d.unblocks.map(x => x.number), [60]);
  assert.deepEqual(d.parent, { number: 50, title: 'T50', state: 'OPEN' });
  assert.deepEqual(d.subIssues, [{ number: 58, title: null, state: null }]);
  assert.deepEqual(d.mentions.map(x => x.number), [9, 70]);
  assert.deepEqual(d.mentionedBy.map(x => x.number), [70]);
});
