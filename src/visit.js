// Date of the previous visit, for the summary: kept 30 days at most, 24 h ago on a first visit.
const DAY = 24 * 3600 * 1000;

export function sinceFrom(stored, now) {
  const previous = Number(stored);
  return new Date(previous > 0 && now - previous < 30 * DAY ? previous : now - DAY);
}
