// Detail page of one issue: questions, progress, sessions, dependencies, body, progress notes.
import { h } from '../dom.js';
import { renderMarkdown } from '../markdown.js';
import { questionStatus } from '../questions.js';
import { sessionLinks, short } from '../parse.js';
import { isLong, lead, outline } from '../reading.js';
import { progressOf } from '../progress.js';
import { dependencies } from '../deps.js';
import { dayTime } from '../format.js';
import { banners, header } from './common.js';
import { formatAnswers } from '../answers.js';
import { answerText } from '../decisions.js';
import { STANDBY_LABEL } from '../classify.js';

const GITHUB_ISSUE = n => `https://github.com/bhugot/ourdia/issues/${n}`;
const stateText = s => (s === 'OPEN' ? 'ouverte' : s === 'CLOSED' ? 'fermée' : 'état inconnu');

function block(doc, title, ...content) {
  return h(doc, 'section', { class: 'block' }, h(doc, 'h2', null, title), ...content);
}

/** Letter buttons and a note field for one unanswered question; `entry` holds the choice. */
function answerInputs(ctx, q, entry, onChange) {
  const { doc } = ctx;
  const buttons = q.options.map(o => {
    const b = h(doc, 'button', { type: 'button', class: 'letter', 'aria-pressed': String(entry.letter === o.letter),
      'aria-label': `${o.letter}. ${o.label}${o.recommended ? ' (recommandée)' : ''}` }, o.recommended ? `★ ${o.letter}` : o.letter);
    b.addEventListener('click', () => {
      entry.letter = entry.letter === o.letter ? null : o.letter;
      sync();
      onChange();
    });
    return b;
  });
  const sync = () => { for (const [i, b] of buttons.entries()) b.setAttribute('aria-pressed', String(q.options[i].letter === entry.letter)); };
  const note = h(doc, 'input', { type: 'text', class: 'note-input', placeholder: 'commentaire (facultatif)', 'aria-label': `Commentaire pour Q${q.n}` });
  note.value = entry.note;
  note.addEventListener('input', () => { entry.note = note.value; onChange(); });
  return { el: h(doc, 'div', { class: 'answer-form' }, buttons.length ? h(doc, 'div', { class: 'letters' }, buttons) : null, note), sync };
}

function optionItem(doc, o) {
  return h(doc, 'li', { class: o.recommended ? 'option recommended' : 'option' },
    h(doc, 'strong', null, `${o.letter}. `), o.label, o.recommended ? h(doc, 'span', { class: 'rec-tag' }, ' recommandée') : null);
}

