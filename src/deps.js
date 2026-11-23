// Links between issues for the detail page: `apres:` lines, sub-issues, cross mentions.
import { parseAfter, mentions } from './parse.js';

const textOf = issue => [issue.body, ...issue.comments.map(c => c.body)].join('\n');

/** {after, unblocks, parent, subIssues, mentions, mentionedBy}: lists of {number, title, state}. */
export function dependencies(issue, issues, refs) {
  const loaded = new Map(issues.map(i => [i.number, i]));
  const ref = n => {
    const i = loaded.get(n);
    if (i) return { number: n, title: i.title, state: i.state };
    const r = refs.get(n);
    return { number: n, title: r?.title ?? null, state: r?.state ?? null };
  };
  const others = issues.filter(i => i.number !== issue.number);
  return {
    after: parseAfter(issue.body).map(ref),
    unblocks: others.filter(i => parseAfter(i.body).includes(issue.number)).map(i => ref(i.number)),
    parent: issue.parent ? ref(issue.parent) : null,
    subIssues: issue.subIssues.map(ref),
    mentions: mentions(textOf(issue)).filter(n => n !== issue.number).map(ref),
    mentionedBy: others.filter(i => mentions(textOf(i)).includes(issue.number)).map(i => ref(i.number)),
  };
}
