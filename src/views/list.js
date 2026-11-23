// Board: one section per state, cards linking to the detail page.
import { h } from '../dom.js';
import { SECTIONS } from '../classify.js';
import { dayTime } from '../format.js';
import { banners, header } from './common.js';

function cardItem(ctx, c) {
  const { doc } = ctx;
  const session = c.sessions.at(-1);
  return h(doc, 'li', { class: 'card' },
    h(doc, 'a', { class: 'card-main', href: ctx.issueHref(c.number) },
      h(doc, 'span', { class: 'num' }, `#${c.number}`),
      h(doc, 'span', { class: 'title' }, c.title),
      c.detail ? h(doc, 'span', { class: 'detail' }, c.detail) : null),
    session ? h(doc, 'a', { class: 'session', href: session, rel: 'noopener noreferrer', target: '_blank' }, 'session ↗') : null);
}

function section(ctx, key, title, cards) {
  const { doc } = ctx;
  const list = cards.length
    ? h(doc, 'ul', { class: 'cards' }, cards.map(c => cardItem(ctx, c)))
    : h(doc, 'p', { class: 'empty' }, 'aucune');
  if (key === 'other') {
    return h(doc, 'details', { class: `section section-${key}` },
      h(doc, 'summary', null, h(doc, 'h2', null, `${title} `, h(doc, 'span', { class: 'count' }, cards.length))), list);
  }
  return h(doc, 'section', { class: `section section-${key}` },
    h(doc, 'h2', null, `${title} `, h(doc, 'span', { class: 'count' }, cards.length)), list);
}

export function listView(ctx) {
  const { doc, sections } = ctx;
  const pc = sections.pc;
  const pcText = 'dernier commit de la branche pilotage : '
    + (pc.date ? dayTime(pc.date) : 'aucun') + (pc.idle ? ' — PC inactif ?' : '');
  return h(doc, 'div', { class: 'view view-list' },
    header(ctx),
    banners(ctx),
    SECTIONS.filter(([key]) => key !== 'other' || sections.other.length)
      .map(([key, title]) => section(ctx, key, title, sections[key])),
    h(doc, 'section', { class: 'section section-pc' }, h(doc, 'h2', null, 'PC'),
      h(doc, 'p', { class: pc.idle ? 'pc idle' : 'pc' }, pcText)));
}
