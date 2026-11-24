import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from '../src/routes.js';

test('routes', () => {
  assert.deepEqual(parseRoute(''), { name: 'synthesis', demo: false });
  assert.deepEqual(parseRoute('#/'), { name: 'synthesis', demo: false });
  assert.deepEqual(parseRoute('#/list'), { name: 'list', demo: false });
  assert.deepEqual(parseRoute('#/issue/57'), { name: 'issue', number: 57, demo: false });
  assert.deepEqual(parseRoute('#/settings'), { name: 'settings', demo: false });
  assert.deepEqual(parseRoute('#/demo'), { name: 'synthesis', demo: true });
  assert.deepEqual(parseRoute('#/demo/list'), { name: 'list', demo: true });
  assert.deepEqual(parseRoute('#/demo/issue/112'), { name: 'issue', number: 112, demo: true });
  assert.deepEqual(parseRoute('#/nimporte'), { name: 'synthesis', demo: false });
});
