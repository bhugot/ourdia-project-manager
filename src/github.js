// Reading bhugot/ourdia through the GitHub GraphQL API. The token only ever travels in the
// Authorization header of a request to https://api.github.com.
import { parseAfter, mentions } from './parse.js';

export const OWNER = 'bhugot';
export const REPO = 'ourdia';
const API = 'https://api.github.com';
const MAX_CITED = 100;
const MAX_ISSUE_NUMBER = 2 ** 31 - 1; // GraphQL Int

export class AuthError extends Error {
  constructor() { super('Jeton refusé'); this.name = 'AuthError'; }
}
export class ApiError extends Error {
  constructor(message, status = null) { super(message); this.name = 'ApiError'; this.status = status; }
}

const fields = withSubIssues => `number title body state createdAt updatedAt closedAt
  labels(first: 30) { nodes { name } } assignees(first: 10) { nodes { login } }
  ${withSubIssues ? 'parent { number } subIssues(first: 50) { nodes { number } }' : ''}`;

const openPart = sub => `open: issues(states: OPEN, first: 50, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes { ${fields(sub)} comments(last: 100) { nodes { body createdAt } } } }`;

export function mainQuery(withSubIssues = true) {
  return `query($after: String) { repository(owner: "${OWNER}", name: "${REPO}") {
    ${openPart(withSubIssues)}
    closed: issues(states: CLOSED, first: 20, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { ${fields(withSubIssues)} comments(last: 1) { nodes { body createdAt } } } }
    ref(qualifiedName: "refs/heads/pilotage") { target { ... on Commit { committedDate } } }
  } }`;
}

const pageQuery = sub => `query($after: String) { repository(owner: "${OWNER}", name: "${REPO}") { ${openPart(sub)} } }`;

async function request(token, fetchFn, url, init = {}) {
  const res = await fetchFn(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new ApiError(`GitHub a répondu ${res.status}`, res.status);
  return { json: await res.json(), expiry: res.headers.get('github-authentication-token-expiration') };
}

/** GraphQL call; returns {data, errors, expiry}. Throws ApiError when there is no data at all. */
async function graphql(token, fetchFn, query, variables = {}) {
  const { json, expiry } = await request(token, fetchFn, `${API}/graphql`,
    { method: 'POST', body: JSON.stringify({ query, variables }) });
  const errors = json.errors || [];
  return { data: json.data || null, errors, expiry };
}

const touchesSubIssues = errors => errors.some(e => (e.path || []).some(p => p === 'subIssues' || p === 'parent')
  || /subIssues|parent/.test(e.message || ''));

export function normalizeIssue(node, commentsComplete) {
  return {
    number: node.number, title: node.title, body: node.body || '', state: node.state,
    labels: node.labels.nodes.map(l => l.name), assignees: node.assignees.nodes.map(a => a.login),
    createdAt: node.createdAt, updatedAt: node.updatedAt, closedAt: node.closedAt || null,
    comments: node.comments.nodes.map(c => ({ body: c.body || '', createdAt: c.createdAt })),
    commentsComplete, parent: node.parent?.number ?? null, subIssues: (node.subIssues?.nodes || []).map(s => s.number),
  };
}

/** The whole board: {issues, states, refs, pilotageDate, warnings, tokenExpiry}. */
export async function loadBoard(token, fetchFn = fetch) {
  const warnings = [];
  let sub = true;
  let first = await graphql(token, fetchFn, mainQuery(true), { after: null });
  if (first.errors.length && touchesSubIssues(first.errors)) {
    sub = false;
    warnings.push('Sous-issues indisponibles avec ce jeton : elles ne sont pas affichées.');
    first = await graphql(token, fetchFn, mainQuery(false), { after: null });
  }
  const repo = first.data?.repository;
  if (!repo) throw new ApiError(first.errors.map(e => e.message).join(' ; ') || 'Réponse vide de GitHub');

  const openNodes = [...repo.open.nodes];
  let page = repo.open.pageInfo;
  while (page.hasNextPage) {
    const next = await graphql(token, fetchFn, pageQuery(sub), { after: page.endCursor });
    if (!next.data?.repository) throw new ApiError('Pagination interrompue');
    openNodes.push(...next.data.repository.open.nodes);
    page = next.data.repository.open.pageInfo;
  }
  const issues = [
    ...openNodes.filter(Boolean).map(n => normalizeIssue(n, true)),
    ...repo.closed.nodes.filter(Boolean).map(n => normalizeIssue(n, false)),
  ];

  let pilotageDate = repo.ref?.target?.committedDate ?? null;
  if (!pilotageDate) {
    try {
      const { json } = await request(token, fetchFn, `${API}/repos/${OWNER}/${REPO}/commits?sha=pilotage&per_page=1`);
      pilotageDate = json[0]?.commit?.committer?.date ?? null;
    } catch (e) {
      if (e instanceof AuthError) throw e;
    }
    if (!pilotageDate) warnings.push('Dernier commit de la branche pilotage illisible avec ce jeton.');
    else if (repo.ref === null) warnings.push('Branche pilotage lue par l\'API REST (GraphQL refusé).');
  }

  const { states, refs } = await loadCited(token, fetchFn, issues, warnings);
  return { issues, states, refs, pilotageDate, warnings, tokenExpiry: first.expiry };
}

async function loadCited(token, fetchFn, issues, warnings) {
  const loaded = new Set(issues.map(i => i.number));
  const cited = new Set();
  // Dependencies first, so the MAX_CITED cut only ever drops plain mentions.
  const structural = issues.flatMap(i => [...parseAfter(i.body), ...i.subIssues, ...(i.parent ? [i.parent] : [])]);
  const mentioned = issues.flatMap(i => [...mentions(i.body), ...i.comments.flatMap(c => mentions(c.body))]);
  for (const n of [...structural, ...mentioned]) {
    if (!loaded.has(n) && n > 0 && n <= MAX_ISSUE_NUMBER) cited.add(n);
  }
  const states = new Map();
  const refs = new Map();
  const numbers = [...cited].slice(0, MAX_CITED);
  if (!numbers.length) return { states, refs };
  const aliases = numbers.map(n => `i${n}: issue(number: ${n}) { number title state }`).join('\n');
  const { data, errors } = await graphql(token, fetchFn, `query { repository(owner: "${OWNER}", name: "${REPO}") { ${aliases} } }`);
  if (errors.length) warnings.push('Certaines issues citées sont introuvables (supprimées, pull requests ou numéros erronés).');
  for (const ref of Object.values(data?.repository || {})) {
    if (!ref) continue;
    states.set(ref.number, ref.state);
    refs.set(ref.number, { title: ref.title, state: ref.state });
  }
  return { states, refs };
}

/** All recent comments of one issue (detail page of a closed issue). */
export async function loadComments(token, number, fetchFn = fetch) {
  const { data, errors } = await graphql(token, fetchFn,
    `query($number: Int!) { repository(owner: "${OWNER}", name: "${REPO}") { issue(number: $number) { comments(last: 100) { nodes { body createdAt } } } } }`,
    { number });
  const nodes = data?.repository?.issue?.comments?.nodes;
  if (!nodes) throw new ApiError(errors.map(e => e.message).join(' ; ') || 'Commentaires illisibles');
  return nodes.map(c => ({ body: c.body || '', createdAt: c.createdAt }));
}

/** Date of the `github-authentication-token-expiration` header (`2027-01-10 12:00:00 UTC`), or null. */
export function parseExpiry(value) {
  const m = (value || '').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/);
  return m ? new Date(`${m[1]}T${m[2]}Z`) : null;
}
