import type { GoalRange } from './types';
import {
  CHUNK_TRIGGER_MIN,
  CHUNK_TARGET_MIN,
  MIN_CHUNK_WORDS,
} from './types';
import { snapToSentenceEnd } from './snap';

/**
 * Split a goal range into chunks, each ~5 minutes of reading at the given WPM,
 * snapped to sentence boundaries. See §9 of specs/goal-based-reading.md.
 *
 * Returns a single chunk covering the whole range for goals ≤ 10 minutes.
 * Merges the last chunk into the previous one if it would be smaller than
 * MIN_CHUNK_WORDS.
 */
export function buildChunks(
  words: string[],
  range: GoalRange,
  wpm: number
): GoalRange[] {
  const { startWord, endWord } = clampRange(range, words.length);
  if (endWord < startWord || words.length === 0) return [];

  const totalWords = endWord - startWord + 1;
  const effectiveWpm = Math.max(60, wpm);
  const totalMin = totalWords / effectiveWpm;

  if (totalMin <= CHUNK_TRIGGER_MIN) {
    return [{ startWord, endWord }];
  }

  const targetChunkWords = Math.max(
    MIN_CHUNK_WORDS,
    Math.floor(effectiveWpm * CHUNK_TARGET_MIN)
  );
  const chunks: GoalRange[] = [];
  let cursor = startWord;
  let safety = 0;

  while (cursor <= endWord) {
    if (++safety > 1000) break; // paranoia against pathological inputs

    const proposedEnd = Math.min(cursor + targetChunkWords - 1, endWord);
    const snappedEnd = snapToSentenceEnd(words, proposedEnd, endWord);
    // Guarantee forward progress even if snap couldn't advance
    const end = Math.max(snappedEnd, cursor);
    chunks.push({ startWord: cursor, endWord: end });
    cursor = end + 1;
  }

  // Merge tail if too small
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    const lastSize = last.endWord - last.startWord + 1;
    if (lastSize < MIN_CHUNK_WORDS) {
      const prev = chunks[chunks.length - 2];
      chunks[chunks.length - 2] = {
        startWord: prev.startWord,
        endWord: last.endWord,
      };
      chunks.pop();
    }
  }

  return chunks;
}

function clampRange(range: GoalRange, totalWords: number): GoalRange {
  if (totalWords === 0) return { startWord: 0, endWord: -1 };
  const maxIndex = totalWords - 1;
  const startWord = Math.max(0, Math.min(maxIndex, range.startWord));
  const endWord = Math.max(startWord, Math.min(maxIndex, range.endWord));
  return { startWord, endWord };
}
