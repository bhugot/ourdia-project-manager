import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachPreview } from '../src/views/preview.js';
import { renderMarkdown } from '../src/markdown.js';
import { fakeDocument, text } from './fakedom.js';

const issues = [{ number: 12, title: 'Météo', state: 'OPEN', labels: [], body: '', subIssues: [],
  comments: [{ body: 'Point d\'étape : modèle fait.', createdAt: '2026-11-23T09:00:00Z' }] }];

function setup() {
  const doc = fakeDocument();
  const ctx = { doc, board: { issues, refs: new Map() }, sections: { running: [{ number: 12, detail: 'prise' }] }, issueHref: n => `#/issue/${n}` };
  const root = doc.createElement('div');
  attachPreview(ctx, root);
  const link = n => {
    const a = doc.createElement('a');
    a.setAttribute('href', `#/issue/${n}`);
    a.setAttribute('class', 'issue-ref');
    return a;
  };
  const click = async (target) => {
    let prevented = false;
    const event = { type: 'click', target: { closest: sel => (sel === 'a.issue-ref' && target?.attributes?.class === 'issue-ref' ? target : null), ...target },
      preventDefault() { prevented = true; } };
    for (const fn of root.listeners.click) await fn(event);
    return prevented;
  };
  const card = () => root.children.find(c => c.attributes?.class === 'preview');
  return { doc, root, link, click, card, key: async k => { for (const fn of root.listeners.keydown) await fn({ key: k }); } };
}

test('issue links are marked for the preview', () => {
  const doc = fakeDocument();
  renderMarkdown('voir #12', doc, { issueHref: n => `#/issue/${n}` });
  assert.equal(doc.created.find(e => e.tagName === 'A').attributes.class, 'issue-ref');
});

test('first tap shows the card, second tap on the same link navigates', async () => {
  const s = setup();
  const a = s.link(12);
  assert.equal(await s.click(a), true);
  const out = text(s.card());
  assert.match(out, /#12 Météo/);
  assert.match(out, /ouverte/);
  assert.match(out, /En cours/);
  assert.match(out, /Point d'étape : modèle fait\./);
  assert.ok(s.doc.created.some(e => e.tagName === 'A' && e.attributes.href === '#/issue/12' && text(e) === 'Ouvrir'));
  assert.equal(await s.click(a), false);
  assert.equal(s.card(), undefined);
});

test('a link to an issue not loaded navigates directly', async () => {
  const s = setup();
  assert.equal(await s.click(s.link(99)), false);
  assert.equal(s.card(), undefined);
});

test('Escape and a tap elsewhere close the card', async () => {
  const s = setup();
  await s.click(s.link(12));
  await s.key('Escape');
  assert.equal(s.card(), undefined);
  await s.click(s.link(12));
  await s.click({ attributes: {} });
  assert.equal(s.card(), undefined);
});
