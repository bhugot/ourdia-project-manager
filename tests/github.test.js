import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBoard, loadComments, newTokenUrl, normalizeIssue, parseExpiry, AuthError, ApiError } from '../src/github.js';

const TOKEN = 'github_pat_TEST_ONLY_0000';
const node = (number, extra = {}) => ({
  number, title: `Issue ${number}`, body: '', state: 'OPEN', createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-23T10:00:00Z',
  closedAt: null, labels: { nodes: [{ name: 'cloud' }] }, assignees: { nodes: [{ login: 'bhugot' }] },
  parent: null, subIssues: { nodes: [] }, comments: { nodes: [{ body: 'Prise', createdAt: '2026-11-23T09:00:00Z' }] }, ...extra,
});
const board = (over = {}) => ({ data: { repository: {
  open: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [node(5, { body: 'apres: #3\nvoir #9' })] },
  closed: { nodes: [node(4, { state: 'CLOSED', closedAt: '2026-11-23T08:00:00Z' })] },
  ref: { target: { committedDate: '2026-11-23T07:00:00Z' } }, ...over } } });

function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r) throw new Error('unexpected call ' + url);
    return { ok: r.status === undefined || r.status < 300, status: r.status ?? 200,
      headers: { get: k => (r.headers || {})[k.toLowerCase()] ?? null }, json: async () => r.json };
  };
  fn.calls = calls;
  return fn;
}

test('normalizeIssue flattens labels, assignees, comments', () => {
  const i = normalizeIssue(node(5, { parent: { number: 2 }, subIssues: { nodes: [{ number: 7 }] } }), true);
  assert.deepEqual(i.labels, ['cloud']);
  assert.deepEqual(i.assignees, ['bhugot']);
  assert.deepEqual(i.comments, [{ body: 'Prise', createdAt: '2026-11-23T09:00:00Z' }]);
  assert.equal(i.parent, 2);
  assert.deepEqual(i.subIssues, [7]);
  assert.equal(i.commentsComplete, true);
});

test('loadBoard reads the board, the expiry header and cited issues', async () => {
  const f = fakeFetch([
    { json: board(), headers: { 'github-authentication-token-expiration': '2027-01-10 12:00:00 UTC' } },
    { json: { data: { repository: { i3: { number: 3, title: 'Trois', state: 'CLOSED' }, i9: null } } } },
  ]);
  const r = await loadBoard(TOKEN, f);
  assert.deepEqual(r.issues.map(i => [i.number, i.commentsComplete]), [[5, true], [4, false]]);
  assert.equal(r.pilotageDate, '2026-11-23T07:00:00Z');
  assert.equal(r.tokenExpiry, '2027-01-10 12:00:00 UTC');
  assert.equal(r.states.get(3), 'CLOSED');
  assert.equal(r.refs.get(3).title, 'Trois');
  assert.match(f.calls[1].init.body, /i3: issue\(number: 3\)/);
  assert.match(f.calls[1].init.body, /i9: issue\(number: 9\)/);
  assert.doesNotMatch(f.calls[1].init.body, /i5:|i4:/);
  assert.deepEqual(r.warnings, []);
});

test('token only travels in the Authorization header to api.github.com', async () => {
  const f = fakeFetch([{ json: board({ open: { pageInfo: { hasNextPage: false }, nodes: [] } }) }]);
  await loadBoard(TOKEN, f);
  for (const c of f.calls) {
    assert.ok(c.url.startsWith('https://api.github.com/'));
    assert.ok(!c.url.includes(TOKEN));
    assert.ok(!c.init.body.includes(TOKEN));
    assert.equal(c.init.headers.Authorization, `Bearer ${TOKEN}`);
  }
});

test('missing pilotage ref falls back to REST with a warning', async () => {
  const f = fakeFetch([
    { json: { ...board({ ref: null, open: { pageInfo: { hasNextPage: false }, nodes: [] } }), errors: [{ message: 'Resource not accessible', path: ['repository', 'ref'] }] } },
    { json: [{ commit: { committer: { date: '2026-11-23T06:00:00Z' } } }] },
  ]);
  const r = await loadBoard(TOKEN, f);
  assert.equal(r.pilotageDate, '2026-11-23T06:00:00Z');
  assert.equal(f.calls[1].url, 'https://api.github.com/repos/bhugot/ourdia/commits?sha=pilotage&per_page=1');
  assert.equal(r.warnings.length, 1);
});

