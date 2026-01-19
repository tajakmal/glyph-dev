---
task: Sidebar and Table of Contents
priority: 3
depends_on: ["004-pdf-js-setup", "005-pdf-viewer-component", "012-bookmarks-system"]
---

# Task: Sidebar and Table of Contents

Implement the sidebar component with tabs for Table of Contents, Bookmarks, and Highlights.

## Overview

This task creates the sidebar that provides navigation and annotation overview. The sidebar has three tabs: Contents (table of contents from PDF), Bookmarks, and Highlights. It can be toggled open/closed and remembers its state. On mobile, it overlays the content; on desktop, it pushes the content.

## Context

- Sidebar layout from PRD Section 4.6
- TOC extraction from PDF outline metadata
- Uses usePDFOutline hook
- Bookmarks list from Task 012
- Highlights list placeholder (implemented in Task 014)
- S key toggles sidebar

## Requirements

### usePDFOutline Hook

**File:** `src/hooks/usePDFOutline.ts`

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFOutlineItem } from '@/types';
import { getPDFOutline } from '@/lib/pdf-utils';

interface UsePDFOutlineOptions {
  pdf: PDFDocumentProxy | null;
}

interface UsePDFOutlineReturn {
  /** Outline items (table of contents) */
  outline: PDFOutlineItem[];
  /** Whether the PDF has an outline */
  hasOutline: boolean;
  /** Loading state */
  isLoading: boolean;
}

