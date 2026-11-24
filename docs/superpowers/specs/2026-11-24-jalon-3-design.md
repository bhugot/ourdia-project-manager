# Jalon 3 — décisions, cartes, avancement, lecture : conception

_24/11/2026, à valider par Ben. Complète les specs des jalons 1 et 2, dont les contraintes restent valables : aucun code tiers, CSP stricte, jamais `innerHTML`, jeton seulement vers `api.github.com`, données de test inventées._

## Intention

Inspiration : l'article de Nick Tune « Moving to HTML-based collaboration with agents » (21/11/2026) et son outil `scratch-pad` (dépôt `NTCoding/wip-skillz`). L'idée reprise : la conversation avec les agents se lit mieux comme une page structurée que comme un fil. Il y a un journal des décisions, des décisions présentées comme des cartes avec la recommandation de l'agent, un suivi d'avancement, et un résumé avec sommaire pour les longs textes. Ben a retenu les quatre idées le 24/11. Ici, la « conversation », ce sont les issues et leurs commentaires, que l'app met en forme sans rien changer au format écrit par les sessions.

## Objectifs

1. **Onglet Décisions** : le journal de toutes les réponses de Ben, sur toutes les issues.
2. **Carte de décision** : chaque question se présente comme une carte, avec son contexte et la recommandation mise en avant.
3. **Suivi d'avancement** : en tête de fiche, où en est l'issue sans lire tous les commentaires.
4. **Résumé et sommaire** : les longs comptes rendus se lisent en diagonale, et les issues citées s'aperçoivent sans quitter la page.

## Non-objectifs

- Commentaires attachés à un passage (les « inline comments » de Nick) : GitHub n'en a pas sur les issues, et un commentaire normal le remplace.
- Aucun changement du format des questions ni des issues : l'app lit ce que les sessions écrivent déjà (`.claude/docs/questions-ben.md`, gabarit `issue-pilotage`).
- Pas de nouvelle écriture : les seules restent répondre et le stand-by.
- Pas de modèle, toujours.

## Approches

Une seule raisonnable : tout est calculé par l'app à partir des issues déjà lues. Il faut une seule nouvelle lecture, à la demande, pour l'historique des décisions des issues fermées. L'autre voie serait de faire écrire par les sessions un registre des décisions (un fichier ou une issue dédiée). Elle a été écartée : il faudrait changer les conventions et toutes les skills, alors que les réponses sont déjà dans les commentaires.

## Conception

### 1. Onglet Décisions (`#/decisions`, et `#/demo/decisions`)

