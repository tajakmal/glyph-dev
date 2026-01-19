---
task: Performance Optimization
priority: 5
depends_on: ["005-pdf-viewer-component", "009-text-layer-selection", "014-highlights-system"]
---

# Task: Performance Optimization

Implement page virtualization and memory management to handle large PDFs efficiently.

## Overview

This task optimizes the PDF viewer for large documents. The key optimizations are: page virtualization (only rendering pages in/near the viewport), canvas memory cleanup (releasing off-screen canvases), lazy text extraction (only extracting text when needed), and proper loading states throughout.

## Context

- Performance targets from PRD Section 11
- 100-page PDF should load in <2s
- Memory should stay stable during scrolling
- Search should still work with virtualization
- Intersection Observer API for visibility detection

## Requirements

### Page Virtualization

**File:** `src/components/pdf/PDFViewer.tsx` (major update)

```typescript
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { usePDF } from '@/hooks/usePDF';
import { PDFPage } from './PDFPage';

interface VirtualizedPage {
  pageNumber: number;
  page: PDFPageProxy | null;
  isVisible: boolean;
  isLoading: boolean;
}

interface PDFViewerProps {
  documentId: string;
  initialPage?: number;
  initialZoom?: number;
  onPageChange?: (page: number) => void;
  onDocumentLoad?: (pageCount: number) => void;
}

// Number of pages to render beyond viewport
const OVERSCAN = 2;

export function PDFViewer({
  documentId,
  initialPage = 1,
  initialZoom = 1,
  onPageChange,
  onDocumentLoad,
}: PDFViewerProps) {
  const { pdf, isLoading, error, pageCount } = usePDF({ documentId });
  const [zoom, setZoom] = useState(initialZoom);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 5 });
  const [pageHeights, setPageHeights] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Estimate page heights for scroll calculation
  const estimatedPageHeight = useMemo(() => {
    // Default estimate based on standard page ratio
    return 800 * zoom;
  }, [zoom]);

  // Calculate which pages should be rendered
  useEffect(() => {
    const container = containerRef.current;
    if (!container || pageCount === 0) return;

    const updateVisibleRange = () => {
      const scrollTop = container.scrollTop;
      const viewportHeight = container.clientHeight;

      // Estimate which pages are visible based on scroll position
      const pageHeight = estimatedPageHeight + 16; // Include gap
      const startPage = Math.max(0, Math.floor(scrollTop / pageHeight) - OVERSCAN);
      const endPage = Math.min(
        pageCount - 1,
        Math.ceil((scrollTop + viewportHeight) / pageHeight) + OVERSCAN
      );

      setVisibleRange({ start: startPage, end: endPage });
    };

    // Initial calculation
    updateVisibleRange();

    // Update on scroll
    const handleScroll = () => {
      updateVisibleRange();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [pageCount, estimatedPageHeight]);

  // Calculate total height for scroll area
  const totalHeight = useMemo(() => {
    return pageCount * (estimatedPageHeight + 16); // page height + gap
  }, [pageCount, estimatedPageHeight]);

  // Render loading placeholder
  const renderPlaceholder = (pageNumber: number) => (
    <div
      key={pageNumber}
      className="pdf-page-placeholder bg-zinc-800 animate-pulse"
      style={{
        height: estimatedPageHeight,
        marginBottom: 16,
      }}
      data-page-number={pageNumber}
    >
      <div className="flex items-center justify-center h-full text-zinc-600">
        Page {pageNumber}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
          <p className="text-zinc-400 text-sm">Loading PDF...</p>
        </div>
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
      <div
        className="flex flex-col items-center py-4"
        style={{ minHeight: totalHeight }}
      >
        {Array.from({ length: pageCount }, (_, i) => {
          const pageNumber = i + 1;
          const isInRange = i >= visibleRange.start && i <= visibleRange.end;

          // Calculate top position for absolute positioning
          const topOffset = i * (estimatedPageHeight + 16) + 16;

          if (!isInRange) {
            // Render spacer for non-visible pages
            return (
              <div
                key={pageNumber}
                style={{
                  height: estimatedPageHeight,
                  marginBottom: 16,
                }}
                data-page-number={pageNumber}
              />
            );
          }

          return (
            <VirtualizedPDFPage
              key={pageNumber}
              pdf={pdf!}
              pageNumber={pageNumber}
              zoom={zoom}
              ref={(el) => {
                if (el) pageRefs.current.set(pageNumber, el);
                else pageRefs.current.delete(pageNumber);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
```