test('REST fallback failing leaves pilotageDate null', async () => {
  const f = fakeFetch([
    { json: board({ ref: null, open: { pageInfo: { hasNextPage: false }, nodes: [] } }) },
    { status: 403, json: { message: 'no' } },
  ]);
  const r = await loadBoard(TOKEN, f);
  assert.equal(r.pilotageDate, null);
  assert.equal(r.warnings.length, 1);
});

test('sub-issue errors retry without sub-issue fields', async () => {
  const f = fakeFetch([
    { json: { data: null, errors: [{ message: "Field 'subIssues' doesn't exist", path: ['repository', 'open', 'nodes', 0, 'subIssues'] }] } },
    { json: board({ open: { pageInfo: { hasNextPage: false }, nodes: [node(5, { parent: undefined, subIssues: undefined })] } }) },
  ]);
  const r = await loadBoard(TOKEN, f);
  assert.doesNotMatch(f.calls[1].init.body, /subIssues/);
  assert.deepEqual(r.issues[0].subIssues, []);
  assert.equal(r.warnings.length, 1);
});

test('open issues are paginated', async () => {
  const f = fakeFetch([
    { json: board({ open: { pageInfo: { hasNextPage: true, endCursor: 'C1' }, nodes: [node(9)] } }) },
    { json: { data: { repository: { open: { pageInfo: { hasNextPage: false }, nodes: [node(8)] } } } } },
  ]);
  const r = await loadBoard(TOKEN, f);
  assert.deepEqual(r.issues.map(i => i.number), [9, 8, 4]);
  assert.equal(JSON.parse(f.calls[1].init.body).variables.after, 'C1');
});

test('HTTP errors', async () => {
  await assert.rejects(loadBoard(TOKEN, fakeFetch([{ status: 401, json: {} }])), AuthError);
  await assert.rejects(loadBoard(TOKEN, fakeFetch([{ status: 502, json: {} }])), e => e instanceof ApiError && e.status === 502);
  await assert.rejects(loadBoard(TOKEN, fakeFetch([{ json: { errors: [{ message: 'boom' }] } }])), ApiError);
});

test('loadComments reads the comments of one issue', async () => {
  const f = fakeFetch([{ json: { data: { repository: { issue: { comments: { nodes: [{ body: 'a', createdAt: 'x' }] } } } } } }]);
  assert.deepEqual(await loadComments(TOKEN, 4, f), [{ body: 'a', createdAt: 'x' }]);
  assert.deepEqual(JSON.parse(f.calls[0].init.body).variables, { number: 4 });
});

test('parseExpiry', () => {
  assert.equal(parseExpiry('2027-01-10 12:00:00 UTC').toISOString(), '2027-01-10T12:00:00.000Z');
  assert.equal(parseExpiry(null), null);
  assert.equal(parseExpiry('n/a'), null);
});

test('cited issues: out-of-range numbers dropped, apres first, errors warned', async () => {
  const many = Array.from({ length: 120 }, (_, k) => `#${1000 + k}`).join(' ');
  const f = fakeFetch([
    { json: board({ open: { pageInfo: { hasNextPage: false }, nodes: [node(5, { body: `voir ${many} #99999999999` }), node(6, { body: 'apres: #3' })] } }) },
    { json: { data: { repository: { i3: { number: 3, title: 'Trois', state: 'OPEN' } } }, errors: [{ message: 'Could not resolve to an Issue with the number of 1001.' }] } },
  ]);
  const r = await loadBoard(TOKEN, f);
  const q = f.calls[1].init.body;
  assert.match(q, /i3: issue\(number: 3\)/);
  assert.doesNotMatch(q, /99999999999/);
  assert.equal(r.states.get(3), 'OPEN');
  assert.equal(r.warnings.length, 1);
});

test('newTokenUrl pre-fills the fine-grained token form', () => {
  const url = new URL(newTokenUrl());
  assert.equal(url.origin + url.pathname, 'https://github.com/settings/personal-access-tokens/new');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    name: 'Ourdia suivi', description: 'Lecture des issues de bhugot/ourdia pour Ourdia Project Manager',
    target_name: 'bhugot', expires_in: '366', issues: 'read', contents: 'read',
  });
});
