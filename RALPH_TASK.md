---
task: Highlights System
priority: 4
depends_on: ["001-typescript-types", "006-indexeddb-storage", "009-text-layer-selection"]
---

# Task: Highlights System

Implement the highlight system for creating, storing, and rendering text highlights.

## Overview

This task creates the core highlighting functionality. Users can select text and create colored highlights that persist across sessions. Highlights are stored with normalized coordinates so they render correctly at any zoom level. The highlight layer renders over the text layer.

## Context

- Highlight interface defined in Task 001
- Storage functions from Task 006
- Text selection from Task 009
- Five colors: yellow, green, blue, pink, orange
- Coordinates are normalized (0-1 range) for zoom independence

## Requirements

### useHighlights Hook

**File:** `src/hooks/useHighlights.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Highlight, HighlightColor, HighlightRect } from '@/types';
import { VALIDATION } from '@/types';
import {
  getHighlights,
  setHighlights,
  getHighlightsForDocument,
} from '@/lib/storage';

interface UseHighlightsOptions {
  documentId: string;
}

interface UseHighlightsReturn {
  /** Highlights for this document */
  highlights: Highlight[];
  /** Highlights grouped by page */
  highlightsByPage: Map<number, Highlight[]>;
  /** Add a highlight */
  addHighlight: (highlight: Omit<Highlight, 'id' | 'createdAt'>) => Highlight;
  /** Remove a highlight */
  removeHighlight: (id: string) => void;
  /** Update highlight note */
  updateHighlightNote: (id: string, note: string) => void;
  /** Update highlight color */
  updateHighlightColor: (id: string, color: HighlightColor) => void;
  /** Get highlights for a specific page */
  getHighlightsForPage: (page: number) => Highlight[];
}

export function useHighlights({ documentId }: UseHighlightsOptions): UseHighlightsReturn {
  const [highlights, setLocalHighlights] = useState<Highlight[]>([]);

  // Load highlights on mount
  useEffect(() => {
    const docs = getHighlightsForDocument(documentId);
    setLocalHighlights(docs);
  }, [documentId]);

  // Compute highlights by page
  const highlightsByPage = new Map<number, Highlight[]>();
  highlights.forEach(h => {
    if (!highlightsByPage.has(h.page)) {
      highlightsByPage.set(h.page, []);
    }
    highlightsByPage.get(h.page)!.push(h);
  });

  const addHighlight = useCallback((
    data: Omit<Highlight, 'id' | 'createdAt'>
  ): Highlight => {
    const highlight: Highlight = {
      ...data,
      id: uuidv4(),
      createdAt: Date.now(),
    };

    // Update localStorage
    const allHighlights = getHighlights();
    allHighlights.push(highlight);
    setHighlights(allHighlights);

    // Update local state
    setLocalHighlights(prev => [...prev, highlight]);

    return highlight;
  }, []);

  const removeHighlight = useCallback((id: string) => {
    // Update localStorage
    const allHighlights = getHighlights();
    setHighlights(allHighlights.filter(h => h.id !== id));

    // Update local state
    setLocalHighlights(prev => prev.filter(h => h.id !== id));
  }, []);

  const updateHighlightNote = useCallback((id: string, note: string) => {
    // Validate note length
    const safeNote = note.slice(0, VALIDATION.MAX_NOTE_LENGTH);

    // Update localStorage
    const allHighlights = getHighlights();
    const index = allHighlights.findIndex(h => h.id === id);
    if (index !== -1) {
      allHighlights[index].note = safeNote;
      allHighlights[index].updatedAt = Date.now();
      setHighlights(allHighlights);
    }

    // Update local state
    setLocalHighlights(prev =>
      prev.map(h => (h.id === id ? { ...h, note: safeNote, updatedAt: Date.now() } : h))
    );
  }, []);

  const updateHighlightColor = useCallback((id: string, color: HighlightColor) => {
    // Update localStorage
    const allHighlights = getHighlights();
    const index = allHighlights.findIndex(h => h.id === id);
    if (index !== -1) {
      allHighlights[index].color = color;
      allHighlights[index].updatedAt = Date.now();
      setHighlights(allHighlights);
    }

    // Update local state
    setLocalHighlights(prev =>
      prev.map(h => (h.id === id ? { ...h, color, updatedAt: Date.now() } : h))
    );
  }, []);

  const getHighlightsForPage = useCallback((page: number): Highlight[] => {
    return highlights.filter(h => h.page === page);
  }, [highlights]);

  return {
    highlights,
    highlightsByPage,
    addHighlight,
    removeHighlight,
    updateHighlightNote,
    updateHighlightColor,
    getHighlightsForPage,
  };
}
```