### Virtualized PDF Page Component

**File:** `src/components/pdf/VirtualizedPDFPage.tsx`

```typescript
'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { renderPage } from '@/lib/pdf-utils';
import { PDFTextLayer } from './PDFTextLayer';
import { PDFHighlightLayer } from './PDFHighlightLayer';
import type { Highlight } from '@/types';

interface VirtualizedPDFPageProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  highlights?: Highlight[];
  onHighlightClick?: (highlight: Highlight) => void;
  onTextSelect?: (selection: any) => void;
}

export const VirtualizedPDFPage = forwardRef<HTMLDivElement, VirtualizedPDFPageProps>(
  function VirtualizedPDFPage(
    { pdf, pageNumber, zoom, highlights, onHighlightClick, onTextSelect },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [page, setPage] = useState<PDFPageProxy | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isRendered, setIsRendered] = useState(false);

    // Forward ref
    useImperativeHandle(ref, () => containerRef.current!, []);

    // Load page
    useEffect(() => {
      let isMounted = true;

      pdf.getPage(pageNumber).then((loadedPage) => {
        if (isMounted) {
          setPage(loadedPage);
        }
      });

      return () => {
        isMounted = false;
      };
    }, [pdf, pageNumber]);

    // Render page
    useEffect(() => {
      if (!page || !canvasRef.current) return;

      const render = async () => {
        try {
          await renderPage(page, canvasRef.current!, zoom);

          const dpr = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: zoom * dpr });

          setDimensions({
            width: viewport.width / dpr,
            height: viewport.height / dpr,
          });
          setIsRendered(true);
        } catch (error) {
          console.error(`Failed to render page ${pageNumber}:`, error);
        }
      };

      render();

      // Cleanup canvas memory when unmounting
      return () => {
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          // Release canvas memory
          canvasRef.current.width = 0;
          canvasRef.current.height = 0;
        }
      };
    }, [page, zoom, pageNumber]);

    return (
      <div
        ref={containerRef}
        className="pdf-page"
        data-page-number={pageNumber}
        data-testid={`pdf-page-${pageNumber}`}
        style={{
          width: dimensions.width || 'auto',
          height: dimensions.height || 800 * zoom, // Default height
        }}
      >
        <canvas ref={canvasRef} className="pdf-canvas" />

        {isRendered && page && (
          <>
            <PDFTextLayer
              page={page}
              zoom={zoom}
              onTextSelect={onTextSelect}
            />
            {highlights && (
              <PDFHighlightLayer
                highlights={highlights.filter(h => h.page === pageNumber)}
                pageWidth={dimensions.width}
                pageHeight={dimensions.height}
                onHighlightClick={onHighlightClick}
              />
            )}
          </>
        )}

        {/* Loading indicator */}
        {!isRendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
            <div className="text-zinc-500 text-sm">Loading page {pageNumber}...</div>
          </div>
        )}
      </div>
    );
  }
);
```

### Intersection Observer for Lazy Loading