export function usePDFOutline({ pdf }: UsePDFOutlineOptions): UsePDFOutlineReturn {
  const [outline, setOutline] = useState<PDFOutlineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!pdf) {
      setOutline([]);
      return;
    }

    const loadOutline = async () => {
      setIsLoading(true);
      try {
        const result = await getPDFOutline(pdf);
        setOutline(result as PDFOutlineItem[]);
      } catch (error) {
        console.error('Failed to load outline:', error);
        setOutline([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadOutline();
  }, [pdf]);

  return {
    outline,
    hasOutline: outline.length > 0,
    isLoading,
  };
}
```

### PDFOutline Component

**File:** `src/components/pdf/PDFOutline.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import type { PDFOutlineItem } from '@/types';

interface PDFOutlineProps {
  outline: PDFOutlineItem[];
  onItemClick: (page: number) => void;
  isLoading?: boolean;
}

interface OutlineItemProps {
  item: PDFOutlineItem;
  depth: number;
  onItemClick: (page: number) => void;
}

function OutlineItem({ item, depth, onItemClick }: OutlineItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = item.items && item.items.length > 0;

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 py-1.5 px-3 cursor-pointer
          hover:bg-zinc-800/50 text-sm transition-colors
          ${depth === 0 ? 'font-medium text-zinc-200' : 'text-zinc-400'}
        `}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onItemClick(item.page)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-zinc-700 rounded"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        <span className="flex-1 truncate">{item.title}</span>
        <span className="text-zinc-600 text-xs">{item.page}</span>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {item.items.map((child, index) => (
            <OutlineItem
              key={index}
              item={child as PDFOutlineItem}
              depth={depth + 1}
              onItemClick={onItemClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PDFOutline({ outline, onItemClick, isLoading }: PDFOutlineProps) {
  if (isLoading) {
    return (
      <div className="p-4 text-zinc-500 text-sm text-center">
        Loading table of contents...
      </div>
    );
  }

  if (outline.length === 0) {
    return (
      <div className="p-4 text-zinc-500 text-sm text-center">
        No table of contents available for this document.
      </div>
    );
  }

  return (
    <div className="py-2">
      {outline.map((item, index) => (
        <OutlineItem
          key={index}
          item={item}
          depth={0}
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
}
```

### PDFSidebar Component

**File:** `src/components/pdf/PDFSidebar.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import type { PDFOutlineItem, Bookmark, Highlight } from '@/types';
import { PDFOutline } from './PDFOutline';
import { PDFBookmarks } from './PDFBookmarks';

interface PDFSidebarProps {
  /** Is sidebar open */
  isOpen: boolean;
  /** Toggle sidebar */
  onToggle: () => void;
  /** Document title */
  documentTitle: string;
  /** Outline items */
  outline: PDFOutlineItem[];
  /** Is outline loading */
  isOutlineLoading?: boolean;
  /** Bookmarks */
  bookmarks: Bookmark[];
  /** Highlights */
  highlights: Highlight[];
  /** Callback when outline item clicked */
  onOutlineClick: (page: number) => void;
  /** Callback when bookmark clicked */
  onBookmarkClick: (bookmark: Bookmark) => void;
  /** Callback when bookmark deleted */
  onBookmarkDelete: (id: string) => void;
  /** Callback when bookmark renamed */
  onBookmarkRename: (id: string, label: string) => void;
  /** Callback when highlight clicked */
  onHighlightClick: (highlight: Highlight) => void;
  /** Callback for export */
  onExport: () => void;
}

type TabType = 'contents' | 'bookmarks' | 'highlights';

export function PDFSidebar({
  isOpen,
  onToggle,
  documentTitle,
  outline,
  isOutlineLoading,
  bookmarks,
  highlights,
  onOutlineClick,
  onBookmarkClick,
  onBookmarkDelete,
  onBookmarkRename,
  onHighlightClick,
  onExport,
}: PDFSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('contents');

  if (!isOpen) {
    return null;
  }

  return (
    <div className="w-[280px] h-full bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <h2 className="text-zinc-200 text-sm font-medium truncate flex-1" title={documentTitle}>
          {documentTitle}
        </h2>
        <button
          onClick={onToggle}
          className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded"
          aria-label="Close sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('contents')}
          className={`flex-1 py-2 text-sm transition-colors ${
            activeTab === 'contents'
              ? 'text-red-500 border-b-2 border-red-500'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Contents
        </button>
        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`flex-1 py-2 text-sm transition-colors ${
            activeTab === 'bookmarks'
              ? 'text-red-500 border-b-2 border-red-500'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Bookmarks
          {bookmarks.length > 0 && (
            <span className="ml-1 text-xs text-zinc-500">({bookmarks.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('highlights')}
          className={`flex-1 py-2 text-sm transition-colors ${
            activeTab === 'highlights'
              ? 'text-red-500 border-b-2 border-red-500'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Notes
          {highlights.length > 0 && (
            <span className="ml-1 text-xs text-zinc-500">({highlights.length})</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'contents' && (
          <PDFOutline
            outline={outline}
            onItemClick={onOutlineClick}
            isLoading={isOutlineLoading}
          />
        )}
        {activeTab === 'bookmarks' && (
          <PDFBookmarks
            bookmarks={bookmarks}
            onBookmarkClick={onBookmarkClick}
            onBookmarkDelete={onBookmarkDelete}
            onBookmarkRename={onBookmarkRename}
          />
        )}
        {activeTab === 'highlights' && (
          <PDFHighlightsList
            highlights={highlights}
            onHighlightClick={onHighlightClick}
          />
        )}
      </div>

      {/* Export Button */}
      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={onExport}
          disabled={highlights.length === 0}
          className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Export Annotations
        </button>
      </div>
    </div>
  );
}

// Placeholder for highlights list (implemented in Task 014)
function PDFHighlightsList({
  highlights,
  onHighlightClick,
}: {
  highlights: Highlight[];
  onHighlightClick: (highlight: Highlight) => void;
}) {
  if (highlights.length === 0) {
    return (
      <div className="p-4 text-zinc-500 text-sm text-center">
        No highlights yet.
        <br />
        Select text to create a highlight.
      </div>
    );
  }

  // Group by page
  const byPage = highlights.reduce((acc, h) => {
    if (!acc[h.page]) acc[h.page] = [];
    acc[h.page].push(h);
    return acc;
  }, {} as Record<number, Highlight[]>);

  return (
    <div className="py-2">
      {Object.entries(byPage)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([page, pageHighlights]) => (
          <div key={page}>
            <div className="px-3 py-1 text-xs text-zinc-500 font-medium bg-zinc-800/50">
              Page {page}
            </div>
            {pageHighlights.map((highlight) => (
              <div
                key={highlight.id}
                className="px-3 py-2 hover:bg-zinc-800/50 cursor-pointer"
                onClick={() => onHighlightClick(highlight)}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: getHighlightColor(highlight.color) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300 text-sm line-clamp-2">
                      "{highlight.text.slice(0, 100)}{highlight.text.length > 100 ? '...' : ''}"
                    </p>
                    {highlight.note && (
                      <p className="text-zinc-500 text-xs mt-1 line-clamp-1">
                        Note: {highlight.note}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function getHighlightColor(color: string): string {
  const colors: Record<string, string> = {
    yellow: '#fde047',
    green: '#86efac',
    blue: '#93c5fd',
    pink: '#f9a8d4',
    orange: '#fdba74',
  };
  return colors[color] || colors.yellow;
}
```

### Sidebar Toggle Keyboard Shortcut

Add to PDFViewer:

```typescript
// Handle S key to toggle sidebar
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.key === 's' || e.key === 'S') {
      setSidebarOpen(prev => !prev);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Persist Sidebar State

Use localStorage to remember sidebar state:

```typescript
// In PDFViewer
const [sidebarOpen, setSidebarOpen] = useState(() => {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('glyph:sidebar-open');
  return stored !== null ? JSON.parse(stored) : true;
});

useEffect(() => {
  localStorage.setItem('glyph:sidebar-open', JSON.stringify(sidebarOpen));
}, [sidebarOpen]);
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/usePDFOutline.ts` | Create | TOC extraction hook |
| `src/components/pdf/PDFOutline.tsx` | Create | TOC tree component |
| `src/components/pdf/PDFSidebar.tsx` | Create | Sidebar container with tabs |
| `src/components/pdf/PDFViewer.tsx` | Modify | Integrate sidebar |

## Success Criteria

1. [x] `src/hooks/usePDFOutline.ts` exists
2. [x] usePDFOutline extracts outline from PDF
3. [x] usePDFOutline handles PDFs without outlines
4. [x] `src/components/pdf/PDFOutline.tsx` exists
5. [x] PDFOutline renders collapsible tree structure
6. [x] Clicking outline item navigates to page
7. [x] Empty state shows when no TOC available
8. [x] `src/components/pdf/PDFSidebar.tsx` exists
9. [x] Sidebar has three tabs (Contents, Bookmarks, Notes)
10. [x] Tab badges show counts
11. [x] Sidebar shows document title with truncation
12. [x] Export button is disabled when no highlights
13. [x] S key toggles sidebar
14. [x] Sidebar state persists in localStorage
15. [x] Sidebar has collapse button
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
