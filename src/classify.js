// Sorting issues into the sections of the dashboard. Port of tools/automation/dashboard.py and
// common.py (bhugot/ourdia): the same rules, so the app and issue #43 agree. Deliberate
// differences: every `apres:` line is read, and open issues without an execution label go to `other`.
import { questionStatus } from './questions.js';
import { parseAfter, sessionLinks, short } from './parse.js';

export const OWNER = 'bhugot';
export const CLOUD_LABELS = ['cloud', 'cloud-plus', 'cloud-fort']; // weakest to strongest
export const MODELS = { cloud: 'Sonnet', 'cloud-plus': 'Opus', 'cloud-fort': 'Fable' };
export const TAKEN_LABEL = 'en-cours';
export const BOARD_LABEL = 'tableau-de-bord';
export const STANDBY_LABEL = 'stand-by';
export const SECTIONS = [
  ['waiting', 'À trancher'], ['blocked', 'Bloqué'], ['running', 'En cours'],
  ['queued', 'En file'], ['done', 'Fini depuis 24 h'], ['other', 'Autres'], ['standby', 'En stand-by'],
];

const HOUR = 3600 * 1000;
const BLOCKED_AFTER = 3 * HOUR;
const PC_IDLE_AFTER = 2 * HOUR;
const DONE_WINDOW = 24 * HOUR;
const DONE_LIMIT = 10;
const ANSWERED = 'réponses reçues';

export const strongestCloud = labels => [...CLOUD_LABELS].reverse().find(l => labels.includes(l)) || null;
export const isTaken = issue => issue.assignees.includes(OWNER) || issue.labels.includes(TAKEN_LABEL);
const lastComment = issue => issue.comments.at(-1) || null;

function card(issue, detail) {
  return { number: issue.number, title: issue.title, detail, sessions: sessionLinks(issue.comments) };
}

function waitingDetail(issue) {
  const status = questionStatus(issue.comments);
  if (status === null) { // free-form ask, without `### Q<n>` questions
    const last = lastComment(issue);
    if (!last) return 'question en attente';
    const text = last.body.replace('## En attente de Ben', '').replace('En attente de Ben', '');
    return short(text.replace(/^[ :—\-\n]+|[ :—\-\n]+$/g, ''));
  }
  if (!status.pending.length && !status.answers.size) { // only optional questions, none answered
    return short(status.questions.map(q => `Q${q.n} ${q.title}`).join(' ; ')) + ' (facultatives)';
  }
  if (!status.pending.length) {
    const label = strongestCloud(issue.labels);
    const where = label ? ` en ${MODELS[label]}` : issue.labels.includes('pilotage') ? ' (pilotage)' : '';
    return `${ANSWERED}, à relancer${where}`;
  }
  const titles = new Map(status.questions.map(q => [q.n, q.title]));
  const detail = short(status.pending.map(n => `Q${n} ${titles.get(n)}`).join(' ; '));
  const answered = status.answers.size;
  return detail + (answered ? ` (${answered}/${status.questions.length} répondues)` : '');
}

/**
 * Sections of the board. `states` gives the state of issues cited but not loaded;
 * `pilotageDate` is the date of the last commit of the `pilotage` branch (or null).
 */
export function classify(issues, { now, states, pilotageDate }) {
  const out = Object.fromEntries(SECTIONS.map(([key]) => [key, []]));
  const loaded = new Map(issues.map(i => [i.number, i]));
  const stateOf = n => loaded.get(n)?.state || states.get(n) || null;
  let pilotQueued = false;

  const open = issues.filter(i => i.state === 'OPEN' && !i.labels.includes(BOARD_LABEL))
    .sort((a, b) => b.number - a.number);
  for (const issue of open) {
    const labels = issue.labels;
    if (labels.includes(STANDBY_LABEL)) {
      out.standby.push(card(issue, ''));
      continue;
    }
    if (labels.includes('attente-ben')) {
      out.waiting.push(card(issue, waitingDetail(issue)));
      continue;
    }
    const cloud = strongestCloud(labels);
    const execLabel = cloud || (labels.includes('pilotage') ? 'pilotage' : null);
    const queueLabel = execLabel || "sans label d'exécution";
    const last = lastComment(issue);
    const picked = Boolean(last && last.body.trimStart().startsWith("Prise par l'exécutant"));
    if (isTaken(issue) || (cloud && picked)) {
      const ref = new Date(last ? last.createdAt : issue.updatedAt);
      if (now - ref > BLOCKED_AFTER) out.blocked.push(card(issue, `${queueLabel}, sans nouvelle depuis plus de 3 h`));
      else out.running.push(card(issue, queueLabel));
    } else if (execLabel) {
      const waiting = parseAfter(issue.body).filter(n => stateOf(n) === 'OPEN');
      if (labels.includes('pilotage')) pilotQueued = true;
      out.queued.push(card(issue, execLabel + (waiting.length ? ', attend ' + waiting.map(n => `#${n}`).join(', ') : '')));
    } else {
      out.other.push(card(issue, ''));
    }
  }

  out.done = issues
    .filter(i => i.state === 'CLOSED' && i.closedAt && now - new Date(i.closedAt) < DONE_WINDOW)
    .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt))
    .slice(0, DONE_LIMIT)
    .map(i => card(i, lastComment(i) ? short(lastComment(i).body) : 'fermée'));

  const idle = Boolean(pilotageDate && pilotQueued && now - new Date(pilotageDate) > PC_IDLE_AFTER);
  out.pc = { date: pilotageDate, idle };
  return out;
}
