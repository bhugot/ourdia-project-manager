# Jalon 2 — synthèse, réponses, stand-by : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ouvrir l'app sur une synthèse en texte, et permettre depuis la fiche de répondre aux questions et de mettre une issue en stand-by.

**Architecture:** Fonctions pures testées (`synthesis.js`, `answers.js`, classement `stand-by`, écritures REST dans `github.js`), puis vues. En mode démo, les écritures modifient le tableau en mémoire pour pouvoir tout essayer sans jeton.

**Tech Stack:** inchangée (JS sans construction, `node --test`).

**Spec:** `docs/superpowers/specs/2026-11-24-jalon-2-design.md` (et celle du jalon 1 pour les contraintes).

## Global Constraints

- Contraintes du jalon 1 inchangées (aucun code tiers, CSP stricte, jamais `innerHTML`, jeton seulement dans `Authorization` vers `api.github.com`, données de test inventées).
- Label du stand-by : `stand-by`. Titre du commentaire de réponses : `## Réponses de Ben`. Clé de visite : `opm.lastVisit`.
- Écritures REST : `https://api.github.com/repos/bhugot/ourdia/issues/<n>/comments` (POST `{body}`), `…/issues/<n>/labels` (POST `{labels: ['stand-by']}`), `…/issues/<n>/labels/stand-by` (DELETE).

## Review Focus

1. Texte libre de Ben contenant un retour à la ligne puis `Q2 : A` : ne doit pas créer de fausse réponse (Task 2).
2. Jeton en lecture seule : une écriture renvoie 403 → message clair, rien de cassé (Task 3).
3. Issue `stand-by` avec `attente-ben` : seulement dans « En stand-by », absente de la synthèse (Tasks 1 et 4).
4. Première visite (pas de `opm.lastVisit`) : synthèse « depuis 24 h » (Task 4).
5. Double tap sur « Envoyer » : un seul commentaire (bouton désactivé pendant l'envoi, Task 5).

---

### Task 1: Classement `stand-by`
**Files:** Modify `src/classify.js`, `tests/classify.test.js`
- Produces: section `standby` ajoutée à `SECTIONS` après `other` (`['standby', 'En stand-by']`) ; `STANDBY_LABEL = 'stand-by'`.
- [ ] Test : issue `['attente-ben', 'stand-by']` → dans `standby` (détail vide) et dans aucune autre section ; issue `['cloud', 'stand-by']` assignée → `standby`. RED, puis implémenter (test avant `attente-ben`), GREEN, commit.

### Task 2: Format des réponses
**Files:** Create `src/answers.js`, `tests/answers.test.js`
- Produces: `formatAnswers(entries: Array<{n: number, letter: string|null, note: string}>) -> string|null` (null si aucune entrée remplie).
- [ ] Tests : `[{n:1,letter:'A',note:''},{n:3,letter:'B',note:'trois saisons'}]` → `'## Réponses de Ben\n\nQ1 : A\nQ3 : B — trois saisons\n'` ; note seule → `Q2 : note` ; entrée vide ignorée ; note `'oui\nQ2 : A'` → une seule ligne et `parseAnswers` du résultat ne contient que la clé posée ; aller-retour `parseAnswers(formatAnswers(x))` égal aux saisies. RED, implémenter, GREEN, commit.

### Task 3: Écritures GitHub
**Files:** Modify `src/github.js`, `tests/github.test.js`
- Produces: `postComment(token, n, body, fetchFn)`, `addLabel(token, n, label, fetchFn)`, `removeLabel(token, n, label, fetchFn)` ; `class WriteError extends ApiError` (403/404) ; `newTokenUrl()` avec `issues=write`.
- [ ] Tests : URL, méthode, corps JSON, en-têtes `Authorization` et `Accept: application/vnd.github+json` ; 403 → `WriteError` ; 401 → `AuthError` ; test `newTokenUrl` mis à jour. RED, implémenter, GREEN, commit.

### Task 4: Synthèse
**Files:** Create `src/synthesis.js`, `tests/synthesis.test.js`
- Consumes: `classify` (sections), `questionStatus`.
- Produces: `summarize(board, sections, {since: Date, now: Date}) -> {lines: Array<Array<string|{issue: number}>>, reports: Array<{number, title, section, when, body, fresh: boolean}>}` — chaque ligne est une suite de morceaux texte / lien d'issue, dans l'ordre de la spec ; `reports` pour À trancher, Bloqué, En cours, Fini (dans cet ordre), `body` = dernier commentaire, `fresh` = commentaire postérieur à `since`.
- [ ] Tests : tableau vide → une ligne « Rien de nouveau depuis ta dernière visite. » ; une question en attente → ligne `1 question t'attend : #12 (Durée d'un hiver)` ; réponses reçues → `Réponses reçues, à relancer : #12 en Opus` ; bloquée → `Bloquées : #20 depuis 4 h` ; finie après `since` → `Finies depuis ta dernière visite : #1` (finie avant : absente) ; en cours / en file ; PC inactif ; issue `stand-by` absente partout ; `fresh` vrai/faux. RED, implémenter, GREEN, commit.

### Task 5: Vues et routes
**Files:** Create `src/views/synthesis.js` ; Modify `src/main.js`, `src/views/issue.js`, `src/views/list.js`, `src/views/common.js`, `src/views/settings.js`, `src/demo.js`, `app.css` ; Test `tests/issueview.test.js`
- Routes : `#/` synthèse, `#/list` liste, fiche et réglages inchangés ; mêmes routes sous `#/demo`.
- `opm.lastVisit` lu au démarrage (absent → maintenant − 24 h), puis remplacé par l'heure du démarrage.
- Fiche : formulaire de réponses (boutons lettre exclusifs, champ note, « Envoyer » désactivé tant que rien n'est rempli et pendant l'envoi, `confirm()` montrant le texte exact) ; bouton stand-by / reprendre avec `confirm()`. Après succès : rechargement. `WriteError` → bandeau « Ce jeton ne peut pas écrire » + marche à suivre.
- Démo : les écritures modifient le tableau démo en mémoire (commentaire ajouté, label posé/retiré).
- [ ] Test `issueview` : la fiche d'une issue avec questions sans réponse contient un bouton par lettre et « Envoyer les réponses » ; une issue `stand-by` montre « Reprendre ». RED, implémenter, GREEN.
- [ ] Vérifier dans le navigateur en mode démo (375 × 812) : synthèse, envoi d'une réponse (la carte passe à « réponses reçues »), stand-by puis reprise, console sans erreur. Commit.

### Task 6: Relecture neuve et publication
- [ ] Relecture neuve de la branche (agent `relecteur-neuf`), corrections avec tests, puis push et vérification de la page en ligne.
