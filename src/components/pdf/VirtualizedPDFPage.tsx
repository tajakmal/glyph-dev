'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import type { SearchMatch, PDFHighlight } from '@/types';
import { PDFTextLayer, TextSelection } from './PDFTextLayer';
import { PDFHighlightLayer } from './PDFHighlightLayer';

interface VirtualizedPDFPageProps {
  /** PDF document proxy */
  pdf: PDFDocumentProxy;
  /** Page number (1-based) */
  pageNumber: number;
  /** Zoom level (1 = 100%) */
  zoom: number;
  /** Highlights for this page */
  highlights?: PDFHighlight[];
  /** Callback when highlight is clicked */
  onHighlightClick?: (highlight: PDFHighlight) => void;
  /** Currently selected highlight ID */
  selectedHighlightId?: string;
  /** Callback when text is selected */
  onTextSelect?: (selection: TextSelection) => void;
  /** Search matches for this page */
  searchMatches?: SearchMatch[];
  /** Index of the active match (global index) */
  activeMatchIndex?: number;
  /** All matches for active match calculation */
  allMatches?: SearchMatch[];
  /** Whether this page is bookmarked */
  isBookmarked?: boolean;
  /** Toggle bookmark callback */
  onBookmarkToggle?: () => void;
  /** Callback when page dimensions are known */
  onDimensionsReady?: (width: number, height: number) => void;
  /** Word index on this page to highlight (from speed-read return) */
  wordHighlightIndex?: number;
}

