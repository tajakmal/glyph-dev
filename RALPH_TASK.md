---
task: Text Layer and Selection
priority: 3
depends_on: ["003-global-css-setup", "005-pdf-viewer-component"]
---

# Task: Text Layer and Selection

Create the PDFTextLayer component that enables text selection within PDF pages.

## Overview

The text layer is an invisible overlay positioned exactly over the canvas that enables text selection. PDF.js provides text content with position data, which we render as transparent spans. This allows native text selection while the canvas displays the visual content.

## Context

- Component goes in `src/components/pdf/PDFTextLayer.tsx`
- Uses PDF.js text content API
- CSS for text layer already defined in globals.css (Task 003)
- Text layer spans must be positioned to match canvas rendering
- Selection should trigger a callback for highlight creation (future task)

## Requirements

### PDFTextLayer Component

**File:** `src/components/pdf/PDFTextLayer.tsx`

```typescript
'use client';

import React, { useRef, useEffect } from 'react';
import type { PDFPageProxy, TextContent } from 'pdfjs-dist';
import { getTextContent } from '@/lib/pdf-utils';

interface PDFTextLayerProps {
  /** PDF page proxy */
  page: PDFPageProxy;
  /** Current zoom level */
  zoom: number;
  /** Callback when text is selected */
  onTextSelect?: (selection: TextSelection) => void;
}

export interface TextSelection {
  /** Selected text content */
  text: string;
  /** Page number (1-based) */
  page: number;
  /** Bounding rectangles of selection (page coordinates) */
  rects: DOMRect[];
  /** Range object for the selection */
  range: Range | null;
}

export function PDFTextLayer({ page, zoom, onTextSelect }: PDFTextLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isMounted = true;

    const renderTextLayer = async () => {
      // Clear existing content
      container.innerHTML = '';

      // Get text content from PDF
      const textContent = await getTextContent(page);

      if (!isMounted) return;

      // Get viewport for positioning
      const viewport = page.getViewport({ scale: zoom });

      // Render each text item as a span
      textContent.items.forEach((item) => {
        if (!('str' in item) || !item.str) return;

        const tx = item.transform;
        // PDF.js transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]

        const span = document.createElement('span');
        span.textContent = item.str;

        // Calculate position from transform matrix
        // tx[4] = x position, tx[5] = y position
        // tx[0] = font size scale
        const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * zoom;
        const left = tx[4] * zoom;
        const top = viewport.height - (tx[5] * zoom) - fontSize;

        span.style.left = `${left}px`;
        span.style.top = `${top}px`;
        span.style.fontSize = `${fontSize}px`;

        // Handle text width scaling
        if (item.width) {
          const actualWidth = item.width * zoom;
          const textWidth = span.offsetWidth || fontSize * item.str.length * 0.5;
          const scaleX = actualWidth / textWidth;
          if (scaleX > 0 && isFinite(scaleX)) {
            span.style.transform = `scaleX(${scaleX})`;
            span.style.transformOrigin = 'left bottom';
          }
        }

        container.appendChild(span);
      });
    };

    renderTextLayer();

    return () => {
      isMounted = false;
    };
  }, [page, zoom]);

  // Handle selection events
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onTextSelect) return;

    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const text = selection.toString().trim();
      if (!text) return;

      // Get selection range
      const range = selection.getRangeAt(0);

      // Check if selection is within this text layer
      if (!container.contains(range.commonAncestorContainer)) return;

      // Get bounding rects
      const rects = Array.from(range.getClientRects());

      // Convert to page coordinates
      const containerRect = container.getBoundingClientRect();
      const pageRects = rects.map(rect => new DOMRect(
        rect.x - containerRect.x,
        rect.y - containerRect.y,
        rect.width,
        rect.height
      ));

      onTextSelect({
        text,
        page: page.pageNumber,
        rects: pageRects,
        range: range.cloneRange(),
      });
    };

    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [page, onTextSelect]);

  return (
    <div
      ref={containerRef}
      className="pdf-text-layer allow-select"
      data-testid={`pdf-text-layer-${page.pageNumber}`}
    />
  );
}
```