### Coordinate Normalization Utilities

**File:** `src/lib/highlight-utils.ts`

```typescript
import type { HighlightRect } from '@/types';

/**
 * Normalize selection rects to 0-1 range based on page dimensions
 */
export function normalizeRects(
  rects: DOMRect[],
  pageWidth: number,
  pageHeight: number
): HighlightRect[] {
  return rects.map(rect => ({
    x: rect.x / pageWidth,
    y: rect.y / pageHeight,
    width: rect.width / pageWidth,
    height: rect.height / pageHeight,
  }));
}

/**
 * Denormalize rects back to pixel values for rendering
 */
export function denormalizeRects(
  rects: HighlightRect[],
  pageWidth: number,
  pageHeight: number
): Array<{ x: number; y: number; width: number; height: number }> {
  return rects.map(rect => ({
    x: rect.x * pageWidth,
    y: rect.y * pageHeight,
    width: rect.width * pageWidth,
    height: rect.height * pageHeight,
  }));
}

/**
 * Merge overlapping or adjacent rects for cleaner rendering
 */
export function mergeRects(rects: HighlightRect[]): HighlightRect[] {
  if (rects.length <= 1) return rects;

  // Sort by y position, then x
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.y - b.y) < 0.01) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const merged: HighlightRect[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if on same line and adjacent/overlapping
    const sameLine = Math.abs(current.y - next.y) < 0.01;
    const overlapping = current.x + current.width >= next.x - 0.01;

    if (sameLine && overlapping) {
      // Merge
      const newWidth = Math.max(
        current.x + current.width,
        next.x + next.width
      ) - current.x;
      current = { ...current, width: newWidth };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}
```

### PDFHighlightLayer Component

**File:** `src/components/pdf/PDFHighlightLayer.tsx`

```typescript
'use client';

import React from 'react';
import type { Highlight } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';
import { denormalizeRects } from '@/lib/highlight-utils';

interface PDFHighlightLayerProps {
  /** Highlights for this page */
  highlights: Highlight[];
  /** Page width in pixels */
  pageWidth: number;
  /** Page height in pixels */
  pageHeight: number;
  /** Callback when highlight is clicked */
  onHighlightClick?: (highlight: Highlight) => void;
  /** Currently selected highlight ID */
  selectedHighlightId?: string;
}

export function PDFHighlightLayer({
  highlights,
  pageWidth,
  pageHeight,
  onHighlightClick,
  selectedHighlightId,
}: PDFHighlightLayerProps) {
  return (
    <div className="pdf-highlight-layer">
      {highlights.map((highlight) => {
        const pixelRects = denormalizeRects(highlight.rects, pageWidth, pageHeight);
        const isSelected = highlight.id === selectedHighlightId;
        const colorInfo = HIGHLIGHT_COLORS[highlight.color];

        return (
          <div key={highlight.id} className="highlight-group">
            {pixelRects.map((rect, index) => (
              <div
                key={index}
                className={`
                  absolute cursor-pointer transition-all
                  ${isSelected ? 'ring-2 ring-offset-1 ring-zinc-400' : ''}
                  hover:brightness-90
                `}
                style={{
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  backgroundColor: colorInfo.bg,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onHighlightClick?.(highlight);
                }}
                data-highlight-id={highlight.id}
              />
            ))}
            {/* Note indicator */}
            {highlight.note && pixelRects.length > 0 && (
              <div
                className="absolute w-3 h-3 bg-zinc-700 rounded-full flex items-center justify-center cursor-pointer hover:bg-zinc-600"
                style={{
                  left: `${pixelRects[pixelRects.length - 1].x + pixelRects[pixelRects.length - 1].width + 4}px`,
                  top: `${pixelRects[pixelRects.length - 1].y}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onHighlightClick?.(highlight);
                }}
                title="View note"
              >
                <svg className="w-2 h-2 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