- Un troisième onglet en haut, à côté de Synthèse et Liste.
- **Une décision** = une question `### Q<n>` d'un commentaire `## En attente de Ben`, plus la réponse `Q<n> : …` donnée **après ce commentaire et avant la série suivante**. Ce n'est pas seulement la dernière série : toutes les séries de l'issue comptent, d'où une fonction `decisionsOf(issue)` distincte de `questionStatus`. La dernière réponse donnée l'emporte, comme dans la reprise.
- **Ligne affichée** : date de la réponse, `#N` en lien vers la fiche, titre de la question, puis la réponse en clair. La lettre est remplacée par le texte de l'option (« B. Brumeval »), et le commentaire libre suit après un tiret. Ordre : la plus récente en haut.
- **Filtre en tête** : « Sans réponse » (les questions ouvertes, toutes issues confondues, les obligatoires d'abord) et « Répondues ». Par défaut : Répondues.
- **Données** : les issues ouvertes sont déjà chargées avec leurs 100 derniers commentaires. Pour les issues fermées, l'onglet lance à son ouverture une requête GraphQL : les 50 issues fermées les plus récentes avec `comments(last: 100)`, gardée en mémoire jusqu'au prochain « Rafraîchir ». Un bandeau dit « Décisions des 50 dernières issues fermées ». Une issue plus ancienne se consulte sur GitHub.
- **En démo** : des données inventées, dont une issue avec deux séries de questions.

### 2. Carte de décision (fiche, bloc Questions)

- Chaque question de la dernière série devient une carte :
  - le titre `Q<n> — titre`, avec « peut attendre » en étiquette discrète ;
  - le **contexte** : les lignes entre le titre et les options, rendues en markdown sûr. Aujourd'hui il n'est pas affiché ;
  - les **options**, l'option qui finit par « (recommandé) » marquée d'une étiquette « recommandée » et d'un bord coloré. Le texte « (recommandé) » est retiré de l'affichage ;
  - les boutons de lettre. Celui de la recommandation porte une petite étoile, et rien n'est présélectionné.
- **« Suivre les recommandations »** : un bouton en tête du bloc, visible seulement s'il y a au moins une question sans réponse qui a une option recommandée. Il coche la recommandation de ces questions sans en envoyer aucune : Ben voit le résultat et peut changer avant « Envoyer les réponses ». C'est mon ajout pour le téléphone : une issue de cinq questions se règle en deux touches.
- Une question répondue reste une carte repliée : titre, puis « Réponse : B. Brumeval ».
- `parseQuestions` rend aussi `context` (texte) et, par option, `recommended` (booléen). Le texte de l'option reste intact dans `text`. La reconnaissance de « (recommandé) » ignore la casse et accepte « recommandée ».

### 3. Suivi d'avancement (fiche, en tête, sous les actions)

Un bloc « Où en est-on », chaque ligne omise si vide :

- **But** : le premier paragraphe du corps de l'issue, hors titres, coupé à environ 200 caractères.
- **Fini quand** : la barre `done/total` tirée des cases à cocher de la section, comme aujourd'hui, avec la liste repliable. Le bloc « Fini quand » séparé disparaît.
- **Sous-issues** : `k/n fermées` et une barre, la liste repliable avec l'état de chacune. Une sous-issue absente des données chargées compte comme « état inconnu ».
- **Dernier point d'étape** : la date et la première ligne du dernier commentaire qui n'est ni une série de questions ni une réponse de Ben, avec « voir tout » vers les commentaires plus bas.
- **Statut** : la section où l'app range l'issue (« En cours », « À trancher »…), avec le même détail que dans la liste.

Les barres sont des éléments `<progress>` natifs : rien à dessiner, et lisibles par les lecteurs d'écran.

### 4. Résumé, sommaire, aperçu

- **Long commentaire** : un commentaire est long s'il dépasse 5 paragraphes ou 1 200 caractères. Il s'affiche alors ainsi :
  - le premier paragraphe en tête, comme résumé (ce qui suit un titre `## En attente de Ben` ou `## Compte rendu` compte aussi) ;
  - un **sommaire** des titres `##` et `###` du commentaire, s'il en a au moins deux. Ce sont des boutons qui font défiler jusqu'au titre (`scrollIntoView`), et non des ancres `#…`, car le routeur utilise le hash ;
  - le reste dans un `<details>` « lire tout ».
- **Description de l'issue** : même règle, avec un sommaire des sections du gabarit (À faire, Contraintes, Fini quand).
- **Anciens commentaires** : les trois plus récents restent dépliés, les autres sont repliés sur leur date et leur première ligne.
- **Aperçu des issues citées** : dans le markdown rendu, un lien `#N` vers une issue chargée affiche au toucher une petite carte (titre, état, section, dernier point d'étape) avec un bouton « Ouvrir ». Un second toucher sur le lien, ou « Ouvrir », mène à la fiche. Toucher ailleurs ferme la carte. Une issue non chargée garde le lien direct. Au clavier, Entrée ouvre l'aperçu et Échap le ferme.

## Tests

- `decisionsOf` sur deux séries : une réponse rattachée à la bonne série, une question reposée avec le même numéro, une réponse libre sans lettre, la lettre remplacée par le texte de l'option.
- `parseQuestions` : `context`, `recommended`, « (recommandé) » absent du titre affiché mais présent dans `text`.
- « Suivre les recommandations » coche seulement les questions sans réponse qui ont une recommandation, et n'envoie rien.
- Avancement : premier paragraphe hors titres, sous-issues `k/n` dont un état inconnu, dernier point d'étape qui saute les questions et les réponses de Ben.
- Long commentaire : seuil de 5 paragraphes ou 1 200 caractères, sommaire à partir de deux titres, aucun `href` commençant par `#` autre que les routes.
- Aperçu : premier toucher ouvre la carte, second navigue, Échap ferme ; issue absente → lien direct.
- Routes : `#/decisions`, `#/demo/decisions`.
- Démo mise à jour, vérifiée au navigateur en taille mobile, sans erreur de console.

## Laissé à l'implémentation

- Les seuils exacts (200 caractères, 5 paragraphes, 1 200 caractères, 3 commentaires dépliés) peuvent bouger d'un cran si la démo le demande.
- La mise en page de la carte d'aperçu (fixe en bas d'écran sur mobile est le plus simple).
