# Jalon 1 — tableau de bord en lecture seule : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page statique GitHub Pages qui montre à Ben, sur son téléphone, les issues de `bhugot/ourdia` classées comme le tableau de bord #43, avec une fiche détaillée par issue.

**Architecture:** Modules ES sans construction. Les fonctions pures (`questions`, `parse`, `classify`, `markdown`, normalisation GitHub) sont testées par `node --test`. Les vues construisent le DOM sans `innerHTML`. Une requête GraphQL par ouverture, plus une requête complémentaire.

**Tech Stack:** HTML, CSS, JavaScript (ES2022, modules natifs), API GraphQL de GitHub, `node --test` (Node ≥ 20), GitHub Pages, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-23-ourdia-project-manager-design.md`

## Global Constraints

- Aucun code tiers : pas de CDN, aucune dépendance npm (`package.json` ne sert qu'à déclarer `"type": "module"` et le script `test`).
- CSP en `<meta>` exactement : `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src https://api.github.com; manifest-src 'self'; base-uri 'none'; form-action 'none'`. Aucun script, style ou attribut `style=` / `on*=` en ligne.
- Jamais `innerHTML`, `outerHTML`, `insertAdjacentHTML` ni `document.write` sur du contenu venu de GitHub.
- Le jeton ne quitte le `localStorage` (clé `opm.token`) que dans l'en-tête `Authorization: Bearer` d'une requête vers `https://api.github.com`. Jamais dans une URL, jamais dans `console.*`.
- Dépôt lu : `bhugot/ourdia`. Propriétaire pour la prise : `bhugot`. Labels cloud du plus faible au plus fort : `cloud`, `cloud-plus`, `cloud-fort` → `Sonnet`, `Opus`, `Fable`. Label historique de prise : `en-cours`. Label du tableau de bord exclu : `tableau-de-bord`.
- Interface en français ; code, identifiants et noms de fichiers en anglais.
- Données de test **inventées** : aucun titre, corps ni lien de session réel de `bhugot/ourdia` dans ce dépôt public.
- Heures affichées en heure de Paris (`Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', … })`).

## Review Focus

