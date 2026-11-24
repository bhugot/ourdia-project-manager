// The opening summary: a few computed sentences on what changed since the last visit, then the
// last report written by each active or recently finished issue's session. No model involved.
import { questionStatus } from './questions.js';
import { STANDBY_LABEL } from './classify.js';

const HOUR = 3600 * 1000;
const REPORT_SECTIONS = ['waiting', 'blocked', 'running', 'done'];

const plural = (n, one, many) => (n > 1 ? many : one);
const hoursSince = (now, date) => Math.floor((now - new Date(date)) / HOUR);

/** Chunks of one sentence: `prefix`, then the issues separated by `, ` with an optional suffix each. */
function sentence(prefix, items, suffix = '') {
  const out = [prefix];
  items.forEach(({ issue, after }, i) => {
    if (i) out.push(', ');
    out.push({ issue });
    if (after) out.push(after);
  });
  if (suffix) out.push(suffix);
  return out;
}

/**
 * {lines, reports}. Each line is an array of strings and {issue: n} links; reports are the last
 * comment of every issue in À trancher, Bloqué, En cours and Fini, `fresh` when newer than `since`.
 */
export function summarize(board, sections, { since, now }) {
  const byNumber = new Map(board.issues.map(i => [i.number, i]));
  const lines = [];

  let count = 0;
  const asking = [];
  const answered = [];
  for (const card of sections.waiting) {
    const status = questionStatus(byNumber.get(card.number).comments);
    if (status === null) {
      count += 1;
      asking.push({ issue: card.number, after: ' (question libre)' });
    } else if (status.pending.length) {
      count += status.pending.length;
      const titles = new Map(status.questions.map(q => [q.n, q.title]));
      asking.push({ issue: card.number, after: ` (${status.pending.map(n => titles.get(n)).join(' ; ')})` });
    } else if (status.answers.size) {
      const where = card.detail.replace('réponses reçues, à relancer', '').trim();
      answered.push({ issue: card.number, after: where ? ` ${where}` : '' });
    }
  }
  if (asking.length) lines.push(sentence(`${count} ${plural(count, "question t'attend", "questions t'attendent")} : `, asking));
  if (answered.length) lines.push(sentence('Réponses reçues, à relancer : ', answered));

  if (sections.blocked.length) {
    lines.push(sentence(`${plural(sections.blocked.length, 'Bloquée', 'Bloquées')} : `, sections.blocked.map(card => {
      const issue = byNumber.get(card.number);
      const ref = issue.comments.at(-1)?.createdAt || issue.updatedAt;
      return { issue: card.number, after: ` depuis ${hoursSince(now, ref)} h` };
    })));
  }

  const finished = board.issues
    .filter(i => i.state === 'CLOSED' && i.closedAt && new Date(i.closedAt) > since
      && !i.labels.includes('tableau-de-bord') && !i.labels.includes(STANDBY_LABEL))
    .sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
  if (finished.length) {
    lines.push(sentence(`${plural(finished.length, 'Finie', 'Finies')} depuis ta dernière visite : `, finished.map(i => ({ issue: i.number }))));
  }

  if (!lines.length) lines.push(['Rien de nouveau depuis ta dernière visite.']);
  if (sections.running.length) lines.push(sentence('En cours : ', sections.running.map(card => ({ issue: card.number }))));
  if (sections.queued.length) {
    const n = sections.queued.length;
    lines.push([`En file : ${n} ${plural(n, 'issue', 'issues')}`]);
  }
  if (sections.pc.idle) lines.push([`PC inactif depuis ${hoursSince(now, sections.pc.date)} h`]);

  const reports = REPORT_SECTIONS.flatMap(section => sections[section]
    .filter(card => !byNumber.get(card.number).labels.includes(STANDBY_LABEL)).map(card => {
    const issue = byNumber.get(card.number);
    const last = issue.comments.at(-1);
    const when = last?.createdAt || issue.closedAt || issue.updatedAt;
    return { number: card.number, title: card.title, section, when, body: last?.body || '', fresh: new Date(when) > since };
  }));
  return { lines, reports };
}
