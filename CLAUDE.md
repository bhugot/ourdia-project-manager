# Ourdia Project Manager

Page statique (GitHub Pages) pour suivre depuis le téléphone les issues et les sessions de `bhugot/ourdia`, le dépôt du MMO Ourdia. Elle lit l'API GraphQL de GitHub avec un jeton fine-grained saisi une fois sur le téléphone. Pas de serveur.

- Spec : `docs/superpowers/specs/2026-11-23-ourdia-project-manager-design.md` ; plan du jalon 1 : `docs/superpowers/plans/`.
- Conventions de l'équipe (labels, questions pour Ben, prise des issues) : `CLAUDE.md` et `.claude/docs/questions-ben.md` du workspace `bhugot/ourdia-workspace`. `src/questions.js` et `src/classify.js` portent `tools/automation/questions.py` et `dashboard.py` du dépôt du jeu : une règle changée là-bas se change ici aussi.

## Règles

- **Aucun code tiers** : pas de CDN, aucune dépendance npm. Pas d'étape de construction : les fichiers sont servis tels quels.
- **CSP stricte** dans `index.html` ; aucun script, style ou attribut `style=` / `on*=` en ligne.
- **Jamais `innerHTML`** (ni `outerHTML`, `insertAdjacentHTML`, `document.write`) sur du contenu venu de GitHub : le DOM se construit avec `src/dom.js` et `src/markdown.js`.
- Le jeton ne sort du `localStorage` que dans l'en-tête `Authorization` d'une requête vers `https://api.github.com` ; jamais dans une URL ni dans la console.
- **Ce dépôt est public, celui du jeu est privé** : données de test inventées, aucun contenu réel d'issue copié ici.
- Interface et documents en français ; code et identifiants en anglais.
- Tests : `npm test` (`node --test`, sans dépendance), vert avant chaque push. Relecture par une session neuve avant de pousser (règle du workspace).

## Origine partagée (relecture du 24/11)

Le jeton vit dans le `localStorage` de l'origine `https://bhugot.github.io`, partagée par **toutes** les pages GitHub Pages des dépôts de `bhugot`. Tant que l'app y est servie : aucun autre site Pages de `bhugot` ne charge de script tiers ni de code non relu. Si un tel site doit exister, passer d'abord l'app sur un domaine personnalisé dédié.
