---
task: PDF Search
priority: 3
depends_on: ["004-pdf-js-setup", "005-pdf-viewer-component", "009-text-layer-selection"]
---

# Task: PDF Search

Implement full-text search within PDF documents with match highlighting and navigation.

## Overview

This task adds document search functionality. Users can search for text within the PDF using Ctrl+F or a search button. The search highlights all matches, shows a match counter, and allows navigation between matches. The active match is scrolled into view and has a pulsing animation.

## Context

- Search UI appears as a floating bar in the top-right
- Search algorithm from PRD Section 4.3.2
- Uses PDF.js text content API
- Match highlighting uses CSS (defined in Task 003)
- Search is case-insensitive

## Requirements

### usePDFSearch Hook

**File:** `src/hooks/usePDFSearch.ts`

```typescript
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
```

### PDFSearch Component

**File:** `src/components/pdf/PDFSearch.tsx`

```typescript
'use client';

import React, { useRef, useEffect } from 'react';

interface PDFSearchProps {
  /** Current query */
  query: string;
  /** Set query */
  onQueryChange: (query: string) => void;
  /** Current match index (0-based) */
  currentMatch: number;
  /** Total matches */
  totalMatches: number;
  /** Is searching */
  isSearching: boolean;
  /** Go to next match */
  onNext: () => void;
  /** Go to previous match */
  onPrevious: () => void;
  /** Close search */
  onClose: () => void;
}

export function PDFSearch({
  query,
  onQueryChange,
  currentMatch,
  totalMatches,
  isSearching,
  onNext,
  onPrevious,
  onClose,
}: PDFSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrevious();
      } else {
        onNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="absolute top-2 right-2 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2 flex items-center gap-2">
      {/* Search icon */}
      <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search in document..."
        className="w-48 bg-transparent text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none"
      />

      {/* Match counter */}
      <div className="text-zinc-400 text-sm min-w-[60px] text-center">
        {isSearching ? (
          <span className="text-zinc-500">...</span>
        ) : totalMatches > 0 ? (
          <span>{currentMatch + 1} / {totalMatches}</span>
        ) : query ? (
          <span className="text-zinc-500">0 / 0</span>
        ) : null}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPrevious}
          disabled={totalMatches === 0}
          className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous match"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onNext}
          disabled={totalMatches === 0}
          className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next match"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="p-1 text-zinc-400 hover:text-zinc-100"
        aria-label="Close search"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
```

### Search Match Highlighting

Update PDFTextLayer to highlight search matches:

```typescript
// Add to PDFTextLayer.tsx

interface PDFTextLayerProps {
  page: PDFPageProxy;
  zoom: number;
  onTextSelect?: (selection: TextSelection) => void;
  /** Search matches for this page */
  searchMatches?: SearchMatch[];
  /** Index of the active match (global) */
  activeMatchIndex?: number;
  /** All matches (to calculate if this page has active match) */
  allMatches?: SearchMatch[];
}

// In the render function, add highlighting logic:
// - Wrap matched text in spans with yellow background
// - Active match gets .search-match-active class for pulsing animation
```

### Keyboard Shortcut

Add to PDFViewer:

```typescript
// Handle Ctrl+F to open search
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      setSearchOpen(true);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Scroll to Match

When currentMatchIndex changes, scroll the match into view:

```typescript
// In PDFViewer
useEffect(() => {
  if (matches.length === 0) return;

  const match = matches[currentMatchIndex];
  // Scroll to the page containing the match
  const pageElement = containerRef.current?.querySelector(
    `[data-page-number="${match.pageIndex + 1}"]`
  );

  if (pageElement) {
    pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}, [currentMatchIndex, matches]);
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/usePDFSearch.ts` | Create | Search logic hook |
| `src/components/pdf/PDFSearch.tsx` | Create | Search UI component |
| `src/components/pdf/PDFTextLayer.tsx` | Modify | Add search highlighting |
| `src/components/pdf/PDFViewer.tsx` | Modify | Integrate search |

## Success Criteria

1. [x] `src/hooks/usePDFSearch.ts` exists
2. [x] usePDFSearch extracts text from all pages
3. [x] Search is case-insensitive
4. [x] Search results include page index and text position
5. [x] `src/components/pdf/PDFSearch.tsx` exists
6. [x] PDFSearch has input field with placeholder
7. [x] PDFSearch shows match counter (X of Y)
8. [x] PDFSearch has previous/next navigation buttons
9. [x] PDFSearch closes with Escape or X button
10. [x] Enter goes to next match, Shift+Enter to previous
11. [x] Ctrl+F opens search bar
12. [x] Search matches are highlighted in yellow
13. [x] Active match has pulsing animation
14. [x] Navigating to match scrolls page into view
15. [x] Search is debounced (200ms delay)
16. [x] `npm run type-check` passes
17. [x] `npm run lint` passes

---

## Ralph Instructions

When working on this task:

1. Read `.ralph/guardrails.md` for signs to follow
2. Read `.ralph/progress.md` to see what's been done
3. Work on the next unchecked criterion (marked [ ])
4. After completing a criterion, change [ ] to [x] in this file
5. Update `.ralph/progress.md` with your progress
6. Commit your changes frequently with descriptive messages
7. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
8. If stuck 3+ times on same issue, output: `<ralph>GUTTER</ralph>`
