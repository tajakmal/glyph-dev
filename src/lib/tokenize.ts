/**
 * Shared Tokenization and Word Index Mapping Utilities
 *
 * This module provides a single, shared tokenization and word-index mapping
 * system used by PDF reader, text reader, and speed read functionality.
 *
 * CONSISTENCY GUARANTEE:
 * All word indices across the application use these functions to ensure
 * that word 42 in the speed reader is the same word 42 in the document view.
 * This is critical for:
 * - Starting speed read at a selected word
 * - Returning to the exact word after speed reading
 * - Mapping word indices across PDF pages
 * - Text highlights and bookmarks
 *
 * DO NOT use .split(/\s+/) or similar tokenization elsewhere in the codebase.
 * Always use these shared utilities instead.
 */

/**
 * Represents the character boundaries of a word in the original text.
 * Used for mapping between character offsets and word indices.
 */
export interface WordBoundary {
  /** Start character index (inclusive) */
  start: number;
  /** End character index (exclusive) */
  end: number;
}

// =============================================================================
// Core Tokenization Functions
// =============================================================================

/**
 * Tokenize text into an array of words.
 *
 * This is the canonical tokenization function used throughout the application.
 * All other word-index operations depend on this function's behavior.
 *
 * @param text - The input text to tokenize
 * @returns Array of non-empty words
 *
 * @example
 * tokenize("  Hello   world!  ") // ["Hello", "world!"]
 * tokenize("") // []
 * tokenize("   ") // []
 */
export function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Build word boundaries (character offset ranges) for each word in the text.
 *
 * Uses the same tokenization rules as `tokenize()` to ensure consistency.
 * Each boundary marks the start and end character positions of a word
 * in the original (untrimmed) text.
 *
 * @param text - The input text to analyze
 * @returns Array of word boundaries with start/end offsets
 *
 * @example
 * buildWordBoundaries("Hello world!")
 * // [{ start: 0, end: 5 }, { start: 6, end: 12 }]
 *
 * buildWordBoundaries("  Hello   world!  ")
 * // [{ start: 2, end: 7 }, { start: 10, end: 16 }]
 */
export function buildWordBoundaries(text: string): WordBoundary[] {
  const boundaries: WordBoundary[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    boundaries.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return boundaries;
}

/**
 * Get the word index for a given character offset.
 *
 * Returns the index of the word that contains or is closest to the offset.
 * If the offset is between words (in whitespace), returns the next word.
 * If the offset is past the last word, returns the last word index.
 *
 * @param offset - Character offset in the text
 * @param boundaries - Word boundaries from buildWordBoundaries()
 * @returns Word index (0-based), or -1 if no words exist
 *
 * @example
 * const boundaries = buildWordBoundaries("Hello world");
 * getWordIndexAtOffset(0, boundaries) // 0 (in "Hello")
 * getWordIndexAtOffset(3, boundaries) // 0 (in "Hello")
 * getWordIndexAtOffset(5, boundaries) // 0 (at end of "Hello")
 * getWordIndexAtOffset(6, boundaries) // 1 (in "world")
 */
export function getWordIndexAtOffset(
  offset: number,
  boundaries: WordBoundary[]
): number {
  if (boundaries.length === 0) {
    return -1;
  }

  // Check if offset is within or before each word
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    // If offset is within this word or before its end
    if (offset < boundary.end) {
      return i;
    }
  }

  // Offset is past the last word
  return boundaries.length - 1;
}

// =============================================================================
// Text Selection Mapping
// =============================================================================

/**
 * Get the word range for a DOM text selection.
 *
 * Maps a browser Selection/Range to word indices using the provided boundaries.
 * This is used for text documents to determine which words are selected.
 *
 * @param selectionRange - Browser Range object from a text selection
 * @param boundaries - Word boundaries from buildWordBoundaries()
 * @returns Object with startWord and endWord indices (both inclusive)
 *
 * @example
 * // User selects "world" in "Hello world, how are you?"
 * // boundaries = buildWordBoundaries(text)
 * // selectionRange is the browser Range object
 * getSelectionWordRange(selectionRange, boundaries)
 * // { startWord: 1, endWord: 1 }
 */
export function getSelectionWordRange(
  selectionRange: Range,
  boundaries: WordBoundary[]
): { startWord: number; endWord: number } {
  const startOffset = selectionRange.startOffset;
  const endOffset = selectionRange.endOffset;

  const startWord = getWordIndexAtOffset(startOffset, boundaries);
  const endWord = getWordIndexAtOffset(endOffset - 1, boundaries);

  return {
    startWord: Math.max(0, startWord),
    endWord: Math.max(0, endWord),
  };
}

/**
 * Get the text content of a range of words.
 *
 * Useful for extracting the actual text from a word range.
 *
 * @param text - The original text
 * @param startWord - Start word index (0-based)
 * @param endWord - End word index (0-based, inclusive)
 * @returns The text content of the selected words
 *
 * @example
 * getTextForWordRange("Hello world, how are you?", 1, 3)
 * // "world, how are"
 */
export function getTextForWordRange(
  text: string,
  startWord: number,
  endWord: number
): string {
  const words = tokenize(text);
  return words.slice(startWord, endWord + 1).join(' ');
}
