// Entry point: routing by hash, loading, writing, rendering.
import { AuthError, WriteError, addLabel, loadBoard, loadComments, postComment, removeLabel } from './github.js';
import { STANDBY_LABEL, classify } from './classify.js';
import { demoBoard } from './demo.js';
import { h } from './dom.js';
import { listView } from './views/list.js';
import { issueView } from './views/issue.js';
import { settingsView } from './views/settings.js';
import { synthesisView } from './views/synthesis.js';
import { sinceFrom } from './visit.js';

const TOKEN_KEY = 'opm.token';
const VISIT_KEY = 'opm.lastVisit';
const doc = document;
const app = doc.getElementById('app');

// The previous visit is read once when the app opens and stays fixed while it is open; it is
// only replaced once a real (non-demo) summary has been shown.
const since = sinceFrom(localStorage.getItem(VISIT_KEY), Date.now());
const openedAt = Date.now();
let visitRecorded = false;
const drafts = new Map(); // answers being typed, per issue, kept across re-renders

let board = null;       // last loaded board (real or demo)
let boardIsDemo = false;
let loadedAt = null;
let loading = false;
let error = null;
let authError = false;
let writeError = null;

const token = () => localStorage.getItem(TOKEN_KEY);

function route() {
  const hash = location.hash || '#/';
  if (hash === '#/settings') return { name: 'settings', demo: false };
  const demo = hash.startsWith('#/demo');
  const path = (demo ? hash.slice('#/demo'.length) : hash.slice(1)) || '/';
  const issue = path.match(/^\/issue\/(\d+)$/);
  if (issue) return { name: 'issue', number: Number(issue[1]), demo };
  return { name: path === '/list' ? 'list' : 'synthesis', demo };
}

async function load(demo) {
  error = null;
  if (demo) {
    if (!boardIsDemo || !board) board = demoBoard(new Date());
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

/** Runs one write, then reloads; errors become a banner (or the settings screen on 401). */
async function write(r, demoChange, realWrite) {
  writeError = null;
  if (r.demo) {
    demoChange();
  } else {
    try {
      await realWrite(token());
    } catch (e) {
      if (e instanceof AuthError) { authError = true; location.hash = '#/settings'; return; }
      writeError = e instanceof WriteError ? `${e.message} (GitHub a répondu ${e.status}).` : `Envoi impossible : ${e.message}`;
      render();
      return;
    }
    await load(false);
  }
  render();
}

function context(r) {
  const now = new Date();
  const base = r.demo ? '#/demo' : '#';
  return {
    doc, now, since, board, demo: r.demo, route: r.name, loadedAt, authError, writeError, hasToken: Boolean(token()),
    home: r.demo ? '#/demo' : '#/',
    listHref: `${base}/list`,
    issueHref: n => `${base}/issue/${n}`,
    sections: board ? classify(board.issues, { now, states: board.states, pilotageDate: board.pilotageDate }) : null,
    confirm: text => window.confirm(text),
    refresh: async () => { writeError = null; if (r.demo) board = null; await load(r.demo); render(); },
    saveToken: value => { localStorage.setItem(TOKEN_KEY, value); authError = false; board = null; location.hash = '#/'; },
    forgetToken: () => { localStorage.removeItem(TOKEN_KEY); board = null; render(); },
    drafts,
    sendAnswers: (issue, body) => write(r,
      () => issue.comments.push({ body, createdAt: new Date().toISOString() }),
      t => postComment(t, issue.number, body)).then(() => { if (!writeError) drafts.delete(issue.number); }),
    setStandby: (issue, on) => write(r,
      () => { issue.labels = on ? [...issue.labels, STANDBY_LABEL] : issue.labels.filter(l => l !== STANDBY_LABEL); },
      t => (on ? addLabel(t, issue.number, STANDBY_LABEL) : removeLabel(t, issue.number, STANDBY_LABEL))),
    loadComments: issue => {
      if (r.demo || issue.loading) return;
      issue.loading = true;
      loadComments(token(), issue.number)
        .then(comments => { issue.comments = comments; issue.commentsComplete = true; })
        .catch(e => {
          if (e instanceof AuthError) { authError = true; location.hash = '#/settings'; }
          else issue.commentsError = e.message;
        })
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

const VIEWS = { synthesis: synthesisView, list: listView };

function render() {
  const r = route();
  let view;
  if (r.name === 'settings') view = settingsView(context(r));
  else if (loading) view = message('Chargement…');
  else if (error) view = message(`GitHub ne répond pas : ${error.message}`, async () => { await load(false); render(); });
  else if (!board) view = message('Chargement…');
  else view = r.name === 'issue' ? issueView(context(r), r.number) : VIEWS[r.name](context(r));
  app.replaceChildren(view);
  if (r.name === 'synthesis' && !r.demo && board && !boardIsDemo && !visitRecorded) {
    localStorage.setItem(VISIT_KEY, String(openedAt));
    visitRecorded = true;
  }
}

async function navigate() {
  const r = route();
  writeError = null;
  if (r.name !== 'settings') {
    if (!r.demo && !token()) { location.hash = '#/settings'; return; }
    if (!board || boardIsDemo !== r.demo) await load(r.demo);
  }
  render();
  if (r.name !== 'issue') window.scrollTo(0, 0);
}

window.addEventListener('hashchange', navigate);
navigate();
