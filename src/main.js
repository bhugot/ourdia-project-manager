// Entry point: routing by hash, loading, rendering.
import { AuthError, loadBoard, loadComments } from './github.js';
import { classify } from './classify.js';
import { demoBoard } from './demo.js';
import { h } from './dom.js';
import { listView } from './views/list.js';
import { issueView } from './views/issue.js';
import { settingsView } from './views/settings.js';

const TOKEN_KEY = 'opm.token';
const doc = document;
const app = doc.getElementById('app');

let board = null;       // last loaded board (real or demo)
let boardIsDemo = false;
let loadedAt = null;
let loading = false;
let error = null;
let authError = false;

const token = () => localStorage.getItem(TOKEN_KEY);

function route() {
  const hash = location.hash || '#/';
  const demo = hash.startsWith('#/demo');
  const path = demo ? hash.slice('#/demo'.length) || '/' : hash.slice(1);
  const issue = path.match(/^\/issue\/(\d+)$/);
  if (path === '/settings' || hash === '#/settings') return { name: 'settings', demo: false };
  return { name: issue ? 'issue' : 'list', number: issue ? Number(issue[1]) : null, demo };
}

async function load(demo) {
  error = null;
  if (demo) {
    board = demoBoard(new Date());
    boardIsDemo = true;
    loadedAt = new Date();
    return;
  }
  loading = true;
  render();
  try {
    board = await loadBoard(token());
    boardIsDemo = false;
    loadedAt = new Date();
    authError = false;
  } catch (e) {
    if (e instanceof AuthError) { authError = true; location.hash = '#/settings'; }
    else error = e;
  } finally {
    loading = false;
  }
}

function context(r) {
  const now = new Date();
  const base = r.demo ? '#/demo' : '#';
  return {
    doc, now, board, demo: r.demo, loadedAt, authError, hasToken: Boolean(token()),
    home: r.demo ? '#/demo' : '#/',
    issueHref: n => `${base}/issue/${n}`,
    sections: board ? classify(board.issues, { now, states: board.states, pilotageDate: board.pilotageDate }) : null,
    refresh: async () => { await load(r.demo); render(); },
    saveToken: value => { localStorage.setItem(TOKEN_KEY, value); authError = false; board = null; location.hash = '#/'; },
    forgetToken: () => { localStorage.removeItem(TOKEN_KEY); board = null; render(); },
    loadComments: issue => {
      if (r.demo || issue.loading) return;
      issue.loading = true;
      loadComments(token(), issue.number)
        .then(comments => { issue.comments = comments; issue.commentsComplete = true; })
        .catch(() => { issue.commentsComplete = true; })
        .finally(() => { issue.loading = false; render(); });
    },
  };
}

function message(text, retry) {
  const box = h(doc, 'div', { class: 'view view-message' }, h(doc, 'h1', null, 'Ourdia'), h(doc, 'p', null, text));
  if (retry) {
    const b = h(doc, 'button', { type: 'button', class: 'primary' }, 'Réessayer');
    b.addEventListener('click', retry);
    box.appendChild(b);
    box.appendChild(h(doc, 'p', null, h(doc, 'a', { href: '#/settings' }, 'Réglages')));
  }
  return box;
}

function render() {
  const r = route();
  let view;
  if (r.name === 'settings') view = settingsView(context(r));
  else if (loading) view = message('Chargement…');
  else if (error) view = message(`GitHub ne répond pas : ${error.message}`, async () => { await load(false); render(); });
  else if (!board) view = message('Chargement…');
  else view = r.name === 'issue' ? issueView(context(r), r.number) : listView(context(r));
  app.replaceChildren(view);
}

async function navigate() {
  const r = route();
  if (r.name !== 'settings') {
    if (!r.demo && !token()) { location.hash = '#/settings'; return; }
    if (!board || boardIsDemo !== r.demo) await load(r.demo);
  }
  render();
  if (r.name === 'list') window.scrollTo(0, 0);
}

window.addEventListener('hashchange', navigate);
navigate();