function questions(ctx, issue) {
  const { doc } = ctx;
  const status = questionStatus(issue.comments);
  if (!status) return null;
  const canAnswer = issue.state === 'OPEN';
  // Kept by main.js across re-renders, so a failed send does not lose what Ben typed.
  if (!ctx.drafts.has(issue.number)) ctx.drafts.set(issue.number, new Map());
  const draft = ctx.drafts.get(issue.number);
  const entries = [];
  const followable = []; // [entry, recommended letter, sync] of unanswered questions with a recommendation
  const send = h(doc, 'button', { type: 'button', class: 'primary', disabled: true }, 'Envoyer les réponses');
  const refreshSend = () => { send.disabled = !formatAnswers(entries); };
  send.addEventListener('click', async () => {
    if (send.disabled) return; // a second tap while the first one is being sent
    const body = formatAnswers(entries);
    if (!body || !ctx.confirm(`Poster ce commentaire sur #${issue.number} ?

${body}`)) return;
    send.disabled = true;
    send.textContent = 'Envoi…';
    await ctx.sendAnswers(issue, body);
  });
  const items = status.questions.map(q => {
    const answer = status.answers.get(q.n);
    let form = null;
    if (!answer && canAnswer) {
      if (!draft.has(q.n)) draft.set(q.n, { n: q.n, letter: null, note: '' });
      const entry = draft.get(q.n);
      entries.push(entry);
      const inputs = answerInputs(ctx, q, entry, refreshSend);
      form = inputs.el;
      const rec = q.options.find(o => o.recommended);
      if (rec) followable.push([entry, rec.letter, inputs.sync]);
    }
    return h(doc, 'li', { class: answer ? 'question answered' : 'question' },
      h(doc, 'p', { class: 'q-title' }, `Q${q.n} — ${q.title}`, q.optional ? h(doc, 'span', { class: 'optional-tag' }, 'peut attendre') : null),
      answer ? null : (q.context ? h(doc, 'div', { class: 'md q-context' }, renderMarkdown(q.context, doc, { issueHref: ctx.issueHref })) : null),
      answer ? null : (q.options.length ? h(doc, 'ul', { class: 'options' }, q.options.map(o => optionItem(doc, o))) : null),
      h(doc, 'p', { class: 'answer' }, answer ? `Réponse : ${answerText(q, answer)}` : 'sans réponse'),
      form);
  });
  refreshSend();
  let follow = null;
  if (followable.length) {
    follow = h(doc, 'button', { type: 'button' }, 'Suivre les recommandations');
    follow.addEventListener('click', () => {
      for (const [entry, letter, sync] of followable) { entry.letter = letter; sync(); }
      refreshSend();
    });
  }
  return block(doc, 'Questions',
    follow ? h(doc, 'div', { class: 'actions follow' }, follow, h(doc, 'span', { class: 'muted' }, 'coche, sans envoyer')) : null,
    h(doc, 'ol', { class: 'questions' }, items),
    entries.length ? h(doc, 'div', { class: 'actions' }, send) : null);
}

function actions(ctx, issue) {
  const { doc } = ctx;
  const github = h(doc, 'a', { href: GITHUB_ISSUE(issue.number), rel: 'noopener noreferrer', target: '_blank' }, 'Ouvrir dans GitHub ↗');
  if (issue.state !== 'OPEN') return h(doc, 'p', null, github);
  const paused = issue.labels.includes(STANDBY_LABEL);
  const toggle = h(doc, 'button', { type: 'button' }, paused ? 'Reprendre' : 'Mettre en stand-by');
  toggle.addEventListener('click', async () => {
    const question = paused ? `Reprendre #${issue.number} (retirer le label stand-by) ?` : `Mettre #${issue.number} en stand-by ?`;
    if (!ctx.confirm(question)) return;
    toggle.disabled = true;
    await ctx.setStandby(issue, !paused);
  });
  return h(doc, 'div', { class: 'actions issue-actions' }, toggle, github);
}

function row(doc, label, ...content) {
  return [h(doc, 'dt', null, label), h(doc, 'dd', null, ...content)];
}

