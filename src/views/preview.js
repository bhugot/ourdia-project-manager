// Preview of a cited issue: the first tap on a `#N` link shows a small card, a second tap (or
// « Ouvrir ») opens the issue. Links to issues that are not loaded keep navigating directly.
import { h } from '../dom.js';
import { progressOf } from '../progress.js';
import { dayTime } from '../format.js';

const NUMBER_RE = /\/issue\/(\d+)$/;
const stateText = s => (s === 'OPEN' ? 'ouverte' : s === 'CLOSED' ? 'fermée' : 'état inconnu');

export function attachPreview(ctx, root) {
  const { doc } = ctx;
  let shown = null; // {number, card}

  const close = () => {
    if (!shown) return;
    root.removeChild(shown.card);
    shown = null;
  };

  const open = issue => {
    close();
    const p = progressOf(issue, { issues: ctx.board.issues, refs: ctx.board.refs || new Map(), sections: ctx.sections || null });
    const shut = h(doc, 'button', { type: 'button' }, 'Fermer');
    shut.addEventListener('click', close);
    const card = h(doc, 'aside', { class: 'preview', role: 'dialog', 'aria-label': `Aperçu de #${issue.number}` },
      h(doc, 'p', { class: 'preview-title' }, h(doc, 'span', { class: 'num' }, `#${issue.number} `), issue.title),
      h(doc, 'p', { class: 'preview-meta' }, stateText(issue.state), p.status ? ` · ${p.status.title}` : ''),
      p.lastNote ? h(doc, 'p', { class: 'preview-note' }, h(doc, 'span', { class: 'muted' }, `${dayTime(p.lastNote.createdAt)} `), p.lastNote.line) : null,
      h(doc, 'div', { class: 'actions' }, h(doc, 'a', { class: 'button primary', href: ctx.issueHref(issue.number) }, 'Ouvrir'), shut));
    root.appendChild(card);
    shown = { number: issue.number, card };
  };

  root.addEventListener('click', event => {
    const link = event.target?.closest?.('a.issue-ref');
    if (!link) {
      if (shown && !event.target?.closest?.('.preview')) close();
      return;
    }
    const m = (link.getAttribute ? link.getAttribute('href') : link.attributes.href)?.match(NUMBER_RE);
    const issue = m && ctx.board.issues.find(i => i.number === Number(m[1]));
    if (!issue || shown?.number === issue.number) { close(); return; } // navigate
    event.preventDefault();
    open(issue);
  });
  root.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
}
