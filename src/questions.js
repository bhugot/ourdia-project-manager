// Questions for Ben, written in markdown in issue comments.
// Port of tools/automation/questions.py (bhugot/ourdia); format spec: .claude/docs/questions-ben.md
// of the workspace. Sessions and Ben share one GitHub account, so answers are told apart by
// format only: sessions never start a line with `Q<n> :`.

export const ASK_HEADING = '## En attente de Ben';

const QUESTION_RE = /^###[ \t]*Q(\d+)\b[ \t]*[—–:\-.]?[ \t]*(.*?)[ \t]*$/gim;
const ANSWER_RE = /^[ \t]*(?:[-*][ \t]*)?\**Q(\d+)\**[ \t]*[:：][ \t]*(\S.*?)[ \t]*$/gim;
const OPTIONAL_RE = /[ \t]*\(peut attendre\)[ \t.]*$/i;
const SAME_LINE_RE = /[ \t]*[,;][ \t]*(?=Q\d+[ \t]*[:：])/gi;
const OPTION_RE = /^[ \t]*[-*][ \t]*\*\*([A-Z])\.\*\*[ \t]*(.*?)[ \t]*$/gm;

export function isAsk(body) {
  return (body || '').trimStart().startsWith(ASK_HEADING);
}

/** Questions of an `## En attente de Ben` comment: [{n, title, optional, options}]. */
export function parseQuestions(body) {
  const text = body || '';
  const matches = [...text.matchAll(QUESTION_RE)];
  return matches.map((m, i) => {
    const n = Number(m[1]);
    const optional = OPTIONAL_RE.test(m[2]);
    const title = m[2].replace(OPTIONAL_RE, '').replace(/[ .]+$/, '') || `question ${n}`;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const section = text.slice(m.index + m[0].length, end);
    const options = [...section.matchAll(OPTION_RE)].map(o => ({ letter: o[1], text: o[2] }));
    return { n, title, optional, options };
  });
}

/** Map n → answer text from `Q<n> : …` lines (`Q1 : A, Q2 : B` on one line is split). */
export function parseAnswers(body) {
  const text = (body || '').replace(SAME_LINE_RE, '\n');
  return new Map([...text.matchAll(ANSWER_RE)].map(m => [Number(m[1]), m[2]]));
}

/**
 * Questions of the last ask and the answers given after it, or null when there is no ask
 * (or the last one holds no `### Q<n>` question). `pending` lists required questions without answer.
 */
export function questionStatus(comments) {
  let last = -1;
  comments.forEach((c, i) => { if (isAsk(c.body)) last = i; });
  if (last < 0) return null;
  const questions = parseQuestions(comments[last].body);
  if (!questions.length) return null;
  const asked = new Set(questions.map(q => q.n));
  const answers = new Map();
  for (const c of comments.slice(last + 1)) {
    for (const [n, a] of parseAnswers(c.body)) if (asked.has(n)) answers.set(n, a);
  }
  const pending = questions.filter(q => !q.optional && !answers.has(q.n)).map(q => q.n);
  return { questions, answers, pending };
}
