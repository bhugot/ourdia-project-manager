// Pieces shared by the views: top bar and banners.
import { h } from '../dom.js';
import { dayTime, longDate } from '../format.js';
import { parseExpiry } from '../github.js';

const EXPIRY_WARNING = 14 * 24 * 3600 * 1000;

export function header(ctx, { back = false } = {}) {
  const { doc } = ctx;
  const refresh = h(doc, 'button', { type: 'button', class: 'refresh' }, 'Rafraîchir');
  refresh.addEventListener('click', () => ctx.refresh());
  return h(doc, 'header', { class: 'top' },
    back ? h(doc, 'a', { class: 'back', href: ctx.home }, '← Liste') : h(doc, 'h1', null, 'Ourdia'),
    h(doc, 'span', { class: 'stamp' }, ctx.loadedAt ? `lu à ${dayTime(ctx.loadedAt).split(' ')[1]}` : ''),
    refresh,
    h(doc, 'a', { class: 'settings-link', href: '#/settings', 'aria-label': 'Réglages' }, '⚙'));
}

export function banners(ctx) {
  const { doc, board } = ctx;
  const out = [];
  if (ctx.demo) out.push(h(doc, 'p', { class: 'banner info' }, 'Mode démo : données inventées. ',
    h(doc, 'a', { href: '#/' }, 'Quitter')));
  const expiry = parseExpiry(board?.tokenExpiry);
  if (expiry && expiry - ctx.now < EXPIRY_WARNING) {
    out.push(h(doc, 'p', { class: 'banner warn' }, `Le jeton expire le ${longDate(expiry)}. `,
      h(doc, 'a', { href: '#/settings' }, 'Le remplacer')));
  }
  for (const w of board?.warnings || []) out.push(h(doc, 'p', { class: 'banner warn' }, w));
  return out;
}
