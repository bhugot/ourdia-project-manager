# Jalon 3 — décisions, cartes, avancement, lecture : plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** implement the milestone 3 spec: Decisions tab, decision cards, progress block, long-text reading aids and issue preview.

**Architecture:** pure functions in `src/` (tested with node:test), views build DOM with `h()` only; one new on-demand GraphQL read for closed issues.

**Tech Stack:** native ES modules, no build, `node --test tests/*.test.js`.

**Spec:** `docs/superpowers/specs/2026-11-24-jalon-3-design.md`

## Global Constraints

- No third-party code, no `innerHTML`, CSP unchanged; `h()` whitelist unchanged (no `data-*`, no `style`).
- No `href` starting with `#` other than app routes (`#/…`): the router owns the hash.
- Question format unchanged (`.claude/docs/questions-ben.md`); the app never writes a `Q<n> :` line except in `## Réponses de Ben`.
- Demo data invented (public repository).

## Review Focus

1. A question re-asked with the same number in a later series: its answer belongs to the later series only.
2. An answer letter that matches no option (or free text): shown verbatim.
3. Preview: a `#N` link to an issue not loaded keeps navigating directly; Escape closes the preview.
4. Long comment with headings in code blocks: not in the outline (outline built from parsed blocks).
5. « Suivre les recommandations » never sends and never overrides an answered question.

---

### Task 1: questions — context and recommendation; decisions

**Files:** Modify `src/questions.js`; Create `src/decisions.js`; Test `tests/questions.test.js`, `tests/decisions.test.js`.

**Interfaces — Produces:**
- `parseQuestions(body)` → `[{n, title, optional, options:[{letter, text, label, recommended}], context}]`; `label` = text without « (recommandé) ».
- `decisionsOf(issue)` → `[{issue, title, n, question, answer: string|null, answerText: string|null, answeredAt: string|null, askedAt, optional}]`, one per question of every series.
- `allDecisions(issues)` → answered ones sorted by `answeredAt` desc, then pending ones (required first).
- `answerText(question, raw)` → « B. Brumeval — note » when the letter matches an option, else `raw`.

- [ ] Tests: context lines kept, `recommended` true for « (recommandé) » / « (Recommandée) », label stripped; two series with Q1 re-asked; free answer; unknown letter; ordering.
- [ ] Run, see FAIL; implement; run, see PASS; commit.

### Task 2: route, closed-issues read, Decisions view, demo

**Files:** Modify `src/routes.js`, `src/github.js`, `src/main.js`, `src/views/common.js`, `src/demo.js`; Create `src/views/decisions.js`; Tests `tests/routes.test.js`, `tests/github.test.js`, `tests/decisionsview.test.js`.

- `parseRoute('#/decisions')` → `{name:'decisions', demo:false}`; same under `#/demo`.
- `loadClosedHistory(token, fetchFn)` → normalized issues: 50 closed, `comments(last:100)`.
- `decisionsView(ctx)`: tabs, filter buttons « Répondues » / « Sans réponse » (`ctx.decisionFilter`, `ctx.setDecisionFilter`), banner « Décisions des 50 dernières issues fermées », lines with link `#N`.
- main: `history` cache, loaded on entering the route, cleared on Rafraîchir; demo: closed issue with two series.
- [ ] TDD each; commit.

### Task 3: decision cards

**Files:** Modify `src/views/issue.js`, `app.css`; Test `tests/issueview.test.js`.

- Card: title, optional tag, context (safe markdown), options with « recommandée » tag (class `option recommended`), star on the recommended letter (`★ A`, aria-label unchanged + « recommandée »).
- « Suivre les recommandations »: sets `entry.letter` of unanswered questions having a recommendation, updates buttons, sends nothing.
- Answered card: « Réponse : » + `answerText`.
- [ ] TDD; commit.

### Task 4: progress block

**Files:** Create `src/progress.js`; Modify `src/views/issue.js`; Tests `tests/progress.test.js`, `tests/issueview.test.js`.

- `progressOf(issue, issues, sections)` → `{goal, finished (finishedWhen result|null), sub:{done,total,items:[{number,title,state}]}|null, lastNote:{createdAt, line}|null, status:{title, detail}|null}`.
- goal: first paragraph block of the body that is not a `voie:`/`apres:` header line, cut to 200 chars.
- lastNote skips asks (`isAsk`) and Ben's answers (body starts with `## Réponses de Ben` or `parseAnswers` non-empty).
- View « Où en est-on » with `<progress>`; old « Fini quand » block removed.
- [ ] TDD; commit.

### Task 5: long texts and old comments

**Files:** Create `src/reading.js`; Modify `src/views/issue.js`, `app.css`; Tests `tests/reading.test.js`, `tests/issueview.test.js`.

- `isLong(body)` (> 5 paragraph-like blocks or > 1200 chars), `outline(body)` → `[{level, text}]` for `##`/`###` headings from `parseMarkdown`, `lead(body)` → first paragraph text.
- `renderMarkdown(src, doc, {issueHref, headingIds})`: optional, headings get `id` = `h-<prefix>-<i>`.
- View: long → lead, outline buttons (`scrollIntoView`), `<details>` « lire tout »; comments beyond the 3 most recent in `<details>`; same for description.
- [ ] TDD; commit.

### Task 6: issue preview

**Files:** Create `src/views/preview.js`; Modify `src/markdown.js` (issue links get class `issue-ref`), `src/views/issue.js`, `src/views/synthesis.js`, `src/main.js`, `app.css`; Test `tests/preview.test.js`.

- `attachPreview(ctx, root)`: click on `a.issue-ref` whose number is loaded → first click prevents default and shows a fixed card (title, state, section, last note, « Ouvrir », « Fermer »); second click on the same link navigates; Escape and outside click close.
- [ ] TDD; commit.

### Task 7: verify and ship

- [ ] Full suite; demo at mobile size, no console errors; fresh review (`relecteur-neuf`); fix; push; check Pages.
