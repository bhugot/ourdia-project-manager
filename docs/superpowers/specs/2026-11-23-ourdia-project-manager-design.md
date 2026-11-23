# Ourdia Project Manager — conception

_23/11/2026. Validée par Ben le 23/11/2026._

## Intention

Ben pilote le MMO Ourdia par des issues GitHub de `bhugot/ourdia` (dépôt **privé**) : des sessions Claude, lancées à la main, prennent les issues, commentent leur avancement et posent des questions à Ben en markdown. Ben veut suivre tout cela **depuis son téléphone**, à jour à chaque ouverture, sans serveur et sans payer de session Claude pour du travail mécanique. Le tableau de bord actuel (issue #43, réécrit toutes les 2 h par une GitHub Action, `tools/automation/dashboard.py`) reste en place ; l'app vient **à côté**, plus fraîche et plus détaillée.

## Objectifs

- **Jalon 1 (ce document)** : un tableau de bord en lecture seule, publié sur GitHub Pages, qui marche sur le téléphone de Ben.
  - Liste des issues par état : À trancher, Bloqué, En cours, En file, Fini depuis 24 h, plus une ligne PC.
  - Fiche d'une issue : corps rendu, avancement (cases du « Fini quand »), points d'étape (commentaires), liens de session, dépendances, questions en attente.
- **Jalon 2 (plus tard, hors de ce document)** : formulaire de réponse aux questions, qui poste `## Réponses de Ben` + lignes `Q<n> : <lettre>` en commentaire.

## Non-objectifs (jalon 1)

- Répondre aux questions, commenter, changer un label, fermer une issue : aucune écriture.
- Notifications : déjà envoyées par les sessions (outil PushNotification de Claude, skill `executer-issue`). Une page sans serveur ne peut pas pousser.
- Graphe des dépendances dessiné : une liste suffit (décidé avec Ben).
- Plusieurs dépôts, usage hors ligne, comptes multiples.
- Remplacer #43 ou modifier quoi que ce soit dans `bhugot/ourdia` ou dans le workspace.

## Anti-objectifs (échec même si ça « marche »)

- Le jeton fuit : script tiers, jeton dans une URL, dans un log, ou envoyé ailleurs qu'à `api.github.com`.
- Un commentaire d'issue exécute du code dans la page (XSS) ou charge une ressource externe (image de pistage).
- L'app et #43 classent une issue différemment sans que ce soit voulu.

## Contraintes

- Page statique servie par GitHub Pages depuis un dépôt **public** `bhugot/ourdia-project-manager` (Pages sur dépôt privé exigerait un abonnement payant). Le code est public ; les données ne sont lues qu'avec le jeton de Ben. Dossier local `C:\Repos\Ourdia.ProjectManager`.
- **Aucun code tiers** : ni CDN, ni dépendance npm dans la page. Pas d'étape de construction : les fichiers du dépôt sont servis tels quels.
- **CSP stricte** dans une balise `<meta>` (Pages ne permet pas d'en-têtes) : `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src https://api.github.com; manifest-src 'self'; base-uri 'none'; form-action 'none'`. Pas de script ni de style en ligne.
- **Jeton** : fine-grained, limité à `bhugot/ourdia`, permissions *Issues : lecture*, *Contents : lecture* (pour la date du dernier commit de la branche `pilotage`), *Metadata : lecture* (imposée). Saisi une fois, gardé dans le `localStorage` du téléphone ; un écran Réglages permet de le remplacer ou de l'oublier. Le jalon 2 demandera *Issues : écriture*.
- Interface en français ; code, noms de fichiers et identifiants en anglais (convention du projet).
- Les questions suivent **à la lettre** la spec `.claude/docs/questions-ben.md` du workspace (recopiée ci-dessous dans ses points utiles).

## Approches envisagées

| | Approche | Pour | Contre |
|---|---|---|---|
| **A (retenue)** | HTML/CSS/JS écrits à la main, modules ES, sans construction ; API GraphQL ; rendu markdown maison qui construit le DOM | Zéro code tiers, CSP triviale, rien à entretenir, sécurité vérifiable à la lecture | Markdown partiel (tableaux et HTML brut affichés en texte) |
| B | Vite + Preact + TypeScript, `marked` + `DOMPurify` embarqués, Action de construction | Markdown complet, typage | Dépendances npm dans une page qui tient le jeton ; chaîne de construction à entretenir |
| C | Comme A, mais API REST | Requêtes identiques à `dashboard.py` | Une requête par issue pour les commentaires : 10 à 20 appels à chaque ouverture, lent sur mobile |

Ben a choisi **A** le 23/11, parce que la contrainte « pas de code tiers, CSP stricte » prime.

## Conception

### Fichiers

```
index.html          page unique, balise CSP, liens vers les modules
app.css
manifest.webmanifest + icônes   installation sur l'écran d'accueil
src/
  main.js           routage par fragment (#/ liste, #/issue/57, #/settings), rafraîchissement
  github.js         appels GraphQL (fetch vers https://api.github.com/graphql)
  questions.js      portage de tools/automation/questions.py
  classify.js       portage des règles de dashboard.py (sections, détails)
  markdown.js       rendu markdown sûr → nœuds DOM
  views/*.js        liste, fiche, réglages
tests/              node --test (Node intégré, sans dépendance)
```

### Données

Une ouverture (ou un tap sur « Rafraîchir ») déclenche :

1. **Requête principale GraphQL** sur `bhugot/ourdia` :
   - issues ouvertes (`states: OPEN`, 50 par page, pagination si plus) : numéro, titre, corps, labels, assignés, `createdAt`, `updatedAt`, sous-issues et parent (`subIssues`, `parent`), et leurs 100 derniers commentaires (`body`, `createdAt`). Coût : 50 × 100 = 5 000 nœuds, très loin de la limite de 500 000 ; il y a 7 issues ouvertes aujourd'hui ;
   - issues fermées les plus récemment mises à jour (`states: CLOSED`, tri `UPDATED_AT` décroissant, 20), mêmes champs mais seulement le dernier commentaire, plus `closedAt` ; filtrées ensuite sur `closedAt` dans les 24 h ;
   - date du dernier commit de `refs/heads/pilotage`.
2. **Requête complémentaire** (alias `i55: issue(number: 55) { number title state }`) pour l'état des issues citées par `apres:`, sous-issue/parent ou en mention et absentes de la requête principale.
3. **Fiche d'une issue fermée** : ses commentaires complets sont lus à l'ouverture de la fiche (requête à la demande).

Vérifié le 23/11 avec le jeton de `gh` : `subIssues`, `parent`, `closedAt` et `ref(qualifiedName: "refs/heads/pilotage")` répondent sans en-tête particulier. **Première étape du plan** : rejouer la requête avec un jeton fine-grained aux permissions ci-dessus ; si la ligne PC échoue, elle passe par l'API REST (`commits?sha=pilotage&per_page=1`) ; si les sous-issues échouent, on les retire.

« Débloque » et « mentionnée dans » portent sur les issues chargées (ouvertes et fermées récentes) : une issue fermée depuis longtemps qui en cite une autre n'est pas vue, et c'est accepté.

L'issue portant le label `tableau-de-bord` (#43) est exclue des listes. Pas de cache entre ouvertures au jalon 1 : on affiche « chargement », puis la liste avec l'heure de lecture (heure de Paris, `Intl` avec `Europe/Paris`).

### Classement (identique à `dashboard.py`)

Noms tirés de `common.py` : `OWNER = "bhugot"`, labels cloud du plus faible au plus fort `cloud`, `cloud-plus`, `cloud-fort` (modèles Sonnet, Opus, Fable), label historique `en-cours`.

- **Prise** : assignée à `bhugot` ou label `en-cours`.
- **À trancher** : label `attente-ben` (prioritaire sur tout le reste). Détail : questions requises sans réponse (`Q2 Taille des groupes ; Q3 …`, avec `(1/3 répondues)` s'il y a des réponses), ou « réponses reçues, à relancer en <modèle> » (ou « (pilotage) »), ou « facultatives » si seules des questions « (peut attendre) » restent, ou, sans question `### Q<n>`, le début du dernier commentaire.
- **En cours / Bloqué** : prise, ou label cloud et dernier commentaire commençant par « Prise par l'exécutant ». Bloquée si le `createdAt` du dernier commentaire, quel qu'en soit l'auteur (à défaut le `updatedAt` de l'issue), date de plus de 3 h. Les modifications de commentaire ne comptent pas, comme dans `dashboard.py`.
- **En file** : un label d'exécution (`cloud*` ou `pilotage`) sans prise. Détail : le label, et « attend #N » pour chaque dépendance `apres:` encore ouverte.
- **Fini depuis 24 h** : `closedAt` de moins de 24 h, 10 au plus, plus récentes d'abord ; détail : début du dernier commentaire.
- Une issue ouverte sans label d'exécution ni `attente-ben` n'apparaît dans aucune section de #43 ; l'app la montre dans une section **Autres** repliée, pour ne rien cacher (écart volontaire, sans effet sur le classement des autres).
- **PC** : date du dernier commit de `pilotage` ; « PC inactif ? » si plus de 2 h et qu'une issue `pilotage` est en file.

**Écart voulu avec `dashboard.py`** : `parse_after` ne lit que la première ligne `apres:` ; l'app lit **toutes** les lignes `apres:` du corps (l'issue #57 en a deux). La correction du script Python est une tâche à part.

### Questions (portage de `questions.py`)

- Un commentaire est une série de questions s'il **commence** (après espaces) par `## En attente de Ben`.
- Questions : titres `### Q<n>` suivis de `—`, `–`, `:`, `-` ou `.` puis du titre ; « (peut attendre) » en fin de titre la rend facultative.
- Options affichées dans la fiche : lignes `- **A.** …` sous chaque question (ajout de l'app, `questions.py` ne les lit pas).
- Réponses : lignes `Q<n> :` (casse indifférente, deux-points obligatoires, `：` accepté, puce et gras tolérés) des commentaires postés **après** la dernière série ; `Q1 : A, Q2 : B` sur une ligne est découpé ; une ligne `Q3 :` vide ne compte pas ; seules comptent les réponses aux numéros posés dans la dernière série.
- Les tests de `questions.js` et `classify.js` reprennent les cas de `ourdia/tests/test_automation.py` (questions et tableau de bord), réécrits à la main en JavaScript.
- **Le dépôt de l'app est public, celui du jeu est privé** : les données de test sont inventées (titres, corps, liens de session factices). Aucun contenu réel d'issue n'est copié dans le dépôt de l'app. La concordance avec #43 se vérifie à la main sur le téléphone, pas par un test qui ferait tourner `dashboard.py`.

### Fiche d'une issue

De haut en bas :
- titre, numéro, labels, état, lien « Ouvrir dans GitHub » ;
- **Questions en attente** (si une série existe) : chaque question, ses options, la réponse reçue ou « sans réponse » ;
- **Avancement** : cases `- [ ]` / `- [x]` de la section `## Fini quand` du corps, compteur « 2/5 ». Si la section n'a pas de cases (cas actuel, des puces simples), ses lignes sont affichées sans compteur ;
- **Sessions** : liens `https://claude.ai/code/session_…` trouvés dans les commentaires, hors commentaires barrés (commençant par `~~`), les plus récents d'abord ;
- **Dépendances** : « attend » (lignes `apres:`), « débloque » (issues dont `apres:` cite celle-ci), « sous-issues » / « parent », « mentionnée dans » et « mentionne » (`#N` du corps et des commentaires), chacune avec son état ; un tap ouvre la fiche liée ;
- **Corps** rendu ;
- **Points d'étape** : tous les commentaires, du plus récent au plus ancien, avec leur heure.

### Rendu markdown sûr

`markdown.js` produit des nœuds DOM avec `createElement` et `textContent` ; jamais `innerHTML` sur du contenu venu de GitHub. Pris en charge : titres, paragraphes, listes (puces, numérotées, cases), gras, italique, barré, code en ligne et blocs, citations, règles, liens. Les liens ne sont actifs que pour `https:` et `http:` (`rel="noopener noreferrer"`, `target="_blank"`) ; `#N` devient un lien interne vers la fiche. Les images deviennent un lien texte (la CSP bloque de toute façon les images externes). Les commentaires HTML `<!-- … -->` sont masqués (les sessions et #43 s'en servent comme marqueurs). Tableaux et autre HTML brut : affichés comme texte.

### Écrans et usage mobile

- Liste : une carte par issue (numéro, titre court, détail, puce de session), sections dans l'ordre À trancher, Bloqué, En cours, En file, Fini, Autres, PC ; compteur par section ; bouton Rafraîchir et heure de lecture en haut.
- Premier lancement ou jeton invalide (401) : écran Réglages avec le champ du jeton, un lien vers la page GitHub de création de jeton et la liste des permissions à cocher.
- Expiration du jeton : lue dans l'en-tête de réponse `github-authentication-token-expiration` ; date affichée dans Réglages, bandeau d'alerte en haut de la liste à moins de 14 jours.
- Erreurs réseau ou limite d'API : message clair, bouton Réessayer.
- Thème clair/sombre selon le téléphone ; lisible d'une main, cibles tactiles d'au moins 44 px.

### Publication

GitHub Pages sur la branche `main`, racine du dépôt. URL attendue : `https://bhugot.github.io/ourdia-project-manager/`. Une GitHub Action lance `node --test` à chaque push.

## Fini quand (jalon 1)

- [ ] Ben a validé cette spec.
- [ ] Dépôt public créé et Pages activé, après un feu vert explicite de Ben dans la conversation (la session le crée elle-même avec `gh`).
- [ ] Tests verts (`node --test`) : questions, classement, `apres:` multiples, rendu markdown (dont un commentaire piégé `<script>` / `javascript:`).
- [ ] Sur le téléphone de Ben : jeton saisi une fois, la liste s'affiche, son classement concorde avec #43 au même moment (à l'écart « Autres » près), une fiche montre questions, sessions et dépendances.

## Laissé au constructeur

- Ordre des cartes dans une section, mise en page fine, icônes.
- Nombre exact d'éléments par requête et pagination si un jour plus de 100 issues ouvertes.
- Ajout ou non d'un service worker (pas exigé : le manifeste suffit pour l'écran d'accueil).
