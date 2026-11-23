// Detail page of one issue: questions, progress, sessions, dependencies, body, progress notes.
import { h } from '../dom.js';
import { renderMarkdown } from '../markdown.js';
import { questionStatus } from '../questions.js';
import { finishedWhen, sessionLinks } from '../parse.js';
import { dependencies } from '../deps.js';
import { dayTime } from '../format.js';
import { banners, header } from './common.js';

const GITHUB_ISSUE = n => `https://github.com/bhugot/ourdia/issues/${n}`;
const stateText = s => (s === 'OPEN' ? 'ouverte' : s === 'CLOSED' ? 'fermée' : 'état inconnu');

function block(doc, title, ...content) {
  return h(doc, 'section', { class: 'block' }, h(doc, 'h2', null, title), ...content);
}

function questions(ctx, issue) {
  const { doc } = ctx;
  const status = questionStatus(issue.comments);
  if (!status) return null;
  return block(doc, 'Questions', h(doc, 'ol', { class: 'questions' }, status.questions.map(q => {
    const answer = status.answers.get(q.n);
    return h(doc, 'li', { class: answer ? 'question answered' : 'question' },
      h(doc, 'p', { class: 'q-title' }, `Q${q.n} — ${q.title}`, q.optional ? h(doc, 'span', { class: 'muted' }, ' (peut attendre)') : null),
      q.options.length ? h(doc, 'ul', { class: 'options' }, q.options.map(o => h(doc, 'li', null, h(doc, 'strong', null, `${o.letter}. `), o.text))) : null,
      h(doc, 'p', { class: 'answer' }, answer ? `Réponse : ${answer}` : 'sans réponse'));
  })));
}

function progress(ctx, issue) {
  const { doc } = ctx;
  const fw = finishedWhen(issue.body);
  if (!fw || !fw.items.length) return null;
  return block(doc, fw.total ? `Fini quand — ${fw.done}/${fw.total}` : 'Fini quand',
    h(doc, 'ul', { class: 'finished' }, fw.items.map(item => h(doc, 'li', null,
      item.done === null ? null : h(doc, 'input', { type: 'checkbox', disabled: true, checked: item.done }), ` ${item.text}`))));
}

function sessions(ctx, issue) {
  const { doc } = ctx;
  const links = sessionLinks(issue.comments).reverse();
  if (!links.length) return null;
  return block(doc, 'Sessions', h(doc, 'ul', { class: 'sessions' }, links.map((url, i) => h(doc, 'li', null,
    h(doc, 'a', { href: url, rel: 'noopener noreferrer', target: '_blank' },
      `${i === 0 ? 'Dernière session' : 'Session'} ${url.slice(-8)} ↗`)))));
}

function deps(ctx, issue) {
  const { doc } = ctx;
  const d = dependencies(issue, ctx.board.issues, ctx.board.refs);
  const groups = [['Attend', d.after], ['Débloque', d.unblocks], ['Parent', d.parent ? [d.parent] : []],
    ['Sous-issues', d.subIssues], ['Mentionne', d.mentions], ['Mentionnée dans', d.mentionedBy]].filter(([, l]) => l.length);
  if (!groups.length) return null;
  return block(doc, 'Dépendances', h(doc, 'dl', { class: 'deps' }, groups.flatMap(([title, list]) => [
    h(doc, 'dt', null, title),
    ...list.map(r => h(doc, 'dd', { class: r.state === 'OPEN' ? 'open' : 'closed' },
      h(doc, 'a', { href: ctx.issueHref(r.number) }, `#${r.number}`), r.title ? ` ${r.title}` : '', ` — ${stateText(r.state)}`)),
  ])));
}

function notes(ctx, issue) {
  const { doc } = ctx;
  if (!issue.commentsComplete) {
    ctx.loadComments(issue);
    return block(doc, 'Points d\'étape', h(doc, 'p', { class: 'muted' }, 'chargement…'));
  }
  if (!issue.comments.length) return block(doc, 'Points d\'étape', h(doc, 'p', { class: 'muted' }, 'aucun commentaire'));
  return block(doc, `Points d'étape (${issue.comments.length})`, [...issue.comments].reverse().map(c =>
    h(doc, 'article', { class: 'note' }, h(doc, 'p', { class: 'when' }, dayTime(c.createdAt)),
      h(doc, 'div', { class: 'md' }, renderMarkdown(c.body, doc, { issueHref: ctx.issueHref })))));
}

export function issueView(ctx, number) {
  const { doc } = ctx;
  const issue = ctx.board.issues.find(i => i.number === number);
  if (!issue) {
    return h(doc, 'div', { class: 'view view-issue' }, header(ctx, { back: true }),
      h(doc, 'p', null, `L'issue #${number} n'est pas dans la liste chargée (ouvertes et fermées récentes). `,
        h(doc, 'a', { href: GITHUB_ISSUE(number), rel: 'noopener noreferrer', target: '_blank' }, 'Ouvrir dans GitHub ↗')));
  }
  return h(doc, 'div', { class: 'view view-issue' },
    header(ctx, { back: true }),
    banners(ctx),
    h(doc, 'h1', { class: 'issue-title' }, h(doc, 'span', { class: 'num' }, `#${issue.number} `), issue.title),
    h(doc, 'p', { class: 'meta' },
      h(doc, 'span', { class: `state ${issue.state === 'OPEN' ? 'open' : 'closed'}` }, stateText(issue.state)),
      issue.labels.map(l => h(doc, 'span', { class: 'label' }, l)),
      issue.assignees.length ? h(doc, 'span', { class: 'muted' }, ` prise par ${issue.assignees.join(', ')}`) : null),
    h(doc, 'p', null, h(doc, 'a', { href: GITHUB_ISSUE(issue.number), rel: 'noopener noreferrer', target: '_blank' }, 'Ouvrir dans GitHub ↗')),
    questions(ctx, issue),
    progress(ctx, issue),
    sessions(ctx, issue),
    deps(ctx, issue),
    block(doc, 'Description', h(doc, 'div', { class: 'md' }, renderMarkdown(issue.body, doc, { issueHref: ctx.issueHref }))),
    notes(ctx, issue));
}
