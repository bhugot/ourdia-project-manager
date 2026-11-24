// « Où en est-on » at the top of an issue: goal, Fini quand, sub-issues, last progress note, status.
import { finishedWhen, short } from './parse.js';
import { isAsk, parseAnswers } from './questions.js';
import { SECTIONS } from './classify.js';

const HEADER_LINE_RE = /^\s*[a-z_-]+:\s/i;       // voie: serveur, apres: #3
const NOT_PROSE_RE = /^\s*(#|[-*+]\s|\d+[.)]\s|```|~~~|>|\|)/;
const GOAL_LIMIT = 200;
const NOTE_LIMIT = 140;

function goalOf(body) {
  for (const chunk of (body || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').filter(l => l.trim() && !HEADER_LINE_RE.test(l));
    if (!lines.length || NOT_PROSE_RE.test(lines[0])) continue;
    return short(lines.join(' '), GOAL_LIMIT);
  }
  return null;
}

const isBenAnswer = body => body.trimStart().startsWith('## Réponses de Ben') || parseAnswers(body).size > 0;

function lastNoteOf(comments) {
  const note = [...comments].reverse().find(c => c.body.trim() && !isAsk(c.body) && !isBenAnswer(c.body));
  if (!note) return null;
  const first = note.body.split('\n').map(l => l.replace(/^\s*#+\s*/, '').trim()).find(Boolean);
  return { createdAt: note.createdAt, line: short(first, NOTE_LIMIT) };
}

function subOf(issue, issues, refs) {
  if (!issue.subIssues?.length) return null;
  const items = issue.subIssues.map(n => {
    const known = issues.find(i => i.number === n) || refs.get(n);
    return { number: n, title: known?.title ?? null, state: known?.state ?? null };
  });
  return { items, done: items.filter(i => i.state === 'CLOSED').length, total: items.length };
}

function statusOf(number, sections) {
  for (const [key, title] of SECTIONS) {
    const card = (sections[key] || []).find(c => c.number === number);
    if (card) return { title, detail: card.detail || '' };
  }
  return null;
}

/** {goal, finished, sub, lastNote, status}; each is null when there is nothing to show. */
export function progressOf(issue, { issues = [], refs = new Map(), sections = null } = {}) {
  const finished = finishedWhen(issue.body);
  return {
    goal: goalOf(issue.body),
    finished: finished && finished.items.length ? finished : null,
    sub: subOf(issue, issues, refs),
    lastNote: lastNoteOf(issue.comments || []),
    status: sections ? statusOf(issue.number, sections) : null,
  };
}
