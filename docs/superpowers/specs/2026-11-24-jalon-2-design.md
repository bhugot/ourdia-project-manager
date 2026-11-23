# Jalon 2 — synthèse, réponses, stand-by : conception

_24/11/2026, à valider par Ben. Complète la spec du jalon 1 (`2026-11-23-ourdia-project-manager-design.md`), dont les contraintes restent valables : aucun code tiers, CSP stricte, jamais `innerHTML`, jeton seulement dans l'en-tête `Authorization` vers `api.github.com`, données de test inventées._

## Intention

Le jalon 1 tourne sur le téléphone de Ben (validé le 24/11). Ben veut maintenant **agir** depuis la fiche d'une issue (répondre aux questions, mettre en stand-by) et ouvrir l'app sur une **synthèse** qui se lit comme les récaps de Claude, sans payer de modèle.

## Objectifs

1. **Synthèse** : nouvel écran d'ouverture, en texte.
2. **Répondre aux questions** depuis la fiche.
3. **Stand-by** : ranger une issue et la ressortir depuis la fiche.

## Non-objectifs

- Aucun appel à un modèle (pas d'API Claude, pas d'artifact claude.ai inclus) : choix A de Ben le 24/11.
- Pas d'autres actions sur la fiche (Ben : « sur la fiche c'est tout »). Pas d'action depuis la liste.
- Arrêter une session en cours : un label ne le peut pas ; le stand-by range, il n'interrompt pas.
- Modifier les conventions du workspace ou `dashboard.py` : tâche à part (voir la fin).

## Approches

Une seule sensée : la même app, écritures par l'API REST de GitHub (`POST …/issues/N/comments`, `POST …/issues/N/labels`, `DELETE …/issues/N/labels/stand-by`), plus simple que les mutations GraphQL qui exigent les identifiants internes. Pour la synthèse, Ben a choisi le calcul par l'app et les comptes rendus des sessions (A) plutôt qu'une synthèse rédigée par l'API Claude dans une GitHub Action (B, payante) ou un artifact claude.ai inclus (C, privé, régénéré par une session payante, inclusion probablement bloquée).

## Conception

### Synthèse (écran d'ouverture `#/`, la liste passe en `#/list`)

- **« Depuis ta dernière visite »** : la date de la visite précédente est lue dans `localStorage` (`opm.lastVisit`) au démarrage de l'app, puis remplacée par l'heure du démarrage ; elle reste fixe tant que la page est ouverte. Première visite : « depuis 24 h ».
- **Phrases calculées**, dans cet ordre, chacune omise si vide, avec les numéros en liens vers les fiches :
  - « N questions t'attendent : #12 (durée des saisons), … » — issues de « À trancher » qui ont des questions sans réponse ;
  - « Réponses reçues, à relancer : #12 en Opus » ;
  - « Bloquées : #57 depuis 4 h » ;
  - « Finies depuis ta dernière visite : #108, #112 » ;
  - « En cours : #120, #122 » ; « En file : 3 issues » ;
  - « PC inactif depuis 3 h » si `pc.idle` ;
  - si rien n'a bougé : « Rien de nouveau depuis ta dernière visite. »
- **Comptes rendus** : pour chaque issue de « À trancher », « Bloqué », « En cours » et « Fini depuis 24 h », une carte avec le titre, le temps écoulé et le **dernier commentaire** (le texte écrit par la session), rendu en markdown sûr et coupé à environ 400 caractères avec « … lire la suite » vers la fiche. Une pastille « nouveau » marque un commentaire postérieur à la dernière visite.
- En haut, un lien « Liste complète » vers `#/list`.

### Répondre aux questions (fiche)

- Sous chaque question **sans réponse** de la dernière série : une rangée de boutons, un par lettre proposée (A, B, C…), un seul choisi à la fois, et un champ de commentaire libre facultatif.
- Bouton **« Envoyer les réponses »**, actif dès qu'une question est remplie. Une confirmation montre le texte exact, puis l'app poste un commentaire :

  ```markdown
  ## Réponses de Ben

  Q1 : A
  Q3 : B — trois saisons
  ```

  Ligne : `Q<n> : <lettre>` et ` — <commentaire>` s'il y en a un ; une question avec seulement un commentaire donne `Q<n> : <commentaire>` (réponse libre, admise par la spec des questions). Seules les questions remplies partent ; on peut répondre en plusieurs fois.
- Le commentaire ne contient aucune autre ligne commençant par `Q<n> :`. Le texte libre de Ben est mis sur une seule ligne (retours à la ligne remplacés par des espaces) pour qu'il ne crée pas de fausse ligne de réponse.
- Le label `attente-ben` n'est pas touché : la session qui reprend l'issue le retire (règle du workspace). Après l'envoi, l'app recharge et la carte affiche « réponses reçues, à relancer en <modèle> ».
- Le formulaire de réponse est **un test** : la chaîne produite, relue par `parseAnswers`, redonne exactement les réponses saisies.

### Stand-by (fiche et liste)

- Bouton **« Mettre en stand-by »** (pose le label `stand-by`) ou **« Reprendre »** (le retire), avec confirmation.
- Classement : une issue ouverte portant `stand-by` va dans une section repliée **« En stand-by »** et dans aucune autre, même avec `attente-ben` ; la synthèse ne la cite pas.

### Écritures et jeton

- `POST`/`DELETE` vers `https://api.github.com/repos/bhugot/ourdia/…`, mêmes en-têtes qu'en lecture plus `Accept: application/vnd.github+json`.
- 403 ou 404 sur une écriture : message « Ce jeton ne peut pas écrire » avec la marche à suivre (modifier le jeton existant sur GitHub, Issues en lecture et écriture ; sinon en créer un nouveau via le lien prérempli). Le lien prérempli des Réglages passe à `issues=write`.
- Après chaque écriture réussie : rechargement complet.

## Fini quand

- [ ] Ben a validé ce document.
- [ ] Tests verts : texte de la synthèse (cas vide, première visite, chaque phrase), format des réponses relu par `parseAnswers`, classement `stand-by`, écritures (URL, méthode, corps, 403).
- [ ] Relecture neuve, puis publication.
- [ ] Sur le téléphone de Ben : la synthèse s'ouvre, une réponse postée apparaît dans l'issue et fait passer la carte à « réponses reçues », un stand-by puis une reprise fonctionnent.

## Hors de cette app (tâche à part)

- Créer le label `stand-by` dans `bhugot/ourdia`.
- `CLAUDE.md` du workspace et skill `executer-issue` : une session ne prend pas une issue `stand-by`.
- `dashboard.py` (#43) : section « En stand-by » ; et lecture de toutes les lignes `apres:` (écart connu).

## Laissé au constructeur

Mise en page fine, libellés exacts des pastilles, ordre des cartes de comptes rendus (proposé : À trancher, Bloqué, En cours, Fini).
