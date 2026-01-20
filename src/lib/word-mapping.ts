/**
 * PDF and Document Word Mapping Utilities
 *
 * This module provides utilities for mapping word indices across PDF pages
 * and document sections. It builds on top of the shared tokenization in
 * `./tokenize.ts` to ensure consistent word indexing.
 *
 * CONSISTENCY GUARANTEE:
 * These utilities use the shared `tokenize()` function from `./tokenize.ts`
 * to ensure word indices are consistent between:
 * - PDF page views
 * - Speed reader
 * - Highlights and bookmarks
 *
 * Usage:
 * 1. Build page word counts once when loading a PDF
 * 2. Use mapWordIndexToPage() to find which page contains a word
 * 3. Use mapSelectionToWordIndex() to convert a selection to a global word index
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import { tokenize } from './tokenize';

// =============================================================================
// PDF Page Word Count Mapping
// =============================================================================

/**
 * Build an array of word counts per page for a PDF document.
 *
 * This is used to convert between global word indices and page-local indices.
 * Should be called once when loading a PDF and cached for the session.
 *
 * @param pdf - The PDF document proxy from pdfjs-dist
 * @returns Promise resolving to array of word counts, one per page (0-indexed)
 *
 * @example
 * const pdf = await loadPDF(data);
 * const pageCounts = await buildPageWordCounts(pdf);
 * // [523, 612, 489, ...] - page 0 has 523 words, page 1 has 612, etc.
 */
export async function buildPageWordCounts(
  pdf: PDFDocumentProxy
): Promise<number[]> {
  const counts: number[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');

    const words = tokenize(pageText);
    counts.push(words.length);
  }

  return counts;
}

/**
 * Map a global word index to its containing page and page-local index.
 *
 * @param wordIndex - Global word index (0-based, across entire document)
 * @param pageWordCounts - Array of word counts per page from buildPageWordCounts()
 * @returns Object with 1-based page number and 0-based index within that page
 *
 * @example
 * const pageWordCounts = [100, 150, 200]; // 3 pages
 * mapWordIndexToPage(50, pageWordCounts)
 * // { page: 1, indexOnPage: 50 } - word 50 is on page 1
 *
 * mapWordIndexToPage(120, pageWordCounts)
 * // { page: 2, indexOnPage: 20 } - word 120 is on page 2 (100 on page 1, 20 into page 2)
 *
 * mapWordIndexToPage(300, pageWordCounts)
 * // { page: 3, indexOnPage: 50 } - word 300 is on page 3
 */
export function mapWordIndexToPage(
  wordIndex: number,
  pageWordCounts: number[]
): { page: number; indexOnPage: number } {
  if (pageWordCounts.length === 0) {
    return { page: 1, indexOnPage: 0 };
  }

  let cumulativeCount = 0;

  for (let i = 0; i < pageWordCounts.length; i++) {
    const pageCount = pageWordCounts[i];

    if (wordIndex < cumulativeCount + pageCount) {
      return {
        page: i + 1, // 1-based page number
        indexOnPage: wordIndex - cumulativeCount,
      };
    }

    cumulativeCount += pageCount;
  }

  // Word index is past the end of the document, return last page
  const lastPage = pageWordCounts.length;
  const lastPageWordCount = pageWordCounts[lastPage - 1] || 0;
  return {
    page: lastPage,
    indexOnPage: Math.max(0, lastPageWordCount - 1),
  };
}

/**
 * Map a page-local word index to a global document word index.
 *
 * Inverse of mapWordIndexToPage().
 *
 * @param page - Page number (1-based)
 * @param indexOnPage - Word index within the page (0-based)
 * @param pageWordCounts - Array of word counts per page
 * @returns Global word index (0-based)
 *
 * @example
 * const pageWordCounts = [100, 150, 200];
 * mapPageToWordIndex(2, 20, pageWordCounts) // 120
 */
