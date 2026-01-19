---
task: Bookmarks System
priority: 3
depends_on: ["001-typescript-types", "006-indexeddb-storage", "005-pdf-viewer-component"]
---

# Task: Bookmarks System

Implement the bookmark system for saving and navigating to specific pages within documents.

## Overview

This task adds bookmarking functionality to the PDF reader. Users can bookmark pages using a toolbar button, keyboard shortcut (B), or context menu. Bookmarks are displayed in the sidebar and persisted in localStorage. Clicking a bookmark navigates to that page.

## Context

- Bookmarks are stored in localStorage (defined in Task 006)
- Bookmark interface defined in Task 001
- Bookmark list appears in sidebar (Task 013)
- This task focuses on the hook and bookmark indicator

## Requirements

### useBookmarks Hook

**File:** `src/hooks/useBookmarks.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Bookmark } from '@/types';
import { VALIDATION } from '@/types';
import {
  getBookmarks,
  setBookmarks,
  getBookmarksForDocument,
} from '@/lib/storage';

interface UseBookmarksOptions {
  documentId: string;
}

interface UseBookmarksReturn {
  /** Bookmarks for this document */
  bookmarks: Bookmark[];
  /** Add a bookmark */
  addBookmark: (page: number, label?: string) => Bookmark;
  /** Remove a bookmark */
  removeBookmark: (id: string) => void;
  /** Update a bookmark label */
  updateBookmark: (id: string, label: string) => void;
  /** Check if a page is bookmarked */
  isPageBookmarked: (page: number) => boolean;
  /** Get bookmark for a specific page */
  getBookmarkForPage: (page: number) => Bookmark | undefined;
  /** Toggle bookmark on a page */
  toggleBookmark: (page: number) => void;
}

export function useBookmarks({ documentId }: UseBookmarksOptions): UseBookmarksReturn {
  const [bookmarks, setLocalBookmarks] = useState<Bookmark[]>([]);

  // Load bookmarks on mount
  useEffect(() => {
    const docs = getBookmarksForDocument(documentId);
    // Sort by page number
    docs.sort((a, b) => a.page - b.page);
    setLocalBookmarks(docs);
  }, [documentId]);

  const addBookmark = useCallback((page: number, label?: string): Bookmark => {
    // Check if already bookmarked
    const existing = bookmarks.find(b => b.page === page);
    if (existing) return existing;

    // Validate label length
    const safeLabel = label?.slice(0, VALIDATION.MAX_LABEL_LENGTH);

    const bookmark: Bookmark = {
      id: uuidv4(),
      documentId,
      page,
      label: safeLabel,
      createdAt: Date.now(),
    };

    // Update localStorage
    const allBookmarks = getBookmarks();
    allBookmarks.push(bookmark);
    setBookmarks(allBookmarks);

    // Update local state
    setLocalBookmarks(prev => {
      const updated = [...prev, bookmark];
      return updated.sort((a, b) => a.page - b.page);
    });

    return bookmark;
  }, [documentId, bookmarks]);

  const removeBookmark = useCallback((id: string) => {
    // Update localStorage
    const allBookmarks = getBookmarks();
    setBookmarks(allBookmarks.filter(b => b.id !== id));

    // Update local state
    setLocalBookmarks(prev => prev.filter(b => b.id !== id));
  }, []);

  const updateBookmark = useCallback((id: string, label: string) => {
    // Validate label length
    const safeLabel = label.slice(0, VALIDATION.MAX_LABEL_LENGTH);

    // Update localStorage
    const allBookmarks = getBookmarks();
    const index = allBookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      allBookmarks[index].label = safeLabel;
      setBookmarks(allBookmarks);
    }

    // Update local state
    setLocalBookmarks(prev =>
      prev.map(b => (b.id === id ? { ...b, label: safeLabel } : b))
    );
  }, []);

  const isPageBookmarked = useCallback((page: number): boolean => {
    return bookmarks.some(b => b.page === page);
  }, [bookmarks]);

  const getBookmarkForPage = useCallback((page: number): Bookmark | undefined => {
    return bookmarks.find(b => b.page === page);
  }, [bookmarks]);

  const toggleBookmark = useCallback((page: number) => {
    const existing = getBookmarkForPage(page);
    if (existing) {
      removeBookmark(existing.id);
    } else {
      addBookmark(page);
    }
  }, [getBookmarkForPage, removeBookmark, addBookmark]);

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark,
    isPageBookmarked,
    getBookmarkForPage,
    toggleBookmark,
  };
}
```

### Bookmark Keyboard Shortcut

Add to PDFViewer:

```typescript
// Handle B key to toggle bookmark on current page
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't trigger if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.key === 'b' || e.key === 'B') {
      toggleBookmark(currentPage);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [currentPage, toggleBookmark]);
```

