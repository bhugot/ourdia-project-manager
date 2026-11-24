// Ben's decisions: every question of every `## En attente de Ben` series of an issue, with the
// answer given after that series and before the next one (the last answer wins).
import { isAsk, parseAnswers, parseQuestions } from './questions.js';

const LETTER_RE = /^([A-Za-z])\b\.?[ \t]*(?:[—–-][ \t]*(.*))?$/;

/** « B. Brumeval — note » when the answer starts with a known letter, else the answer as typed. */
export function answerText(question, raw) {
  const m = raw.match(LETTER_RE);
  const option = m && question.options.find(o => o.letter === m[1].toUpperCase());
  if (!option) return raw;
  return `${option.letter}. ${option.label}` + (m[2] ? ` — ${m[2]}` : '');
}

export function decisionsOf(issue) {
  const out = [];
  const comments = issue.comments || [];
  comments.forEach((ask, i) => {
    if (!isAsk(ask.body)) return;
    const questions = parseQuestions(ask.body);
    const answers = new Map();
    for (const c of comments.slice(i + 1)) {
      if (isAsk(c.body)) break;
      for (const [n, a] of parseAnswers(c.body)) answers.set(n, { raw: a, at: c.createdAt });
    }
    for (const q of questions) {
      const a = answers.get(q.n);
      out.push({ issue: issue.number, title: issue.title, n: q.n, question: q.title, optional: q.optional,
        askedAt: ask.createdAt, answer: a?.raw ?? null, answerText: a ? answerText(q, a.raw) : null, answeredAt: a?.at ?? null });
    }
  });
  return out;
}

/**
 * {answered (newest first), pending (required first, then oldest ask first)}. Pending questions of
 * closed issues are left out: they went to open-questions.md when the issue was closed.
 */
export function allDecisions(issues) {
  const all = issues.flatMap(decisionsOf);
  const answered = all.filter(d => d.answer !== null).sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt));
  const open = new Set(issues.filter(i => i.state === 'OPEN').map(i => i.number));
  const pending = all.filter(d => d.answer === null && open.has(d.issue))
    .sort((a, b) => (a.optional - b.optional) || (new Date(a.askedAt) - new Date(b.askedAt)));
  return { answered, pending };
}
