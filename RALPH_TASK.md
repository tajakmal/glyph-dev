---
task: PDF Viewer Component
priority: 2
depends_on: ["001-typescript-types", "003-global-css-setup", "004-pdf-js-setup"]
---

# Task: PDF Viewer Component

Create the main PDFViewer component and PDFPage component for rendering PDFs with continuous scroll.

## Overview

This task creates the core PDF viewing functionality. The PDFViewer component manages the overall PDF state and renders all pages in a continuous scroll layout. The PDFPage component handles rendering individual pages including the canvas and managing HiDPI displays.

## Context

- PDFViewer is the main container for the reader route
- PDFPage renders a single page with canvas
- Uses PDF.js utilities from the previous task
- Implements continuous scroll with 16px gaps between pages
- Must handle HiDPI (retina) displays correctly
- Components go in `src/components/pdf/`

## Requirements

### usePDF Hook

**File:** `src/hooks/usePDF.ts`

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentMeta } from '@/types';
import { loadPDF } from '@/lib/pdf-utils';
import { getPDFFromStorage } from '@/lib/storage';

interface UsePDFOptions {
  documentId: string;
}

interface UsePDFReturn {
  /** PDF document proxy from pdfjs-dist */
  pdf: PDFDocumentProxy | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if loading failed */
  error: Error | null;
  /** Document metadata */
  meta: DocumentMeta | null;
  /** Total page count */
  pageCount: number;
  /** Reload the PDF */
  reload: () => Promise<void>;
}

export function usePDF(options: UsePDFOptions): UsePDFReturn {
  // Implementation:
  // 1. Load PDF ArrayBuffer from IndexedDB using documentId
  // 2. Pass to loadPDF utility
  // 3. Return PDFDocumentProxy and metadata
  // 4. Handle errors gracefully
}
```

### PDFPage Component

**File:** `src/components/pdf/PDFPage.tsx`

```typescript
'use client';

import React, { useRef, useEffect } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { renderPage } from '@/lib/pdf-utils';

interface PDFPageProps {
  /** PDF page proxy */
  page: PDFPageProxy;
  /** Page number (1-based) */
  pageNumber: number;
  /** Zoom level (1 = 100%) */
  zoom: number;
  /** Optional: callback when rendered */
  onRenderComplete?: () => void;
}

export function PDFPage({ page, pageNumber, zoom, onRenderComplete }: PDFPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    renderPage(page, canvasRef.current, zoom).then(() => {
      onRenderComplete?.();
    });
  }, [page, zoom, onRenderComplete]);

  return (
    <div
      className="pdf-page"
      data-page-number={pageNumber}
      data-testid={`pdf-page-${pageNumber}`}
    >
      <canvas ref={canvasRef} className="pdf-canvas" />
      {/* Text layer and highlight layer will be added in later tasks */}
    </div>
  );
}
```

### PDFViewer Component

**File:** `src/components/pdf/PDFViewer.tsx`

```typescript
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { usePDF } from '@/hooks/usePDF';
import { PDFPage } from './PDFPage';

interface PDFViewerProps {
  /** Document ID to load */
  documentId: string;
  /** Initial page to scroll to (1-based) */
  initialPage?: number;
  /** Initial zoom level (default: 1) */
  initialZoom?: number;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Callback when document loads */
  onDocumentLoad?: (pageCount: number) => void;
}

export function PDFViewer({
  documentId,
  initialPage = 1,
  initialZoom = 1,
  onPageChange,
  onDocumentLoad,
}: PDFViewerProps) {
  const { pdf, isLoading, error, pageCount } = usePDF({ documentId });
  const [zoom, setZoom] = useState(initialZoom);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load all page proxies when PDF is ready
  useEffect(() => {
    if (!pdf) return;

    const loadPages = async () => {
      const loadedPages: PDFPageProxy[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        loadedPages.push(page);
      }
      setPages(loadedPages);
      onDocumentLoad?.(pdf.numPages);
    };

    loadPages();
  }, [pdf, onDocumentLoad]);

  // Track current page on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Find the page that is most visible in the viewport
      const pageElements = container.querySelectorAll('[data-page-number]');
      let mostVisiblePage = 1;
      let maxVisibility = 0;

      pageElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const visibleHeight = Math.min(rect.bottom, containerRect.bottom) -
                             Math.max(rect.top, containerRect.top);
        const visibility = Math.max(0, visibleHeight / rect.height);

        if (visibility > maxVisibility) {
          maxVisibility = visibility;
          mostVisiblePage = parseInt(el.getAttribute('data-page-number') || '1');
        }
      });

      if (mostVisiblePage !== currentPage) {
        setCurrentPage(mostVisiblePage);
        onPageChange?.(mostVisiblePage);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentPage, onPageChange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400">
        <p>Failed to load PDF</p>
        <p className="text-sm text-zinc-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pdf-viewer overflow-auto h-full bg-zinc-900"
      data-testid="pdf-viewer"
    >
      <div className="flex flex-col items-center py-4">
        {pages.map((page, index) => (
          <PDFPage
            key={index + 1}
            page={page}
            pageNumber={index + 1}
            zoom={zoom}
          />
        ))}
      </div>
    </div>
  );
}
```

### Reader Route

**File:** `src/app/reader/[id]/page.tsx`

```typescript
'use client';

import { use } from 'react';
import { PDFViewer } from '@/components/pdf/PDFViewer';

interface ReaderPageProps {
  params: Promise<{ id: string }>;
}

export default function ReaderPage({ params }: ReaderPageProps) {
  const { id } = use(params);

  return (
    <main className="h-screen flex flex-col bg-zinc-950">
      {/* Toolbar will be added in later task */}
      <div className="flex-1 overflow-hidden">
        <PDFViewer documentId={id} />
      </div>
    </main>
  );
}
```

### Styling Requirements

The PDFViewer should:
- Fill the available height
- Center pages horizontally
- Have 16px vertical gap between pages
- Have zinc-900 background
- Show a shadow on each page (from globals.css)

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/usePDF.ts` | Create | Hook for loading and managing PDF state |
| `src/components/pdf/PDFPage.tsx` | Create | Single page rendering component |
| `src/components/pdf/PDFViewer.tsx` | Create | Main viewer container component |
| `src/app/reader/[id]/page.tsx` | Create | Reader route page |

## Success Criteria

1. [x] `src/hooks/usePDF.ts` exists with UsePDFReturn interface
2. [x] usePDF hook loads PDF from storage and returns PDFDocumentProxy
3. [x] usePDF hook handles loading and error states
4. [x] `src/components/pdf/PDFPage.tsx` exists
5. [x] PDFPage renders canvas with correct HiDPI scaling
6. [x] PDFPage has data-page-number attribute for tracking
7. [x] `src/components/pdf/PDFViewer.tsx` exists
8. [x] PDFViewer renders all pages in continuous scroll
9. [x] PDFViewer tracks current page on scroll
10. [x] PDFViewer shows loading spinner during load
11. [x] PDFViewer shows error message on failure
12. [x] `src/app/reader/[id]/page.tsx` route exists
13. [x] Pages have 16px gap between them
14. [x] `npm run type-check` passes
15. [x] `npm run lint` passes

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
