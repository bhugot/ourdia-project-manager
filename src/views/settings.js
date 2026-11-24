// Token settings: create it from a pre-filled GitHub form, paste once, kept in this phone's localStorage.
import { h } from '../dom.js';
import { longDate } from '../format.js';
import { newTokenUrl, parseExpiry } from '../github.js';

function badgeBlock(ctx) {
  const { doc } = ctx;
  const title = h(doc, 'h2', null, 'Pastille sur l’icône');
  if (ctx.badge === 'ready') {
    return [title, h(doc, 'p', null, 'Active : l’icône de l’écran d’accueil montre le nombre de questions qui t’attendent, mis à jour à chaque ouverture.')];
  }
  if (ctx.badge === 'needs-permission') {
    const enable = h(doc, 'button', { type: 'button' }, 'Activer la pastille');
    enable.addEventListener('click', () => ctx.enableBadge());
    return [title, h(doc, 'p', null, 'Sur iPhone, la pastille demande l’autorisation des notifications (aucune notification n’est envoyée) et l’app ajoutée à l’écran d’accueil.'), enable];
  }
  return [title, h(doc, 'p', null, 'Ce navigateur n’affiche pas de pastille sur l’icône (Chrome sur Android, par exemple) : le nombre de questions apparaît dans le titre de la page.')];
}

export function settingsView(ctx) {
  const { doc } = ctx;
  const input = h(doc, 'input', { type: 'password', id: 'token', name: 'token', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'github_pat_…' });
  const status = h(doc, 'p', { class: 'muted', role: 'status' });
  const paste = h(doc, 'button', { type: 'button', class: 'primary' }, 'Coller le jeton et enregistrer');
  const save = h(doc, 'button', { type: 'button' }, 'Enregistrer');
  const forget = h(doc, 'button', { type: 'button' }, 'Oublier le jeton');
  const store = value => {
    const token = (value || '').trim();
    if (!/^(github_pat_|ghp_)\w+$/.test(token)) { status.textContent = 'Ce n\'est pas un jeton GitHub (il commence par github_pat_).'; return; }
    ctx.saveToken(token);
  };
  paste.addEventListener('click', async () => {
    try {
      store(await navigator.clipboard.readText());
    } catch {
      status.textContent = 'Lecture du presse-papiers refusée : colle le jeton dans le champ puis Enregistrer.';
      input.focus();
    }
  });
  save.addEventListener('click', () => store(input.value));
  forget.addEventListener('click', () => ctx.forgetToken());
  const expiry = parseExpiry(ctx.board?.tokenExpiry);

  return h(doc, 'div', { class: 'view view-settings' },
    h(doc, 'header', { class: 'top' }, ctx.hasToken ? h(doc, 'a', { class: 'back', href: '#/' }, '← Liste') : h(doc, 'h1', null, 'Ourdia')),
    h(doc, 'h1', null, 'Réglages'),
    ctx.authError ? h(doc, 'p', { class: 'banner warn' }, 'Jeton refusé par GitHub : crée un nouveau jeton.') : null,
    h(doc, 'p', null, ctx.hasToken ? 'Un jeton est enregistré sur ce téléphone.' : 'Aucun jeton enregistré sur ce téléphone.',
      expiry ? ` Il expire le ${longDate(expiry)}.` : ''),
    h(doc, 'h2', null, 'Une fois par an'),
    h(doc, 'ol', { class: 'steps' },
      h(doc, 'li', null, h(doc, 'a', { href: newTokenUrl(), rel: 'noopener noreferrer', target: '_blank' }, 'Ouvrir le formulaire GitHub prérempli ↗'),
        ' (nom, durée d\'un an, Issues en écriture, Contents en lecture).'),
      h(doc, 'li', null, 'Dans « Repository access », choisir ', h(doc, 'strong', null, 'Only select repositories → ourdia'), '.'),
      h(doc, 'li', null, '« Generate token », puis copier le jeton.'),
      h(doc, 'li', null, 'Revenir ici et toucher le bouton ci-dessous.')),
    h(doc, 'div', { class: 'actions' }, paste),
    status,
    h(doc, 'label', { for: 'token' }, 'Ou coller le jeton à la main'),
    input,
    h(doc, 'div', { class: 'actions' }, save, ctx.hasToken ? forget : null),
    h(doc, 'p', { class: 'muted' }, 'Le jeton reste sur ce téléphone et ne part que vers api.github.com.'),
    badgeBlock(ctx),
    h(doc, 'p', null, h(doc, 'a', { href: '#/demo' }, 'Voir le mode démo (données inventées)')));
}
