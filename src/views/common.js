// Pieces shared by the views: top bar, navigation and banners.
import { h } from '../dom.js';
import { dayTime, longDate } from '../format.js';
import { parseExpiry } from '../github.js';

const EXPIRY_WARNING = 14 * 24 * 3600 * 1000;
const EDIT_TOKENS_URL = 'https://github.com/settings/personal-access-tokens';

export function header(ctx, { back = false } = {}) {
  const { doc } = ctx;
  const refresh = h(doc, 'button', { type: 'button', class: 'refresh', 'aria-label': 'Rafraîchir', title: 'Rafraîchir' }, '↻');
  refresh.addEventListener('click', () => ctx.refresh());
  const tab = (href, label, current) => h(doc, 'a', { href, class: current ? 'tab current' : 'tab', 'aria-current': current ? 'page' : false }, label);
  return h(doc, 'header', { class: 'top' },
    back ? h(doc, 'a', { class: 'back', href: ctx.home }, '← Retour') : h(doc, 'nav', { class: 'tabs' },
      tab(ctx.home, 'Synthèse', ctx.route === 'synthesis'), tab(ctx.listHref, 'Liste', ctx.route === 'list'),
      tab(ctx.decisionsHref, 'Décisions', ctx.route === 'decisions')),
    h(doc, 'span', { class: 'stamp' }, ctx.loadedAt ? `lu à ${dayTime(ctx.loadedAt).split(' ')[1]}` : ''),
    refresh,
    h(doc, 'a', { class: 'settings-link', href: '#/settings', 'aria-label': 'Réglages' }, '⚙'));
}

export function banners(ctx) {
  const { doc, board } = ctx;
  const out = [];
  if (ctx.demo) out.push(h(doc, 'p', { class: 'banner info' }, 'Mode démo : données inventées, rien n\'est envoyé. ',
    h(doc, 'a', { href: '#/' }, 'Quitter')));
  if (ctx.writeError) {
    out.push(h(doc, 'div', { class: 'banner warn' },
      h(doc, 'p', null, ctx.writeError),
      h(doc, 'p', null, 'Sur GitHub : ', h(doc, 'a', { href: EDIT_TOKENS_URL, rel: 'noopener noreferrer', target: '_blank' }, 'tes jetons fine-grained ↗'),
        ', ouvre le jeton « Ourdia suivi », Edit, puis Issues : Read and write. Ou crée un nouveau jeton depuis les ',
        h(doc, 'a', { href: '#/settings' }, 'Réglages'), '.')));
  }
  const expiry = parseExpiry(board?.tokenExpiry);
  if (expiry && expiry - ctx.now < EXPIRY_WARNING) {
    out.push(h(doc, 'p', { class: 'banner warn' }, `Le jeton expire le ${longDate(expiry)}. `,
      h(doc, 'a', { href: '#/settings' }, 'Le remplacer')));
  }
  for (const w of board?.warnings || []) out.push(h(doc, 'p', { class: 'banner warn' }, w));
  return out;
}
