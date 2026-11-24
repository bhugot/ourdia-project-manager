// Decisions tab: Ben's answers over every series of every issue, or the questions still open.
import { h } from '../dom.js';
import { allDecisions } from '../decisions.js';
import { dayTime } from '../format.js';
import { banners, header } from './common.js';

const HISTORY_SIZE = 50;

/** Open issues from the board, closed ones from the full history when it is loaded. */
function issuesFor(ctx) {
  const byNumber = new Map(ctx.board.issues.map(i => [i.number, i]));
  for (const i of ctx.history || []) {
    if (i.state !== 'OPEN' || !byNumber.has(i.number)) byNumber.set(i.number, i);
  }
  return [...byNumber.values()];
}

function line(ctx, d) {
  const { doc } = ctx;
  const pending = d.answer === null;
  return h(doc, 'li', { class: pending ? 'decision pending' : 'decision' },
    h(doc, 'p', { class: 'decision-head' },
      h(doc, 'a', { href: ctx.issueHref(d.issue) }, `#${d.issue}`), ` Q${d.n} — ${d.question}`,
      d.optional ? h(doc, 'span', { class: 'muted' }, ' (peut attendre)') : null),
    h(doc, 'p', { class: 'decision-answer' }, pending ? 'sans réponse' : d.answerText),
    h(doc, 'p', { class: 'decision-meta muted' }, `${pending ? 'posée' : 'répondue'} le ${dayTime(pending ? d.askedAt : d.answeredAt)} · ${d.title}`));
}

export function decisionsView(ctx) {
  const { doc } = ctx;
  if (!ctx.history && !ctx.historyError) ctx.loadHistory();
  const { answered, pending } = allDecisions(issuesFor(ctx));
  const filter = ctx.decisionFilter === 'pending' ? 'pending' : 'answered';
  const list = filter === 'pending' ? pending : answered;
  const button = (key, label, count) => {
    const b = h(doc, 'button', { type: 'button', class: 'filter', 'aria-pressed': String(filter === key) }, label);
    b.addEventListener('click', () => ctx.setDecisionFilter(key));
    return [b, h(doc, 'span', { class: 'count' }, count)];
  };
  let status;
  if (ctx.historyError) status = h(doc, 'p', { class: 'banner warn' }, `Issues fermées illisibles : ${ctx.historyError}`);
  else if (!ctx.history) status = h(doc, 'p', { class: 'muted' }, 'Chargement des issues fermées…');
  else status = h(doc, 'p', { class: 'muted' }, `Décisions des ${HISTORY_SIZE} dernières issues fermées et de toutes les issues ouvertes.`);
  return h(doc, 'div', { class: 'view view-decisions' },
    header(ctx),
    banners(ctx),
    h(doc, 'div', { class: 'filters', role: 'group', 'aria-label': 'Filtre' },
      button('answered', 'Répondues', answered.length), button('pending', 'Sans réponse', pending.length)),
    status,
    list.length ? h(doc, 'ul', { class: 'decisions' }, list.map(d => line(ctx, d)))
      : h(doc, 'p', { class: 'empty' }, filter === 'pending' ? 'aucune question ouverte' : 'aucune décision'));
}
