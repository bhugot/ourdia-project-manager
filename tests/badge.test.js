import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showCount } from '../src/badge.js';

function fakeEnv(withBadge) {
  const calls = [];
  const nav = withBadge ? { setAppBadge: async n => calls.push(['set', n]), clearAppBadge: async () => calls.push(['clear']) } : {};
  return { calls, doc: { title: 'Ourdia — suivi' }, nav };
}

test('badge and title show the count, cleared at zero', async () => {
  const env = fakeEnv(true);
  await showCount(3, env.doc, env.nav);
  assert.equal(env.doc.title, '(3) Ourdia — suivi');
  await showCount(0, env.doc, env.nav);
  assert.equal(env.doc.title, 'Ourdia — suivi');
  assert.deepEqual(env.calls, [['set', 3], ['clear']]);
});

test('without the Badging API only the title changes', async () => {
  const env = fakeEnv(false);
  await showCount(2, env.doc, env.nav);
  assert.equal(env.doc.title, '(2) Ourdia — suivi');
});

test('a refused badge does not break the page', async () => {
  const nav = { setAppBadge: async () => { throw new Error('NotAllowedError'); }, clearAppBadge: async () => {} };
  const doc = { title: 'Ourdia — suivi' };
  await showCount(1, doc, nav);
  assert.equal(doc.title, '(1) Ourdia — suivi');
});