### Integrate Highlight Layer into PDFPage

Update PDFPage to include the highlight layer:

```typescript
// In PDFPage.tsx

interface PDFPageProps {
  page: PDFPageProxy;
  pageNumber: number;
  zoom: number;
  onRenderComplete?: () => void;
  onTextSelect?: (selection: TextSelection) => void;
  /** Highlights for this page */
  highlights?: Highlight[];
  /** Callback when highlight is clicked */
  onHighlightClick?: (highlight: Highlight) => void;
  /** Currently selected highlight ID */
  selectedHighlightId?: string;
  /** Whether this page is bookmarked */
  isBookmarked?: boolean;
  onBookmarkToggle?: () => void;
}

// In the render:
return (
  <div className="pdf-page" ...>
    <canvas ref={canvasRef} className="pdf-canvas" />
    {dimensions.width > 0 && (
      <>
        <PDFTextLayer
          page={page}
          zoom={zoom}
          onTextSelect={onTextSelect}
        />
        <PDFHighlightLayer
          highlights={highlights || []}
          pageWidth={dimensions.width}
          pageHeight={dimensions.height}
          onHighlightClick={onHighlightClick}
          selectedHighlightId={selectedHighlightId}
        />
      </>
    )}
    {isBookmarked && (/* bookmark indicator */)}
  </div>
);
```

### Create Highlight from Selection

Add helper function to create highlight from text selection:

```typescript
// In PDFViewer.tsx or a separate utility

function createHighlightFromSelection(
  selection: TextSelection,
  documentId: string,
  color: HighlightColor,
  pageWidth: number,
  pageHeight: number
): Omit<Highlight, 'id' | 'createdAt'> {
  // Get page-relative rects
  const normalizedRects = normalizeRects(selection.rects, pageWidth, pageHeight);

  return {
    documentId,
    page: selection.page,
    color,
    text: selection.text,
    rects: normalizedRects,
  };
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useHighlights.ts` | Create | Highlight CRUD hook |
| `src/lib/highlight-utils.ts` | Create | Coordinate normalization utilities |
| `src/components/pdf/PDFHighlightLayer.tsx` | Create | Highlight rendering layer |
| `src/components/pdf/PDFPage.tsx` | Modify | Integrate highlight layer |

## Success Criteria

1. [x] `src/hooks/useHighlights.ts` exists
2. [x] useHighlights loads highlights from localStorage
3. [x] addHighlight creates highlight with UUID and timestamp
4. [x] removeHighlight removes from localStorage and state
5. [x] updateHighlightNote allows note editing (max 2000 chars)
6. [x] updateHighlightColor changes highlight color
7. [x] highlightsByPage groups highlights correctly
8. [x] `src/lib/highlight-utils.ts` exists
9. [x] normalizeRects converts to 0-1 range
10. [x] denormalizeRects converts back to pixels
11. [x] `src/components/pdf/PDFHighlightLayer.tsx` exists
12. [x] Highlights render with correct colors
13. [x] Highlights are clickable
14. [x] Note indicator shows when highlight has note
15. [x] Highlights render correctly at different zoom levels
16. [x] PDFPage integrates highlight layer
17. [x] `npm run type-check` passes
18. [x] `npm run lint` passes

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