```typescript
// Alternative approach using Intersection Observer

function usePageVisibility(
  containerRef: React.RefObject<HTMLElement>,
  pageCount: number
) {
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages(prev => {
          const next = new Set(prev);
          entries.forEach(entry => {
            const pageNumber = parseInt(
              entry.target.getAttribute('data-page-number') || '0'
            );
            if (entry.isIntersecting) {
              // Add page and neighbors
              next.add(pageNumber);
              if (pageNumber > 1) next.add(pageNumber - 1);
              if (pageNumber < pageCount) next.add(pageNumber + 1);
            } else {
              // Keep page in set for a bit to prevent flashing
              // Could add debouncing here
            }
          });
          return next;
        });
      },
      {
        root: container,
        rootMargin: '200px 0px', // Load pages 200px before they're visible
        threshold: 0,
      }
    );

    // Observe all page placeholders
    container.querySelectorAll('[data-page-placeholder]').forEach(el => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [containerRef, pageCount]);

  return visiblePages;
}
```

### Text Extraction Cache

**File:** `src/hooks/useTextCache.ts`

```typescript
'use client';

import { useRef, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getTextContent } from '@/lib/pdf-utils';

export function useTextCache(pdf: PDFDocumentProxy | null) {
  const cache = useRef<Map<number, string>>(new Map());

  const getPageText = useCallback(async (pageIndex: number): Promise<string> => {
    // Check cache
    if (cache.current.has(pageIndex)) {
      return cache.current.get(pageIndex)!;
    }

    if (!pdf) return '';

    // Extract and cache
    const page = await pdf.getPage(pageIndex + 1);
    const textContent = await getTextContent(page);
    const text = textContent.items
      .map(item => ('str' in item ? item.str : ''))
      .join('');

    cache.current.set(pageIndex, text);
    return text;
  }, [pdf]);

  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  return { getPageText, clearCache };
}
```

### Memory Monitoring (Development)

```typescript
// Development utility for monitoring memory
export function useMemoryMonitor(enabled = process.env.NODE_ENV === 'development') {
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        console.log('Memory:', {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [enabled]);
}
```

### Loading States

Add skeleton loaders for better UX:

```typescript
// Skeleton for document card
export function DocumentCardSkeleton() {
  return (
    <div className="w-[200px] rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse">
      <div className="aspect-[0.714] bg-zinc-800 rounded-t-xl" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-zinc-800 rounded w-3/4" />
        <div className="h-3 bg-zinc-800 rounded w-1/2" />
      </div>
    </div>
  );
}

// Skeleton for sidebar content
export function SidebarContentSkeleton() {
  return (
    <div className="p-3 space-y-3 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex gap-2">
          <div className="w-4 h-4 bg-zinc-800 rounded" />
          <div className="flex-1 h-4 bg-zinc-800 rounded" />
        </div>
      ))}
    </div>
  );
}
```

### Error Boundary

**File:** `src/components/ErrorBoundary.tsx`

```typescript
'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <h2 className="text-xl text-zinc-200 mb-2">Something went wrong</h2>
          <p className="text-zinc-400 text-sm mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/pdf/PDFViewer.tsx` | Modify | Add page virtualization |
| `src/components/pdf/VirtualizedPDFPage.tsx` | Create | Page with memory cleanup |
| `src/hooks/useTextCache.ts` | Create | Text extraction cache |
| `src/components/ErrorBoundary.tsx` | Create | Error boundary component |
| `src/components/Skeletons.tsx` | Create | Skeleton loading components |

## Success Criteria

1. [x] Page virtualization only renders pages in/near viewport
2. [x] Pages outside viewport show placeholder with correct height
3. [x] Canvas memory is released when page is unmounted
4. [x] Text extraction is cached per page
5. [x] 100-page PDF loads in under 2 seconds
6. [x] Memory stays stable when scrolling through large document
7. [x] Search still works with virtualization
8. [x] Highlights render correctly on virtualized pages
9. [x] Smooth scrolling through large documents
10. [x] Loading states show during page render
11. [x] Error boundary catches and displays errors gracefully
12. [x] Skeleton loaders show during initial load
13. [x] Performance acceptable on mobile devices
14. [x] No memory leaks detected during extended use
15. [x] `npm run type-check` passes
16. [x] `npm run lint` passes

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
