// Ben's answers, written in the format of the questions spec (`.claude/docs/questions-ben.md`):
// `## Réponses de Ben`, then one `Q<n> : <letter> — <note>` line per answered question.

export const ANSWERS_HEADING = '## Réponses de Ben';

/** A free note on one line, unable to start or split into another `Q<n> :` answer. */
function cleanNote(note) {
  return (note || '').split(/\s+/).filter(Boolean).join(' ')
    .replace(/[,;](?=\s*Q\d+\s*[:：])/gi, ' /');
}

/** Comment body for the filled entries [{n, letter, note}], or null when nothing is filled. */
export function formatAnswers(entries) {
  const lines = [];
  for (const { n, letter, note } of entries) {
    const text = cleanNote(note);
    if (!letter && !text) continue;
    lines.push(`Q${n} : ${[letter, text].filter(Boolean).join(' — ')}`);
  }
  return lines.length ? `${ANSWERS_HEADING}\n\n${lines.join('\n')}\n` : null;
}
