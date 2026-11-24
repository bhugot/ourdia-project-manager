import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLong, lead, outline } from '../src/reading.js';
import { renderMarkdown } from '../src/markdown.js';
import { fakeDocument } from './fakedom.js';

const REPORT = '## Compte rendu\n\nTout est **fait**, voir #12.\n\n### Fait\n- a\n\n```\n## pas un titre\n```\n\n### Reste\n- b\n\nUn.\n\nDeux.';

test('isLong: more than 5 blocks or more than 1200 characters', () => {
  assert.equal(isLong('Un.\n\nDeux.'), false);
  assert.equal(isLong(REPORT), true);
  assert.equal(isLong('x'.repeat(1201)), true);
  assert.equal(isLong(''), false);
});

test('lead is the first paragraph as plain text', () => {
  assert.equal(lead(REPORT), 'Tout est fait, voir #12.');
  assert.equal(lead('### Titre seul'), null);
});

test('outline lists ## and ### headings, not those inside code', () => {
  assert.deepEqual(outline(REPORT), [{ level: 2, text: 'Compte rendu', index: 0 }, { level: 3, text: 'Fait', index: 1 }, { level: 3, text: 'Reste', index: 2 }]);
});

test('renderMarkdown gives headings ids when asked', () => {
  const doc = fakeDocument();
  renderMarkdown(REPORT, doc, { issueHref: n => `#/issue/${n}`, headingIds: 'c3' });
  const ids = doc.created.filter(e => /^H\d$/.test(e.tagName)).map(e => e.attributes.id);
  assert.deepEqual(ids, ['c3-0', 'c3-1', 'c3-2']);
  const plain = fakeDocument();
  renderMarkdown(REPORT, plain, { issueHref: n => `#/issue/${n}` });
  assert.ok(plain.created.filter(e => /^H\d$/.test(e.tagName)).every(e => !('id' in e.attributes)));
});
