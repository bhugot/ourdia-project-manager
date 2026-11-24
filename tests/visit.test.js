import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sinceFrom } from '../src/visit.js';

const NOW = Date.parse('2026-11-24T12:00:00Z');
test('first visit: since 24 h', () => {
  assert.equal(sinceFrom(null, NOW).toISOString(), '2026-11-23T12:00:00.000Z');
  assert.equal(sinceFrom('abc', NOW).toISOString(), '2026-11-23T12:00:00.000Z');
});
test('previous visit kept, unless older than 30 days', () => {
  assert.equal(sinceFrom(String(NOW - 3600e3), NOW).toISOString(), '2026-11-24T11:00:00.000Z');
  assert.equal(sinceFrom(String(NOW - 40 * 86400e3), NOW).toISOString(), '2026-11-23T12:00:00.000Z');
});
