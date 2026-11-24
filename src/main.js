// Entry point: routing by hash, loading, writing, rendering.
import { AuthError, addLabel, loadBoard, loadClosedHistory, loadComments, postComment, removeLabel } from './github.js';
import { parseRoute } from './routes.js';
import { runWrite } from './write.js';
import { summarize } from './synthesis.js';
import { badgeSupport, showCount } from './badge.js';
import { STANDBY_LABEL, classify } from './classify.js';
import { demoBoard, demoHistory } from './demo.js';
import { decisionsView } from './views/decisions.js';
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
let history = null;      // closed issues with all their comments, for the Decisions tab
let historyError = null;
let historyLoading = false;
let decisionFilter = 'answered';

const token = () => localStorage.getItem(TOKEN_KEY);

const route = () => parseRoute(location.hash);

async function load(demo) {
  error = null;
  history = null;
  historyError = null;
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
    const now = new Date();
    const sections = classify(board.issues, { now, states: board.states, pilotageDate: board.pilotageDate });
    showCount(summarize(board, sections, { since, now }).count);
  } catch (e) {
    if (e instanceof AuthError) { authError = true; location.hash = '#/settings'; }
    else error = e;
  } finally {
    loading = false;
  }
}

/** Runs one write; errors become a banner, a refused token sends to the settings. */
async function write(r, demoChange, realWrite) {
  writeError = null;
  const result = await runWrite({ demo: r.demo, demoChange, realWrite: () => realWrite(token()), reload: () => load(false) });
  if (result.auth) { authError = true; location.hash = '#/settings'; return; }
  writeError = result.error;
  render();
}

function context(r) {
  const now = new Date();
  const base = r.demo ? '#/demo' : '#';
  return {
    doc, now, since, board, demo: r.demo, route: r.name, loadedAt, authError, writeError, hasToken: Boolean(token()),
    home: r.demo ? '#/demo' : '#/',
    listHref: `${base}/list`,
    decisionsHref: `${base}/decisions`,
    history, historyError, decisionFilter,
    setDecisionFilter: f => { decisionFilter = f; render(); },
    loadHistory: () => {
      if (historyLoading) return;
      historyLoading = true; // called while rendering: the result always arrives later
      (r.demo ? Promise.resolve(demoHistory(new Date())) : loadClosedHistory(token()))
        .then(list => { history = list; })
        .catch(e => {
          if (e instanceof AuthError) { authError = true; location.hash = '#/settings'; }
          else historyError = e.message;
        })
        .finally(() => { historyLoading = false; render(); });
    },
    issueHref: n => `${base}/issue/${n}`,
    sections: board ? classify(board.issues, { now, states: board.states, pilotageDate: board.pilotageDate }) : null,
    confirm: text => window.confirm(text),
    refresh: async () => { writeError = null; if (r.demo) board = null; await load(r.demo); render(); },
    saveToken: value => { localStorage.setItem(TOKEN_KEY, value); authError = false; board = null; location.hash = '#/'; },
    forgetToken: () => { localStorage.removeItem(TOKEN_KEY); board = null; render(); },
    drafts,
    badge: badgeSupport(window),
    enableBadge: async () => { await Notification.requestPermission(); if (board && !boardIsDemo) await load(false); render(); },
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

const VIEWS = { synthesis: synthesisView, list: listView, decisions: decisionsView };

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