export function mapPageToWordIndex(
  page: number,
  indexOnPage: number,
  pageWordCounts: number[]
): number {
  if (page <= 0 || pageWordCounts.length === 0) {
    return 0;
  }

  let globalIndex = 0;
  const targetPage = Math.min(page, pageWordCounts.length);

  // Sum up all words before the target page
  for (let i = 0; i < targetPage - 1; i++) {
    globalIndex += pageWordCounts[i];
  }

  // Add the index on the page
  return globalIndex + indexOnPage;
}

/**
 * Get the total word count across all pages.
 *
 * @param pageWordCounts - Array of word counts per page
 * @returns Total word count
 */
export function getTotalWordCount(pageWordCounts: number[]): number {
  return pageWordCounts.reduce((sum, count) => sum + count, 0);
}

/**
 * Get the cumulative word count up to (but not including) a page.
 *
 * Useful for converting page-local indices to global indices.
 *
 * @param page - Page number (1-based)
 * @param pageWordCounts - Array of word counts per page
 * @returns Cumulative word count before the page
 *
 * @example
 * const pageWordCounts = [100, 150, 200];
 * getCumulativeWordCount(1, pageWordCounts) // 0
 * getCumulativeWordCount(2, pageWordCounts) // 100
 * getCumulativeWordCount(3, pageWordCounts) // 250
 */
export function getCumulativeWordCount(
  page: number,
  pageWordCounts: number[]
): number {
  if (page <= 1 || pageWordCounts.length === 0) {
    return 0;
  }

  let cumulative = 0;
  for (let i = 0; i < Math.min(page - 1, pageWordCounts.length); i++) {
    cumulative += pageWordCounts[i];
  }

  return cumulative;
}

// =============================================================================
// PDF Selection Mapping
// =============================================================================

/**
 * Map a text selection on a PDF page to a global word index.
 *
 * This function counts the words before the selection within the page,
 * then adds the cumulative word count of all prior pages to get the
 * global word index.
 *
 * NOTE: This is a simplified implementation that works with plain text
 * extracted from the page. For more accurate selection mapping, you may
 * need to work with the actual PDF text layer positioning.
 *
 * @param pageText - The text content of the current page
 * @param selectionStartOffset - Character offset where selection starts on the page
 * @param currentPage - Current page number (1-based)
 * @param pageWordCounts - Array of word counts per page
 * @returns Global word index (0-based)
 *
 * @example
 * const pageText = "The quick brown fox jumps over the lazy dog.";
 * const pageWordCounts = [100, 9, 200]; // page 2 has 9 words (our example)
 * // User selects "fox" which starts at character 16
 * mapSelectionToWordIndex(pageText, 16, 2, pageWordCounts)
 * // 103 (100 words on page 1, + 3 words into page 2)
 */
export function mapSelectionToWordIndex(
  pageText: string,
  selectionStartOffset: number,
  currentPage: number,
  pageWordCounts: number[]
): number {
  // Get words before the selection point on this page
  const textBeforeSelection = pageText.substring(0, selectionStartOffset);
  const wordsBeforeOnPage = tokenize(textBeforeSelection).length;

  // Add cumulative word count from all prior pages
  const priorPagesWordCount = getCumulativeWordCount(currentPage, pageWordCounts);

  return priorPagesWordCount + wordsBeforeOnPage;
}

/**
 * Map a Range selection to a global word index for PDF pages.
 *
 * Alternative version that takes a browser Range object directly.
 * Extracts text content and maps to global word index.
 *
 * @param selectionRange - Browser Range object
 * @param currentPage - Current page number (1-based)
 * @param pageWordCounts - Array of word counts per page
 * @param pageText - Full text of the current page
 * @returns Global word index (0-based)
 */
export function mapRangeSelectionToWordIndex(
  selectionRange: Range,
  currentPage: number,
  pageWordCounts: number[],
  pageText: string
): number {
  // For simplicity, use the startOffset of the range
  // In a real implementation, you might need more sophisticated positioning
  const startOffset = selectionRange.startOffset;

  return mapSelectionToWordIndex(pageText, startOffset, currentPage, pageWordCounts);
}
