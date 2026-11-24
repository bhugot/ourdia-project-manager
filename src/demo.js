// Invented board for the demo mode (`#/demo`). This repository is public: nothing here comes
// from bhugot/ourdia.

const DEMO_ASK = `## En attente de Ben

Fait : brouillon du système de saisons.

### Q1 — Durée d'une saison
Change le rythme des quêtes saisonnières.

- **A.** Une semaine réelle (recommandé)
- **B.** Un mois réel
- **C.** Autre (préciser)

### Q2 — Nom de la première saison (peut attendre)
- **A.** La Brume
- **B.** Autre (préciser)

### Q3 — Météo partagée entre régions
- **A.** Oui
- **B.** Autre (préciser)`;

export function demoBoard(now = new Date()) {
  const ago = (hours, minutes = 0) => new Date(now - (hours * 60 + minutes) * 60000).toISOString();
  const c = (body, hours, minutes = 0) => ({ body, createdAt: ago(hours, minutes) });
  const issue = (number, title, labels, extra = {}) => ({
    number, title, body: '', state: 'OPEN', labels, assignees: [], createdAt: ago(72), updatedAt: ago(0, 5),
    closedAt: null, comments: [], commentsComplete: true, parent: null, subIssues: [], ...extra,
  });
  const issues = [
    issue(112, 'Choisir le rythme des saisons', ['attente-ben', 'cloud-plus', 'domain:seasons'], {
      body: 'voie: design\n\nProposer le rythme des saisons du monde.\n\n## Fini quand\n- [x] Brouillon dans le GDD\n- [ ] Réponses de Ben reportées',
      comments: [c("Prise par l'exécutant cloud — session : https://claude.ai/code/session_DEMO0001", 5), c(DEMO_ASK, 2), c('Q1 : A', 1)],
    }),
    issue(120, 'Écrire le générateur de météo', ['cloud', 'zone:server'], {
      assignees: ['bhugot'],
      body: 'voie: serveur\napres: #112\n\nGénérer la météo par région.\n\n## Fini quand\n- [x] Modèle de données\n- [x] Tests du tirage\n- [ ] Branchement sur les saisons\n- [ ] Compte rendu',
      comments: [c('Prise par Sonnet — session : https://claude.ai/code/session_DEMO0002', 2), c('Point d\'étape : modèle et tests faits (`a1b2c3d`), reste le branchement.', 0, 40)],
      subIssues: [121],
    }),
    issue(121, 'Brancher la météo sur les saisons', ['cloud'], { parent: 120, body: 'apres: #120\napres: #112' }),
    issue(122, 'Relire le système de factions', ['cloud', 'zone:design'], {
      assignees: ['bhugot'],
      comments: [c('Prise par Sonnet — session : https://claude.ai/code/session_DEMO0003', 6), c('Relecture lancée.', 5)],
    }),
    issue(130, 'Générer les textures de la forêt', ['pilotage', 'zone:asset'], { body: 'voie: assets\napres: #99\n\nVoir aussi #120.' }),
    issue(140, 'Idée : marchés itinérants', ['zone:design'], {
      body: 'Une note libre, avec du HTML qui doit rester du texte : <script>alert(1)</script> <img src=x onerror=alert(1)>\n\nEt un lien piégé : [cliquer](javascript:alert(1)).',
    }),
    issue(150, 'Prototype de navires', ['cloud-plus', 'stand-by'], { body: 'Mise en pause en attendant le moteur de physique.' }),
    issue(108, 'Corriger le chargement des cartes', ['cloud'], {
      state: 'CLOSED', closedAt: ago(3), commentsComplete: true,
      comments: [c('Fini : correction poussée (`9f8e7d6`), tests verts. Session : https://claude.ai/code/session_DEMO0004', 3)],
    }),
  ];
  return {
    issues,
    states: new Map([[99, 'CLOSED']]),
    refs: new Map([[99, { title: 'Installer le générateur de textures', state: 'CLOSED' }]]),
    pilotageDate: ago(3, 20),
    warnings: [],
    tokenExpiry: null,
  };
}

const DEMO_OLD_ASK = `## En attente de Ben

### Q1 — Taille des groupes de PNJ
Fixe combien de PNJ suivent une même routine.

- **A.** Trois (recommandé)
- **B.** Cinq
- **C.** Autre (préciser)

### Q2 — Nom du premier village
- **A.** Brume (recommandé)
- **B.** Autre (préciser)`;

const DEMO_SECOND_ASK = `## En attente de Ben

Fait : routines branchées.

### Q1 — Taille des groupes, reposée
Trois donne des places trop vides.

- **A.** Quatre (recommandé)
- **B.** Autre (préciser)`;

/** Closed issues with all their comments, as the Decisions tab loads them. */
export function demoHistory(now = new Date()) {
  const ago = hours => new Date(now - hours * 3600000).toISOString();
  const c = (body, hours) => ({ body, createdAt: ago(hours) });
  const closed = (number, title, comments, closedHours) => ({
    number, title, body: '', state: 'CLOSED', labels: ['cloud'], assignees: [], createdAt: ago(200), updatedAt: ago(closedHours),
    closedAt: ago(closedHours), comments, commentsComplete: true, parent: null, subIssues: [],
  });
  return [
    closed(108, 'Corriger le chargement des cartes', [c('Fini : correction poussée (`9f8e7d6`), tests verts.', 3)], 3),
    closed(95, 'Routines des PNJ', [
      c(DEMO_OLD_ASK, 100), c('## Réponses de Ben\n\nQ1 : A\nQ2 : B — Brumeval', 96),
      c(DEMO_SECOND_ASK, 60), c('Q1 : A', 58), c('Fini : groupes de quatre, village de Brumeval.', 50),
    ], 50),
  ];
}