export const VirtualizedPDFPage = forwardRef<HTMLDivElement, VirtualizedPDFPageProps>(
  function VirtualizedPDFPage(
    {
      pdf,
      pageNumber,
      zoom,
      highlights,
      onHighlightClick,
      selectedHighlightId,
      onTextSelect,
      searchMatches = [],
      activeMatchIndex = -1,
      allMatches = [],
      isBookmarked,
      onBookmarkToggle,
      onDimensionsReady,
      wordHighlightIndex,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [page, setPage] = useState<PDFPageProxy | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isRendered, setIsRendered] = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);

    // Word highlight overlay rect (for speed-read return highlight)
    const [wordHighlightRect, setWordHighlightRect] = useState<{
      x: number; y: number; width: number; height: number;
    } | null>(null);
    const highlightRafRef = useRef<number>(0);

    useEffect(() => {
      cancelAnimationFrame(highlightRafRef.current);

      if (wordHighlightIndex == null || !isRendered) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clearing overlay when target is removed
        setWordHighlightRect(null);
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      // Poll every frame until the word span is available (text layer is async).
      // This avoids the MutationObserver race condition where mutations can fire
      // between a failed querySelector and observer.observe().
      const startTime = performance.now();
      let scrolled = false;

      const poll = () => {
        const wordSpan = container.querySelector(
          `span[data-word-index="${wordHighlightIndex}"]`
        ) as HTMLElement | null;

        if (wordSpan) {
          const containerRect = container.getBoundingClientRect();
          const spanRect = wordSpan.getBoundingClientRect();
          setWordHighlightRect({
            x: spanRect.left - containerRect.left,
            y: spanRect.top - containerRect.top,
            width: spanRect.width,
            height: spanRect.height,
          });
          if (!scrolled) {
            scrolled = true;
            wordSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return; // done
        }

        // Give up after 3 seconds
        if (performance.now() - startTime < 3000) {
          highlightRafRef.current = requestAnimationFrame(poll);
        }
      };

      // Start polling after a short delay to let React commit the text layer
      highlightRafRef.current = requestAnimationFrame(poll);

      return () => {
        cancelAnimationFrame(highlightRafRef.current);
      };
    }, [wordHighlightIndex, isRendered, zoom]);

    // Use ref for callback to avoid infinite render loops
    const onDimensionsReadyRef = useRef(onDimensionsReady);
    useEffect(() => {
      onDimensionsReadyRef.current = onDimensionsReady;
    }, [onDimensionsReady]);

    // Forward ref
    useImperativeHandle(ref, () => containerRef.current!, []);

    // Load page
    useEffect(() => {
      let isMounted = true;

      pdf.getPage(pageNumber).then((loadedPage) => {
        if (isMounted) {
          setPage(loadedPage);
        }
      }).catch((error) => {
        if (isMounted) {
          console.error(`Failed to load page ${pageNumber}:`, error);
          setRenderError('Failed to load page');
        }
      });

      return () => {
        isMounted = false;
      };
    }, [pdf, pageNumber]);

    // Render page
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!page || !canvas) return;

      let isMounted = true;
      let renderTask: RenderTask | null = null;

      const render = async () => {
        try {
          const dpr = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: zoom * dpr });

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / dpr}px`;
          canvas.style.height = `${viewport.height / dpr}px`;

          const ctx = canvas.getContext('2d')!;

          renderTask = page.render({
            canvasContext: ctx,
            canvas,
            viewport,
          });

          await renderTask.promise;

          if (!isMounted) return;

          const newDimensions = {
            width: viewport.width / dpr,
            height: viewport.height / dpr,
          };

          setDimensions(newDimensions);
          setIsRendered(true);
          setRenderError(null);
          onDimensionsReadyRef.current?.(newDimensions.width, newDimensions.height);
        } catch (error) {
          // Ignore cancellation errors - they're expected when zoom changes rapidly
          if (error instanceof Error && error.name === 'RenderingCancelledException') {
            return;
          }
          if (isMounted) {
            console.error(`Failed to render page ${pageNumber}:`, error);
            setRenderError('Failed to render page');
          }
        }
      };

      render();

      // Cleanup: cancel in-flight render and release canvas memory
      return () => {
        isMounted = false;
        if (renderTask) {
          renderTask.cancel();
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        // Release canvas memory by resetting dimensions
        canvas.width = 0;
        canvas.height = 0;
      };
    }, [page, zoom, pageNumber]);

    if (renderError) {
      return (
        <div
          ref={containerRef}
          className="pdf-page bg-zinc-800 flex items-center justify-center"
          data-page-number={pageNumber}
          data-testid={`pdf-page-${pageNumber}`}
          style={{
            width: dimensions.width || 'auto',
            height: dimensions.height || 800 * zoom,
            marginBottom: 16,
          }}
        >
          <div className="text-zinc-500 text-sm text-center p-4">
            <p>{renderError}</p>
            <p className="text-xs text-zinc-600 mt-1">Page {pageNumber}</p>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="pdf-page"
        data-page-number={pageNumber}
        data-testid={`pdf-page-${pageNumber}`}
        style={{
          width: dimensions.width || 'auto',
          height: dimensions.height || 800 * zoom,
        }}
      >
        <canvas ref={canvasRef} className="pdf-canvas" />

        {isRendered && page && (
          <>
            <PDFTextLayer
              page={page}
              zoom={zoom}
              onTextSelect={onTextSelect}
              searchMatches={searchMatches}
              activeMatchIndex={activeMatchIndex}
              allMatches={allMatches}
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

        {/* Word highlight overlay for speed-read return */}
        {wordHighlightRect && (
          <div
            className="word-return-highlight"
            style={{
              position: 'absolute',
              left: wordHighlightRect.x,
              top: wordHighlightRect.y,
              width: wordHighlightRect.width,
              height: wordHighlightRect.height,
              backgroundColor: 'rgba(251, 146, 60, 0.55)',
              boxShadow: '0 0 0 2px rgba(251, 146, 60, 0.4)',
              borderRadius: 2,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}

        {/* Bookmark indicator */}
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

        {/* Loading indicator */}
        {!isRendered && !renderError && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 animate-pulse">
            <div className="text-zinc-500 text-sm">Loading page {pageNumber}...</div>
          </div>
        )}
      </div>
    );
  }
);
