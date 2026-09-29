// Very small word filter for reviews. A match does not delete anything: the review is held
// and an automatic flag goes to the admin moderation queue.
const BLOCKED = ['fuck', 'shit', 'bastard', 'bitch', 'idiot', 'stupid', 'harami', 'kutta', 'kameena', 'ghatiya', 'bakwas', 'chor', 'scam', 'fraud'];
const PATTERN = new RegExp(`\\b(${BLOCKED.join('|')})\\w*`, 'i');

export function needsModeration(text = '') {
  const m = PATTERN.exec(String(text));
  return m ? m[1].toLowerCase() : null;
}