1. Un commentaire contenant `<script>`, `<img src=x onerror=…>`, `[a](javascript:alert(1))` ou `[a](data:…)` : rendu en texte, aucun élément actif. Test : Task 4.
2. GraphQL répond avec `data` partiel et `errors` (permission manquante sur la branche `pilotage` ou les sous-issues) : la liste s'affiche quand même, la ligne PC passe par REST, les sous-issues sont vides. Test : Task 5.
3. Jeton absent, invalide (401) ou expirant sous 14 jours : écran Réglages ou bandeau, jamais une page blanche. Test : Task 5 (statut et date d'expiration exposés) ; vérification manuelle Task 6.
4. Réponse tapée au téléphone (`q1 : b`, `Q1 : A, Q2 : B`, `- **Q3**: A`, `Q2 :` vide) : même lecture que `questions.py`. Test : Task 1.
5. Corps avec plusieurs lignes `apres:` et une dépendance fermée hors de la requête principale : « attend » ne liste que les ouvertes, d'après la requête complémentaire. Test : Tasks 2 et 3.

---

### Task 1: Ossature du dépôt et lecture des questions

**Files:**
- Create: `package.json`, `.gitignore`, `CLAUDE.md`, `README.md`, `.github/workflows/test.yml`
- Create: `src/questions.js`
- Test: `tests/questions.test.js`

**Interfaces:**
- Produces:
  - `ASK_HEADING = "## En attente de Ben"`
  - `isAsk(body: string) -> boolean`
  - `parseQuestions(body: string) -> Array<{n: number, title: string, optional: boolean, options: Array<{letter: string, text: string}>}>`
  - `parseAnswers(body: string) -> Map<number, string>`
  - `questionStatus(comments: Array<{body: string}>) -> null | {questions, answers: Map<number,string>, pending: number[]}`

- [ ] **Step 1: Ossature.** `package.json` : `{"name":"ourdia-project-manager","private":true,"type":"module","scripts":{"test":"node --test tests/"}}`. `CLAUDE.md` en français : rôle du dépôt, lien vers la spec, contraintes globales ci-dessus, « données de test inventées ». Workflow `test.yml` : `actions/checkout@v4`, `actions/setup-node@v4` (Node 22), `npm test`, sur `push` et `pull_request`.

- [ ] **Step 2: Écrire les tests qui échouent** (portage de `ourdia/tests/test_automation.py`, avec la même série `ASK` : Q1 « Taille des groupes », Q2 « Nom du village (peut attendre) », Q3 « Durée d'un hiver », chacune avec ses options `- **A.** …`).

```js
test('parseQuestions', () => {
  assert.deepEqual(parseQuestions(ASK).map(q => [q.n, q.title, q.optional]),
    [[1, 'Taille des groupes', false], [2, 'Nom du village', true], [3, "Durée d'un hiver", false]]);
  assert.deepEqual(parseQuestions(ASK)[2].options, [{letter: 'A', text: '3 jours'}, {letter: 'B', text: 'Autre (préciser)'}]);
  assert.deepEqual(parseQuestions('### q1 Taille\n### Q2 — Nom (Peut attendre).\n').map(q => [q.n, q.title, q.optional]),
    [[1, 'Taille', false], [2, 'Nom', true]]);
});
test('parseAnswers', () => {
  assert.deepEqual([...parseAnswers('Q1 : B — trois, pas plus\n- **Q3**: A\nrien\n')], [[1, 'B — trois, pas plus'], [3, 'A']]);
  assert.deepEqual([...parseAnswers('q1 : b\nQ2 :\nQ3: A\n')], [[1, 'b'], [3, 'A']]);
  assert.deepEqual([...parseAnswers('Q1 :\nB')], []);
  assert.deepEqual([...parseAnswers('Q1 : A, Q2 : B — libre, oui ; q3: C')], [[1, 'A'], [2, 'B — libre, oui'], [3, 'C']]);
  assert.deepEqual([...parseAnswers('Q1 ： A')], [[1, 'A']]);
});
test('questionStatus counts answers after the last ask only', () => {
  assert.equal(questionStatus([{body: "Prise par l'exécutant cloud"}]), null);
  assert.equal(questionStatus([{body: '## En attente de Ben\nTexte libre ?'}]), null);
  assert.equal(isAsk('Remontée vers Opus.\n## En attente de Ben'), false);
  const c = [{body: 'Q1 : A'}, {body: ASK}, {body: 'Q1 : B\nQ9 : A'}];
  const s = questionStatus(c);
  assert.deepEqual([...s.answers], [[1, 'B']]); assert.deepEqual(s.pending, [3]);
  c.push({body: 'Q3 : A'}); assert.deepEqual(questionStatus(c).pending, []);
});
```

- [ ] **Step 3: Lancer** `npm test` → échec « Cannot find module ».

- [ ] **Step 4: Implémenter `src/questions.js`.** Recopier les expressions régulières de `questions.py` en syntaxe JS (drapeaux `gimu`, `\t` et `[ \t]` à l'identique). Les options sont les lignes `^[ \t]*[-*][ \t]*\*\*([A-Z])\.\*\*[ \t]*(.*)$` situées entre le titre de la question et le titre suivant.

- [ ] **Step 5: Lancer** `npm test` → PASS.

- [ ] **Step 6: Commit** `git commit -m "Ossature et lecture des questions pour Ben"`.

### Task 2: Lecture des corps et commentaires

**Files:**
- Create: `src/parse.js`
- Test: `tests/parse.test.js`

**Interfaces:**
- Produces:
  - `parseAfter(body: string) -> number[]` : tous les `#N` de **toutes** les lignes `^\s*apres:` (ordre d'apparition, sans doublon)
  - `sessionLinks(comments: Array<{body}>) -> string[]` : liens `https://claude.ai/code/session_[A-Za-z0-9]+`, commentaires commençant (après espaces) par `~~` exclus, ordre chronologique, sans doublon
  - `mentions(text: string) -> number[]` : `#N` hors blocs de code et hors lignes `apres:`, sans doublon
  - `finishedWhen(body: string) -> null | {items: Array<{text: string, done: boolean|null}>, done: number, total: number}` : section `## Fini quand` jusqu'au titre `#`/`##` suivant ; `done: null` pour une puce sans case ; `total` ne compte que les cases
  - `short(text: string, n = 90) -> string` : espaces fusionnés, coupé à `n-1` + `…`

- [ ] **Step 1: Tests qui échouent**

```js
assert.deepEqual(parseAfter('voie: design\napres: #55, #56\napres: #60\n'), [55, 56, 60]);
assert.deepEqual(parseAfter('rien'), []);
assert.deepEqual(sessionLinks([{body: 'Prise — session : https://claude.ai/code/session_A1'},
  {body: '~~https://claude.ai/code/session_B2~~'}, {body: 'encore https://claude.ai/code/session_A1'}]),
  ['https://claude.ai/code/session_A1']);
assert.deepEqual(mentions('voir #12 et #7\n```\n#99\n```\napres: #5'), [12, 7]);
assert.deepEqual(finishedWhen('## Fini quand\n- [x] a\n- [ ] b\n- c\n## Suite\n- [ ] d'),
  {items: [{text: 'a', done: true}, {text: 'b', done: false}, {text: 'c', done: null}], done: 1, total: 2});
assert.equal(finishedWhen('pas de section'), null);
assert.equal(short('a'.repeat(100)).length, 90);
```

- [ ] **Step 2: Lancer** `npm test` → FAIL. **Step 3: Implémenter.** **Step 4: Lancer** → PASS.

- [ ] **Step 5: Commit** `git commit -m "Lecture des dépendances, sessions et Fini quand"`.

### Task 3: Classement des issues (portage de `dashboard.py`)

**Files:**
- Create: `src/classify.js`
- Test: `tests/classify.test.js`

**Interfaces:**
- Consumes: Task 1 `questionStatus`, `parseQuestions` ; Task 2 `parseAfter`, `sessionLinks`, `short`.
- Issue normalisée (produite par Task 5, utilisée partout) :
  `{number, title, body, state: 'OPEN'|'CLOSED', labels: string[], assignees: string[], createdAt, updatedAt, closedAt: string|null, comments: Array<{body, createdAt}>, commentsComplete: boolean, parent: number|null, subIssues: number[]}`
- Produces:
  - `classify(issues: Issue[], {now: Date, states: Map<number,'OPEN'|'CLOSED'>, pilotageDate: string|null}) -> {waiting: Card[], blocked: Card[], running: Card[], queued: Card[], done: Card[], other: Card[], pc: {date: string|null, idle: boolean}}`
  - `Card = {number, title, detail: string, sessions: string[]}`
  - `SECTIONS = [['waiting','À trancher'],['blocked','Bloqué'],['running','En cours'],['queued','En file'],['done','Fini depuis 24 h'],['other','Autres']]`

Règles (copie exacte de `dashboard.py`, voir la spec, section « Classement ») :
- Exclure l'issue au label `tableau-de-bord`. `attente-ben` d'abord. Prise = assignée à `bhugot` ou label `en-cours`. En cours si prise, ou label cloud et dernier commentaire commençant par `Prise par l'exécutant`. Bloqué si `now - (dernier commentaire.createdAt ?? updatedAt) > 3 h`, détail `<label>, sans nouvelle depuis plus de 3 h`. Le label affiché est le plus fort des labels cloud, sinon `pilotage`, sinon `sans label d'exécution`.
- En file : détail `<label>` puis `, attend #55, #56` pour les dépendances dont l'état (issue chargée, sinon `states`) est `OPEN`.
- Fini : `closedAt` de moins de 24 h, tri décroissant, 10 au plus, détail `short(dernier commentaire)` ou `fermée`.
- Autres : ouvertes sans `attente-ben`, sans label d'exécution et non prises, détail vide.
- Détail d'À trancher (`_waiting_detail`) : `question en attente` / `short(dernier commentaire sans « ## En attente de Ben » ni « En attente de Ben », débarrassé de « :—- » et des espaces de tête et de fin)` ; `Q1 Nom du village (facultatives)` ; `réponses reçues, à relancer en Opus` / `… à relancer (pilotage)` / `… à relancer` ; `short('Q3 Durée d\'un hiver')` + ` (1/3 répondues)`.
- `pc.idle` : `pilotageDate` de plus de 2 h et au moins une issue `pilotage` en file.

- [ ] **Step 1: Tests qui échouent**, avec un `mk(number, labels, {assigned, body, comments, updatedAt, closedAt})` et `NOW = new Date('2026-11-23T12:00:00Z')` :
  - `#12` `attente-ben`+`cloud-plus`, commentaires `[ASK (−2 h), 'Q1 : A' (−1 h)]` → `waiting[0].detail === "Q3 Durée d'un hiver (1/3 répondues)"` ; on ajoute `'Q3 : A'` → `'réponses reçues, à relancer en Opus'` ;
  - série avec seulement une question « (peut attendre) » → `'Q1 Nom du village (facultatives)'` ;
  - `#20` assignée, dernier commentaire à −1 h → `running` ; à −4 h, labels `['cloud']` → `blocked`, détail `'cloud, sans nouvelle depuis plus de 3 h'` ;
  - `#30` `cloud`, dernier commentaire `Prise par l'exécutant cloud` à −10 min, non assignée → `running` ;
  - `#57` `cloud-plus`, corps `apres: #55, #56\napres: #60`, `#55` chargée ouverte, `states` = `{56: 'CLOSED', 60: 'OPEN'}` → détail `'cloud-plus, attend #55, #60'` ;
  - `#43` `tableau-de-bord` → absente partout ; `#70` sans label → `other` ;
  - fermée à −2 h → `done`, fermée à −30 h → absente ;
  - `pilotage` en file et `pilotageDate` à −3 h → `pc.idle === true` ; à −1 h → `false`.

- [ ] **Step 2: Lancer** → FAIL. **Step 3: Implémenter `classify`.** **Step 4: Lancer** → PASS.

- [ ] **Step 5: Commit** `git commit -m "Classement des issues comme le tableau de bord #43"`.

### Task 4: Rendu markdown sûr

**Files:**
- Create: `src/markdown.js`
- Test: `tests/markdown.test.js`

**Interfaces:**
- Produces:
  - `parseMarkdown(src: string) -> Block[]` (pur). Blocs : `{type:'heading', level, inlines}`, `{type:'paragraph', inlines}`, `{type:'list', ordered, items: Array<{checked: boolean|null, blocks: Block[]}>}`, `{type:'code', text}`, `{type:'quote', blocks}`, `{type:'rule'}`. Inlines : `{type:'text', text}`, `{type:'strong'|'em'|'del', inlines}`, `{type:'code', text}`, `{type:'link', href, inlines}`, `{type:'issue', number}`.
  - `renderMarkdown(src: string, doc: Document, {issueHref: (n) => string}) -> DocumentFragment` : construit avec `doc.createElement`, `doc.createTextNode`, `setAttribute('href' | 'rel' | 'target')` uniquement.

- [ ] **Step 1: Tests qui échouent** (sur `parseMarkdown`, et sur `renderMarkdown` avec un faux `doc` minimal qui enregistre les éléments créés) :
  - `'<script>alert(1)</script>'` → un paragraphe contenant un seul nœud texte égal à la source ;
  - `'<!-- dernier-signal: x -->\nTexte'` → seulement le paragraphe `Texte` ;
  - `'[a](javascript:alert(1))'` et `'[a](data:text/html,x)'` → texte, aucun `link` ; `'[a](https://x.y)'` → `link` ;
  - `'![img](https://x.y/p.png)'` → `link` vers `https://x.y/p.png` de texte `img` ;
  - `'- [x] a\n- [ ] b\n- c'` → `checked` `true`, `false`, `null` ;
  - `'voir #12'` → `issue` 12, rendu en `<a href="#/issue/12">` ; `'**gras** _it_ ~~barré~~ `code`'` → `strong`, `em`, `del`, `code` ;
  - `'| a | b |\n|---|---|'` → paragraphe de texte brut ;
  - rendu : aucun élément créé hors de `p h1…h6 ul ol li input pre code blockquote hr strong em del a span` ; `input` reçoit `type=checkbox`, `disabled` ; chaque `a` externe reçoit `rel="noopener noreferrer"` et `target="_blank"`.

- [ ] **Step 2: Lancer** → FAIL. **Step 3: Implémenter** (analyse ligne par ligne pour les blocs, puis analyse des inlines par balayage ; une URL n'est un lien que si `new URL(href).protocol` vaut `https:` ou `http:`). **Step 4: Lancer** → PASS.

- [ ] **Step 5: Commit** `git commit -m "Rendu markdown sûr, sans HTML injecté"`.

### Task 5: Accès à GitHub

**Files:**
- Create: `src/github.js`
- Test: `tests/github.test.js`

**Interfaces:**
- Consumes: Task 2 `parseAfter`, `mentions`.
- Produces:
  - `MAIN_QUERY: string` (spec, section « Données ») : issues ouvertes `first: 50` paginées par `after`, `comments(last: 100)`, `subIssues(first: 50) { nodes { number } }`, `parent { number }` ; fermées `first: 20, orderBy: {field: UPDATED_AT, direction: DESC}` avec `comments(last: 1)` et `closedAt` ; `ref(qualifiedName: "refs/heads/pilotage") { target { ... on Commit { committedDate } } }`
  - `async loadBoard(token: string, fetchFn = fetch) -> {issues: Issue[], states: Map, pilotageDate: string|null, warnings: string[], tokenExpiry: string|null}`
  - `async loadComments(token, number, fetchFn = fetch) -> Array<{body, createdAt}>` (fiche d'une issue fermée)
  - `class AuthError extends Error` (statut 401), `class ApiError extends Error {status}`
  - `normalizeIssue(node) -> Issue` (forme décrite en Task 3)

Comportement :
- `POST https://api.github.com/graphql`, en-têtes `Authorization: Bearer <token>` et `Content-Type: application/json` ; rien d'autre.
- `tokenExpiry` = en-tête `github-authentication-token-expiration` de la première réponse (ou `null`).
- Réponse avec `errors` **et** `data` : garder `data`, ajouter un message par erreur dans `warnings`. Si `ref` est `null`, lire `GET https://api.github.com/repos/bhugot/ourdia/commits?sha=pilotage&per_page=1` → `[0].commit.committer.date` ; si cela échoue aussi, `pilotageDate = null` et un avertissement.
- Requête complémentaire : pour chaque numéro cité (`parseAfter`, `parent`, `subIssues`, `mentions` des corps et commentaires) absent des issues chargées, un alias `i<N>: issue(number: N) { number title state }` dans une seule requête ; les alias `null` (issue supprimée ou pull request) sont ignorés.

- [ ] **Step 1: Tests qui échouent**, avec un `fetchFn` factice qui renvoie des réponses inventées :
  - réponse complète → `issues` normalisées (`labels` en chaînes, `assignees` en logins, `commentsComplete` vrai pour les ouvertes, faux pour les fermées), `tokenExpiry` lu dans l'en-tête ;
  - `data.repository.ref === null` avec `errors` → appel REST fait, `pilotageDate` repris, `warnings.length === 1` ;
  - une issue ouverte cite `apres: #5` absente → deuxième requête contenant `i5: issue(number: 5)`, `states.get(5) === 'CLOSED'` ;
  - statut 401 → `AuthError` ; 502 → `ApiError` avec `status === 502` ;
  - le jeton n'apparaît dans aucune URL appelée.

- [ ] **Step 2: Lancer** → FAIL. **Step 3: Implémenter.** **Step 4: Lancer** → PASS.

- [ ] **Step 5: Commit** `git commit -m "Lecture de bhugot/ourdia par l'API GraphQL"`.

### Task 6: Page, vues et mode démo

**Files:**
- Create: `index.html`, `app.css`, `manifest.webmanifest`, `icons/icon-192.png`, `icons/icon-512.png`
- Create: `src/main.js`, `src/views/list.js`, `src/views/issue.js`, `src/views/settings.js`, `src/dom.js`, `src/demo.js`
- Test: `tests/dom.test.js`

**Interfaces:**
- Consumes: Tasks 1 à 5.
- Produces:
  - `h(doc, tag, attrs?, ...children) -> Element` dans `src/dom.js` : `attrs` n'accepte que `class`, `href`, `type`, `disabled`, `rel`, `target`, `aria-*` ; les enfants chaîne deviennent des nœuds texte.
  - Routes par fragment : `#/` (liste), `#/issue/<n>`, `#/settings`, `#/demo` (liste sur données inventées).
  - `DEMO_BOARD` dans `src/demo.js` : un `loadBoard` hors ligne aux données inventées, avec au moins une issue par section, une série de questions avec une réponse, deux lignes `apres:` et un commentaire piégé `<script>`.

- [ ] **Step 1: Test qui échoue** `tests/dom.test.js` : `h` refuse (lève une erreur sur) `onclick`, `style` et `innerHTML` dans `attrs` ; une chaîne enfant devient un nœud texte.

- [ ] **Step 2: Implémenter `src/dom.js`**, lancer `npm test` → PASS.

- [ ] **Step 3: Écrire `index.html`** : `<meta charset>`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, la CSP exacte des contraintes globales, `<link rel="manifest">`, `<link rel="stylesheet" href="app.css">`, `<script type="module" src="src/main.js">`, `<meta name="theme-color">`, `<title>Ourdia — suivi</title>`. Manifeste : `name` « Ourdia — suivi », `short_name` « Ourdia », `display: standalone`, `start_url: "./"`, icônes 192 et 512 (générées par un petit script hors dépôt, motif simple, pas de marque tierce).

- [ ] **Step 4: Écrire les vues** selon la spec, section « Fiche d'une issue » et « Écrans et usage mobile » :
  - liste : en-tête (heure de lecture, bouton Rafraîchir, lien Réglages), bandeau d'expiration à moins de 14 jours, bandeau des `warnings`, sections de `SECTIONS` avec compteur, « Autres » dans un `<details>` replié, puis PC (`dernier commit de la branche pilotage : 23/11 21:18`, ` — PC inactif ?`) ; une carte = lien vers `#/issue/<n>`, numéro, titre, détail, lien « session » vers la dernière session ;
  - fiche : ordre de la spec ; « attend » / « débloque » / « sous-issues » / « parent » / « mentionne » / « mentionnée dans » avec l'état (ouverte/fermée) ; commentaires d'une issue fermée chargés à l'ouverture (`loadComments`) ;
  - réglages : champ mot de passe du jeton, boutons Enregistrer et Oublier, date d'expiration, lien `https://github.com/settings/personal-access-tokens/new`, liste des permissions (dépôt `bhugot/ourdia` seul ; Issues lecture ; Contents lecture ; Metadata lecture), lien vers `#/demo` ;
  - `AuthError` → Réglages avec « Jeton refusé » ; `ApiError` ou réseau → message et bouton Réessayer.
  - CSS : `prefers-color-scheme`, cibles tactiles ≥ 44 px, une colonne, texte ≥ 16 px.

- [ ] **Step 5: Vérifier dans le navigateur.** Servir le dossier en local (`python -m http.server 8137`), ouvrir `http://localhost:8137/#/demo` à 375 × 812 : chaque section s'affiche, la fiche de l'issue piégée montre `<script>` en texte, la console n'a aucune violation CSP ; `#/` sans jeton mène aux Réglages.

- [ ] **Step 6: Commit** `git commit -m "Page, vues liste, fiche et réglages, mode démo"`.

### Task 7: Publication et essai sur le téléphone

**Files:**
- Modify: `README.md` (adresse de la page, création du jeton, permissions)

- [ ] **Step 1: Relecture neuve** (agent `relecteur-neuf`, règle du workspace) de toute la branche contre la spec ; corriger ; ne pousser qu'après le verdict.

- [ ] **Step 2: Créer le dépôt et publier** : `gh repo create bhugot/ourdia-project-manager --public --source . --push`, puis `gh api -X POST repos/bhugot/ourdia-project-manager/pages -f "source[branch]=main" -f "source[path]=/"`.

- [ ] **Step 3: Vérifier** : l'Action `test` est verte ; `https://bhugot.github.io/ourdia-project-manager/#/demo` s'affiche sans erreur de console.

- [ ] **Step 4: Essai par Ben sur son téléphone** : il crée le jeton fine-grained (permissions de la spec), le colle dans Réglages, compare la liste à #43. Un écart est corrigé, testé et republié.