function progress(ctx, issue) {
  const { doc } = ctx;
  const p = progressOf(issue, { issues: ctx.board.issues, refs: ctx.board.refs || new Map(), sections: ctx.sections || null });
  const rows = [];
  if (p.status) rows.push(row(doc, 'Statut', p.status.title + (p.status.detail ? ` — ${p.status.detail}` : '')));
  if (p.goal) rows.push(row(doc, 'But', p.goal));
  if (p.finished) {
    const f = p.finished;
    rows.push(row(doc, 'Fini quand', f.total ? [h(doc, 'progress', { value: f.done, max: f.total, 'aria-label': 'Fini quand' }), ` ${f.done}/${f.total}`] : null,
      h(doc, 'details', null, h(doc, 'summary', null, `${f.items.length} critère${f.items.length > 1 ? 's' : ''}`),
        h(doc, 'ul', { class: 'finished' }, f.items.map(item => h(doc, 'li', null,
          item.done === null ? null : h(doc, 'input', { type: 'checkbox', disabled: true, checked: item.done }), ` ${item.text}`))))));
  }
  if (p.sub) {
    rows.push(row(doc, 'Sous-issues', h(doc, 'progress', { value: p.sub.done, max: p.sub.total, 'aria-label': 'Sous-issues fermées' }), ` ${p.sub.done}/${p.sub.total} fermées`,
      h(doc, 'details', null, h(doc, 'summary', null, 'liste'),
        h(doc, 'ul', { class: 'sub-list' }, p.sub.items.map(i => h(doc, 'li', { class: i.state === 'CLOSED' ? 'closed' : '' },
          h(doc, 'a', { href: ctx.issueHref(i.number) }, `#${i.number}`), i.title ? ` ${i.title}` : '', ` — ${stateText(i.state)}`))))));
  }
  if (p.lastNote) rows.push(row(doc, 'Dernier point', h(doc, 'span', { class: 'muted' }, `${dayTime(p.lastNote.createdAt)} `), p.lastNote.line));
  if (!rows.length) return null;
  return h(doc, 'section', { class: 'block progress' }, h(doc, 'h2', null, 'Où en est-on'), h(doc, 'dl', { class: 'where' }, rows.flat()));
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

const UNFOLDED_NOTES = 3;

/** Markdown of `body`; when long: its lead, an outline of its headings, and the full text folded. */
function readable(ctx, body, prefix) {
  const { doc } = ctx;
  const full = h(doc, 'div', { class: 'md' }, renderMarkdown(body, doc, { issueHref: ctx.issueHref, headingIds: prefix }));
  if (!isLong(body)) return full;
  const fold = h(doc, 'details', { class: 'long' }, h(doc, 'summary', null, 'lire tout'), full);
  const headings = outline(body);
  const toc = headings.length >= 2 ? h(doc, 'nav', { class: 'toc', 'aria-label': 'Sommaire' }, headings.map(hd => {
    const b = h(doc, 'button', { type: 'button', class: 'toc-link' }, hd.text);
    if (hd.level === 3) b.setAttribute('aria-level', '3');
    b.addEventListener('click', () => {
      fold.open = true;
      doc.getElementById(`${prefix}-${hd.index}`)?.scrollIntoView({ block: 'start' });
    });
    return b;
  })) : null;
  const first = lead(body);
  return [first ? h(doc, 'p', { class: 'lead' }, first) : null, toc, fold];
}

function notes(ctx, issue) {
  const { doc } = ctx;
  if (issue.commentsError) {
    return block(doc, 'Points d’étape', h(doc, 'p', { class: 'banner warn' }, `Commentaires illisibles : ${issue.commentsError}`));
  }
  if (!issue.commentsComplete) {
    ctx.loadComments(issue);
    return block(doc, 'Points d’étape', h(doc, 'p', { class: 'muted' }, 'chargement…'));
  }
  if (!issue.comments.length) return block(doc, 'Points d’étape', h(doc, 'p', { class: 'muted' }, 'aucun commentaire'));
  return block(doc, `Points d'étape (${issue.comments.length})`, [...issue.comments].reverse().map((c, i) => {
    const prefix = `c${issue.comments.length - 1 - i}`;
    if (i < UNFOLDED_NOTES) {
      return h(doc, 'article', { class: 'note' }, h(doc, 'p', { class: 'when' }, dayTime(c.createdAt)), readable(ctx, c.body, prefix));
    }
    const firstLine = c.body.split('\n').map(l => l.replace(/^\s*#+\s*/, '').trim()).find(Boolean) || '';
    return h(doc, 'details', { class: 'note old' },
      h(doc, 'summary', null, h(doc, 'span', { class: 'when' }, dayTime(c.createdAt)), ` ${short(firstLine, 80)}`),
      readable(ctx, c.body, prefix));
  }));
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
    actions(ctx, issue),
    progress(ctx, issue),
    questions(ctx, issue),
    sessions(ctx, issue),
    deps(ctx, issue),
    block(doc, 'Description', readable(ctx, issue.body, 'd')),
    notes(ctx, issue));
}
