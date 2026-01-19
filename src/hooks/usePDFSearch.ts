'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { SearchMatch } from '@/types';
import { getTextContent } from '@/lib/pdf-utils';

interface UsePDFSearchOptions {
  pdf: PDFDocumentProxy | null;
}

interface UsePDFSearchReturn {
  /** Current search query */
  query: string;
  /** Set search query (triggers search) */
  setQuery: (query: string) => void;
  /** All matches */
  matches: SearchMatch[];
  /** Current match index (0-based) */
  currentMatchIndex: number;
  /** Total match count */
  matchCount: number;
  /** Is search in progress */
  isSearching: boolean;
  /** Go to next match */
  nextMatch: () => void;
  /** Go to previous match */
  previousMatch: () => void;
  /** Go to specific match */
  goToMatch: (index: number) => void;
  /** Clear search */
  clearSearch: () => void;
  /** Get matches for a specific page */
  getMatchesForPage: (pageIndex: number) => SearchMatch[];
}

export function usePDFSearch({ pdf }: UsePDFSearchOptions): UsePDFSearchReturn {
  const [query, setQueryState] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Cache text content per page
  const textCache = useRef<Map<number, string>>(new Map());

  // Extract text from a page (with caching)
  const getPageText = useCallback(async (pageIndex: number): Promise<string> => {
    if (textCache.current.has(pageIndex)) {
      return textCache.current.get(pageIndex)!;
    }

    if (!pdf) return '';

    const page = await pdf.getPage(pageIndex + 1);
    const textContent = await getTextContent(page);
    const text = textContent.items
      .map(item => ('str' in item ? item.str : ''))
      .join('');

    textCache.current.set(pageIndex, text);
    return text;
  }, [pdf]);

  // Perform search
  const search = useCallback(async (searchQuery: string) => {
    if (!pdf || !searchQuery.trim()) {
      setMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    setIsSearching(true);

    try {
      const normalizedQuery = searchQuery.toLowerCase();
      const newMatches: SearchMatch[] = [];

      for (let i = 0; i < pdf.numPages; i++) {
        const pageText = await getPageText(i);
        const normalizedText = pageText.toLowerCase();

        let searchIndex = 0;
        let matchIndex = 0;

        while ((searchIndex = normalizedText.indexOf(normalizedQuery, searchIndex)) !== -1) {
          newMatches.push({
            pageIndex: i,
            matchIndex: matchIndex++,
            text: pageText.slice(searchIndex, searchIndex + searchQuery.length),
            startIndex: searchIndex,
            endIndex: searchIndex + searchQuery.length,
          });
          searchIndex += searchQuery.length;
        }
      }

      setMatches(newMatches);
      setCurrentMatchIndex(0);
    } finally {
      setIsSearching(false);
    }
  }, [pdf, getPageText]);

  // Set query with debounced search
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, search]);

  // Clear cache when PDF changes
  useEffect(() => {
    textCache.current.clear();
  }, [pdf]);

  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  const previousMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const goToMatch = useCallback((index: number) => {
    if (index >= 0 && index < matches.length) {
      setCurrentMatchIndex(index);
    }
  }, [matches.length]);

  const clearSearch = useCallback(() => {
    setQueryState('');
    setMatches([]);
    setCurrentMatchIndex(0);
  }, []);

  const getMatchesForPage = useCallback((pageIndex: number): SearchMatch[] => {
    return matches.filter(m => m.pageIndex === pageIndex);
  }, [matches]);

  return {
    query,
    setQuery,
    matches,
    currentMatchIndex,
    matchCount: matches.length,
    isSearching,
    nextMatch,
    previousMatch,
    goToMatch,
    clearSearch,
    getMatchesForPage,
  };
}