### Update PDFPage Component

Integrate the text layer into PDFPage:

**File:** `src/components/pdf/PDFPage.tsx` (update)

```typescript
'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { renderPage } from '@/lib/pdf-utils';
import { PDFTextLayer, TextSelection } from './PDFTextLayer';

interface PDFPageProps {
  page: PDFPageProxy;
  pageNumber: number;
  zoom: number;
  onRenderComplete?: () => void;
  onTextSelect?: (selection: TextSelection) => void;
}

export function PDFPage({
  page,
  pageNumber,
  zoom,
  onRenderComplete,
  onTextSelect,
}: PDFPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;

    renderPage(page, canvasRef.current, zoom).then(() => {
      // Update dimensions for text layer positioning
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: zoom * dpr });
      setDimensions({
        width: viewport.width / dpr,
        height: viewport.height / dpr,
      });
      onRenderComplete?.();
    });
  }, [page, zoom, onRenderComplete]);

  return (
    <div
      className="pdf-page"
      data-page-number={pageNumber}
      data-testid={`pdf-page-${pageNumber}`}
      style={{
        width: dimensions.width || 'auto',
        height: dimensions.height || 'auto',
      }}
    >
      <canvas ref={canvasRef} className="pdf-canvas" />
      {dimensions.width > 0 && (
        <PDFTextLayer
          page={page}
          zoom={zoom}
          onTextSelect={onTextSelect}
        />
      )}
      {/* Highlight layer will be added in later task */}
    </div>
  );
}
```

### useTextSelection Hook (Optional Helper)

**File:** `src/hooks/useTextSelection.ts`

```typescript
'use client';

import { useState, useCallback } from 'react';
import type { TextSelection } from '@/components/pdf/PDFTextLayer';

interface UseTextSelectionReturn {
  /** Current selection */
  selection: TextSelection | null;
  /** Clear the selection */
  clearSelection: () => void;
  /** Handle a new selection */
  handleSelection: (selection: TextSelection) => void;
  /** Whether there is an active selection */
  hasSelection: boolean;
}

export function useTextSelection(): UseTextSelectionReturn {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    // Also clear browser selection
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleSelection = useCallback((newSelection: TextSelection) => {
    setSelection(newSelection);
  }, []);

  return {
    selection,
    clearSelection,
    handleSelection,
    hasSelection: selection !== null && selection.text.length > 0,
  };
}
```

### Text Layer CSS (Reference from Task 003)

Ensure these styles exist in `globals.css`:

```css
.pdf-text-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  opacity: 0.2;
  line-height: 1;
  pointer-events: auto;
}

.pdf-text-layer span {
  position: absolute;
  white-space: pre;
  color: transparent;
  pointer-events: auto;
}

.pdf-text-layer span::selection {
  background: rgba(59, 130, 246, 0.3);
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/pdf/PDFTextLayer.tsx` | Create | Text layer for selection |
| `src/components/pdf/PDFPage.tsx` | Modify | Integrate text layer |
| `src/hooks/useTextSelection.ts` | Create | Selection state management |

## Success Criteria

1. [x] `src/components/pdf/PDFTextLayer.tsx` exists
2. [x] Text layer renders text spans from PDF.js text content
3. [x] Text spans are positioned to align with canvas content
4. [x] Text is selectable with native browser selection
5. [x] Selection highlight appears in blue (from CSS)
6. [x] onTextSelect callback fires with selection data
7. [x] TextSelection interface includes text, page, rects
8. [x] PDFPage component integrates PDFTextLayer
9. [x] Text layer only renders after canvas has dimensions
10. [x] `src/hooks/useTextSelection.ts` exists
11. [x] useTextSelection provides clearSelection function
12. [x] Selection works correctly at different zoom levels
13. [x] `npm run type-check` passes
14. [x] `npm run lint` passes

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
