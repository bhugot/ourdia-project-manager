// Opening screen: computed sentences, then the sessions' last reports.
import { h } from '../dom.js';
import { renderMarkdown } from '../markdown.js';
import { summarize } from '../synthesis.js';
import { dayTime } from '../format.js';
import { banners, header } from './common.js';

const REPORT_LIMIT = 400;
const SECTION_NAMES = { waiting: 'À trancher', blocked: 'Bloqué', running: 'En cours', done: 'Fini' };

function line(ctx, chunks) {
  const { doc } = ctx;
  return h(doc, 'li', null, chunks.map(c => (typeof c === 'string' ? c : h(doc, 'a', { href: ctx.issueHref(c.issue) }, `#${c.issue}`))));
}

function report(ctx, r) {
  const { doc } = ctx;
  const cut = r.body.length > REPORT_LIMIT;
  const body = cut ? `${r.body.slice(0, REPORT_LIMIT).trimEnd()} …` : r.body;
  return h(doc, 'article', { class: `report report-${r.section}` },
    h(doc, 'p', { class: 'report-head' },
      h(doc, 'a', { href: ctx.issueHref(r.number) }, h(doc, 'span', { class: 'num' }, `#${r.number} `), r.title)),
    h(doc, 'p', { class: 'report-meta' }, h(doc, 'span', { class: `tag tag-${r.section}` }, SECTION_NAMES[r.section]),
      ` ${dayTime(r.when)}`, r.fresh ? h(doc, 'span', { class: 'fresh' }, 'nouveau') : null),
    r.body ? h(doc, 'div', { class: 'md' }, renderMarkdown(body, doc, { issueHref: ctx.issueHref })) : h(doc, 'p', { class: 'muted' }, 'aucun commentaire'),
    cut ? h(doc, 'p', null, h(doc, 'a', { href: ctx.issueHref(r.number) }, 'lire la suite')) : null);
}

export function synthesisView(ctx) {
  const { doc } = ctx;
  const { lines, reports } = summarize(ctx.board, ctx.sections, { since: ctx.since, now: ctx.now });
  return h(doc, 'div', { class: 'view view-synthesis' },
    header(ctx),
    banners(ctx),
    h(doc, 'section', { class: 'summary' },
      h(doc, 'h2', null, `Depuis ta dernière visite (${dayTime(ctx.since)})`),
      h(doc, 'ul', { class: 'summary-lines' }, lines.map(l => line(ctx, l)))),
    h(doc, 'section', { class: 'reports' },
      h(doc, 'h2', null, 'Comptes rendus'),
      reports.length ? reports.map(r => report(ctx, r)) : h(doc, 'p', { class: 'muted' }, 'aucun')));
}
