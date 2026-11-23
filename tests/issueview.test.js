import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueView } from '../src/views/issue.js';
import { fakeDocument, text } from './fakedom.js';

test('failed comment load is shown as an error, not as complete', () => {
  const doc = fakeDocument();
  const issue = { number: 4, title: 'T', body: '', state: 'CLOSED', labels: [], assignees: [], comments: [{ body: 'dernier', createdAt: '2026-11-23T10:00:00Z' }],
    commentsComplete: false, commentsError: 'GitHub a répondu 502', parent: null, subIssues: [] };
  let asked = 0;
  const ctx = { doc, now: new Date(), demo: false, home: '#/', loadedAt: null, board: { issues: [issue], refs: new Map(), warnings: [] },
    issueHref: n => `#/issue/${n}`, refresh() {}, loadComments() { asked++; } };
  const out = text(issueView(ctx, 4));
  assert.match(out, /Commentaires illisibles : GitHub a répondu 502/);
  assert.equal(asked, 0);
});