### Bookmark Button in Toolbar

Add to PDFControls:

```typescript
interface PDFControlsProps {
  // ... existing props
  /** Is current page bookmarked */
  isBookmarked: boolean;
  /** Toggle bookmark on current page */
  onBookmarkToggle: () => void;
}

// In the component:
<button
  onClick={onBookmarkToggle}
  className={`p-2 rounded-lg transition-colors ${
    isBookmarked
      ? 'text-red-500 bg-red-500/10'
      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
  }`}
  aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
  aria-pressed={isBookmarked}
>
  <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
</button>
```

### Bookmark Indicator on Page

Add a small bookmark icon on bookmarked pages:

**File:** `src/components/pdf/PDFPage.tsx` (update)

```typescript
interface PDFPageProps {
  // ... existing props
  /** Whether this page is bookmarked */
  isBookmarked?: boolean;
  /** Toggle bookmark callback */
  onBookmarkToggle?: () => void;
}

// In the component:
{isBookmarked && (
  <div
    className="absolute top-2 right-2 text-red-500 cursor-pointer hover:scale-110 transition-transform"
    onClick={(e) => {
      e.stopPropagation();
      onBookmarkToggle?.();
    }}
    title="Remove bookmark"
  >
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  </div>
)}
```

### PDFBookmarks List Component

**File:** `src/components/pdf/PDFBookmarks.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import type { Bookmark } from '@/types';

interface PDFBookmarksProps {
  bookmarks: Bookmark[];
  onBookmarkClick: (bookmark: Bookmark) => void;
  onBookmarkDelete: (id: string) => void;
  onBookmarkRename: (id: string, label: string) => void;
}

export function PDFBookmarks({
  bookmarks,
  onBookmarkClick,
  onBookmarkDelete,
  onBookmarkRename,
}: PDFBookmarksProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleDoubleClick = (bookmark: Bookmark) => {
    setEditingId(bookmark.id);
    setEditValue(bookmark.label || `Page ${bookmark.page}`);
  };

  const handleRenameSubmit = (id: string) => {
    if (editValue.trim()) {
      onBookmarkRename(id, editValue.trim());
    }
    setEditingId(null);
  };

  if (bookmarks.length === 0) {
    return (
      <div className="p-4 text-zinc-500 text-sm text-center">
        No bookmarks yet.
        <br />
        Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs">B</kbd> to bookmark the current page.
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-800">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/50 cursor-pointer group"
          onClick={() => onBookmarkClick(bookmark)}
          onDoubleClick={() => handleDoubleClick(bookmark)}
        >
          {/* Bookmark icon */}
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>

          {/* Label */}
          <div className="flex-1 min-w-0">
            {editingId === bookmark.id ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleRenameSubmit(bookmark.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(bookmark.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-zinc-700 text-zinc-100 text-sm rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-500"
                autoFocus
              />
            ) : (
              <>
                <div className="text-zinc-200 text-sm truncate">
                  {bookmark.label || `Page ${bookmark.page}`}
                </div>
                <div className="text-zinc-500 text-xs">
                  Page {bookmark.page}
                </div>
              </>
            )}
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkDelete(bookmark.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
            aria-label="Delete bookmark"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useBookmarks.ts` | Create | Bookmark CRUD hook |
| `src/components/pdf/PDFBookmarks.tsx` | Create | Bookmark list component |
| `src/components/pdf/PDFControls.tsx` | Modify | Add bookmark button |
| `src/components/pdf/PDFPage.tsx` | Modify | Add bookmark indicator |
| `src/components/pdf/PDFViewer.tsx` | Modify | Integrate bookmarks |

## Success Criteria

1. [x] `src/hooks/useBookmarks.ts` exists
2. [x] useBookmarks loads bookmarks from localStorage
3. [x] addBookmark creates bookmark with UUID and timestamp
4. [x] removeBookmark removes from localStorage and state
5. [x] updateBookmark allows label editing
6. [x] isPageBookmarked returns correct boolean
7. [x] toggleBookmark adds or removes bookmark
8. [x] Bookmarks are sorted by page number
9. [x] `src/components/pdf/PDFBookmarks.tsx` exists
10. [x] PDFBookmarks shows list with page numbers
11. [x] Double-click allows inline label editing
12. [x] Delete button removes bookmark
13. [x] Clicking bookmark navigates to page
14. [x] Empty state shows helpful message
15. [x] Bookmark button in toolbar toggles bookmark
16. [x] B key toggles bookmark on current page
17. [x] Bookmarked pages show indicator icon
18. [x] `npm run type-check` passes
19. [x] `npm run lint` passes

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
