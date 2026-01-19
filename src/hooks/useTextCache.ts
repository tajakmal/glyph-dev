'use client';

import { useRef, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getTextContent } from '@/lib/pdf-utils';

/**
 * Hook for caching text extraction from PDF pages.
 * Text is extracted lazily when requested and cached for subsequent requests.
 */
export function useTextCache(pdf: PDFDocumentProxy | null) {
  const cache = useRef<Map<number, string>>(new Map());

  /**
   * Get text content for a specific page (0-indexed).
   * Returns cached text if available, otherwise extracts and caches.
   */
  const getPageText = useCallback(async (pageIndex: number): Promise<string> => {
    // Check cache first
    if (cache.current.has(pageIndex)) {
      return cache.current.get(pageIndex)!;
    }

    if (!pdf) return '';

    try {
      // Extract text from page (pageIndex is 0-based, getPage expects 1-based)
      const page = await pdf.getPage(pageIndex + 1);
      const textContent = await getTextContent(page);
      const text = textContent.items
        .map(item => ('str' in item ? item.str : ''))
        .join('');

      // Cache the result
      cache.current.set(pageIndex, text);
      return text;
    } catch (error) {
      console.error(`Failed to extract text from page ${pageIndex + 1}:`, error);
      return '';
    }
  }, [pdf]);

  /**
   * Get all text from the document.
   * Uses cache where available.
   */
  const getAllText = useCallback(async (): Promise<string> => {
    if (!pdf) return '';

    const texts: string[] = [];
    for (let i = 0; i < pdf.numPages; i++) {
      const text = await getPageText(i);
      texts.push(text);
    }

    return texts.join('\n\n');
  }, [pdf, getPageText]);

  /**
   * Check if a page's text is already cached.
   */
  const isPageCached = useCallback((pageIndex: number): boolean => {
    return cache.current.has(pageIndex);
  }, []);

  /**
   * Clear the text cache.
   * Call this when the document changes.
   */
  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  /**
   * Get the number of cached pages.
   */
  const getCachedCount = useCallback((): number => {
    return cache.current.size;
  }, []);

  return {
    getPageText,
    getAllText,
    isPageCached,
    clearCache,
    getCachedCount,
  };
}
