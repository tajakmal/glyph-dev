/**
 * Sentence-boundary snapping for goal ranges.
 *
 * Operates on the raw `words: string[]` array produced by `tokenize.ts`.
 * A word "ends a sentence" if its last non-closing character is `.`, `!`, or `?`
 * — matching the heuristic used by `buildTokens` in `useSpeedReader.ts`.
 */

const SENTENCE_END = /[.!?]["')\]]?$/;

export function endsSentence(word: string): boolean {
  return SENTENCE_END.test(word);
}

/**
 * Walk backward to the start of the current sentence.
 * Returns the index of the first word whose previous word ended a sentence
 * (or 0 if we hit the start of the document).
 */
export function snapToSentenceStart(words: string[], i: number): number {
  if (words.length === 0) return 0;
  let cur = Math.max(0, Math.min(words.length - 1, i));
  while (cur > 0 && !endsSentence(words[cur - 1])) {
    cur -= 1;
  }
  return cur;
}

/**
 * Walk forward to the end of the current sentence, clamped at `hardMax`.
 * Returns the first index at-or-after `i` whose word ends a sentence,
 * or `hardMax` if none is found before the hard cap.
 */
export function snapToSentenceEnd(
  words: string[],
  i: number,
  hardMax: number
): number {
  if (words.length === 0) return 0;
  const cap = Math.min(hardMax, words.length - 1);
  let cur = Math.max(0, Math.min(cap, i));
  while (cur < cap && !endsSentence(words[cur])) {
    cur += 1;
  }
  return Math.min(cur, cap);
}
