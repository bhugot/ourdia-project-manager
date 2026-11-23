// Token settings: paste once, kept in this phone's localStorage.
import { h } from '../dom.js';
import { longDate } from '../format.js';
import { parseExpiry } from '../github.js';

const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export function settingsView(ctx) {
  const { doc } = ctx;
  const input = h(doc, 'input', { type: 'password', id: 'token', name: 'token', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'github_pat_…' });
  const save = h(doc, 'button', { type: 'button', class: 'primary' }, 'Enregistrer');
  const forget = h(doc, 'button', { type: 'button' }, 'Oublier le jeton');
  save.addEventListener('click', () => { if (input.value.trim()) ctx.saveToken(input.value.trim()); });
  forget.addEventListener('click', () => ctx.forgetToken());
  const expiry = parseExpiry(ctx.board?.tokenExpiry);

  return h(doc, 'div', { class: 'view view-settings' },
    h(doc, 'header', { class: 'top' }, ctx.hasToken ? h(doc, 'a', { class: 'back', href: '#/' }, '← Liste') : h(doc, 'h1', null, 'Ourdia')),
    h(doc, 'h1', null, 'Réglages'),
    ctx.authError ? h(doc, 'p', { class: 'banner warn' }, 'Jeton refusé par GitHub : colle un nouveau jeton.') : null,
    h(doc, 'p', null, ctx.hasToken ? 'Un jeton est enregistré sur ce téléphone.' : 'Aucun jeton enregistré sur ce téléphone.',
      expiry ? ` Il expire le ${longDate(expiry)}.` : ''),
    h(doc, 'label', { for: 'token' }, 'Jeton GitHub (fine-grained)'),
    input,
    h(doc, 'div', { class: 'actions' }, save, ctx.hasToken ? forget : null),
    h(doc, 'h2', null, 'Créer le jeton'),
    h(doc, 'ol', null,
      h(doc, 'li', null, h(doc, 'a', { href: NEW_TOKEN_URL, rel: 'noopener noreferrer', target: '_blank' }, 'Nouveau jeton fine-grained ↗')),
      h(doc, 'li', null, 'Repository access : Only select repositories → bhugot/ourdia.'),
      h(doc, 'li', null, 'Permissions du dépôt : Issues en lecture, Contents en lecture (Metadata en lecture est imposée).'),
      h(doc, 'li', null, 'Copier le jeton et le coller ici. Il reste sur ce téléphone et ne part que vers api.github.com.')),
    h(doc, 'p', null, h(doc, 'a', { href: '#/demo' }, 'Voir le mode démo (données inventées)')));
}
