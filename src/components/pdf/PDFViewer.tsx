'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Bookmark, Highlight, HighlightColor } from '@/types';
import { usePDF } from '@/hooks/usePDF';
import { usePDFSearch } from '@/hooks/usePDFSearch';
import { usePDFOutline } from '@/hooks/usePDFOutline';
import { useZoomKeyboard } from '@/hooks/useZoomKeyboard';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useHighlights } from '@/hooks/useHighlights';
import { VirtualizedPDFPage } from './VirtualizedPDFPage';
import { PDFControls } from './PDFControls';
import { PDFSearch } from './PDFSearch';
import { PDFSidebar } from './PDFSidebar';
import { SelectionPopover, HighlightPopover } from './PDFHighlightPopover';
import type { TextSelection } from './PDFTextLayer';
import { normalizeRects } from '@/lib/highlight-utils';
import { downloadAnnotations } from '@/lib/export';
import { navigateToSpeedRead, navigateToDocumentSpeedRead } from '@/lib/speed-read';

// Number of pages to render beyond the visible viewport
const OVERSCAN_PAGES = 2;

// Default estimated page height (used before actual dimensions are known)
const DEFAULT_PAGE_HEIGHT = 800;

// Gap between pages in pixels
const PAGE_GAP = 16;

interface PDFViewerProps {
  /** Document ID to load */
  documentId: string;
  /** Initial page to scroll to (1-based) */
  initialPage?: number;
  /** Initial zoom level (default: 1) */
  initialZoom?: number;
  /** Document title (overrides PDF metadata) */
  title?: string;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Callback when document loads */
  onDocumentLoad?: (pageCount: number) => void;
}

export function PDFViewer({
  documentId,
  initialPage = 1,
  initialZoom = 1,
  title,
  onPageChange,
  onDocumentLoad,
}: PDFViewerProps) {
  const router = useRouter();
  const { pdf, isLoading, error, meta, pageCount } = usePDF({ documentId });
  const [zoom, setZoom] = useState(initialZoom);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [searchOpen, setSearchOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Virtualization state - which pages are currently visible
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 5 });

  // Track actual page heights for accurate scrolling (keyed by page number)
  const [pageHeights, setPageHeights] = useState<Map<number, number>>(new Map());

  // Track page dimensions for highlight normalization
  const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map());

  // Selection popover state
  const [selectionPopover, setSelectionPopover] = useState<{
    selection: TextSelection;
    anchorRect: { x: number; y: number };
  } | null>(null);

  // Highlight popover state
  const [highlightPopover, setHighlightPopover] = useState<{
    highlight: Highlight;
    anchorRect: { x: number; y: number };
  } | null>(null);

  // Sidebar state with localStorage persistence
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('glyph:sidebar-open');
    return stored !== null ? JSON.parse(stored) : true;
  });

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('glyph:sidebar-open', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev: boolean) => !prev);
  }, []);

  // Highlights
  const {
    highlights,
    addHighlight,
    removeHighlight,
    updateHighlightNote,
    updateHighlightColor,
    getHighlightsForPage,
  } = useHighlights({ documentId });

  // PDF Search
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    matches: searchMatches,
    currentMatchIndex,
    matchCount,
    isSearching,
    nextMatch,
    previousMatch,
    clearSearch,
    getMatchesForPage,
  } = usePDFSearch({ pdf });

  // Bookmarks
  const {
    bookmarks,
    isPageBookmarked,
    toggleBookmark,
    removeBookmark,
    updateBookmark,
  } = useBookmarks({ documentId });

  // PDF Outline (Table of Contents)
  const { outline, isLoading: isOutlineLoading } = usePDFOutline({ pdf });

  // Preserve scroll position when zooming
  const handleZoomChange = useCallback((newZoom: number) => {
    const container = containerRef.current;
    if (!container) {
      setZoom(newZoom);
      return;
    }

    // Get current scroll center
    const scrollCenter = container.scrollTop + container.clientHeight / 2;
    const scrollRatio = scrollCenter / container.scrollHeight;

    setZoom(newZoom);

    // After re-render, restore scroll position
    requestAnimationFrame(() => {
      const newScrollCenter = container.scrollHeight * scrollRatio;
      container.scrollTop = newScrollCenter - container.clientHeight / 2;
    });
  }, []);

  // Navigate to specific page
  const handlePageChange = useCallback((page: number) => {
    const container = containerRef.current;
    if (!container) return;

    const pageElement = container.querySelector(`[data-page-number="${page}"]`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Add keyboard shortcuts
  useZoomKeyboard({
    zoom,
    onZoomChange: handleZoomChange,
  });

  // Add pinch zoom
  usePinchZoom({
    elementRef: containerRef,
    zoom,
    onZoomChange: handleZoomChange,
  });

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

  // Handle S key to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 's' || e.key === 'S') {
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // Close search handler
  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    clearSearch();
  }, [clearSearch]);

  // Scroll to match when current match changes
  useEffect(() => {
    if (searchMatches.length === 0) return;

    const match = searchMatches[currentMatchIndex];
    if (!match) return;

    // Scroll to the page containing the match
    const pageElement = containerRef.current?.querySelector(
      `[data-page-number="${match.pageIndex + 1}"]`
    );

    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatchIndex, searchMatches]);

  // Calculate estimated page height based on zoom
  const estimatedPageHeight = useMemo(() => {
    return DEFAULT_PAGE_HEIGHT * zoom;
  }, [zoom]);

  // Calculate total height of all pages for scroll container
  const totalHeight = useMemo(() => {
    let height = PAGE_GAP; // Initial padding
    for (let i = 1; i <= pageCount; i++) {
      const pageHeight = pageHeights.get(i) || estimatedPageHeight;
      height += pageHeight + PAGE_GAP;
    }
    return height;
  }, [pageCount, pageHeights, estimatedPageHeight]);

  // Calculate page offset (top position) for a given page number
  const getPageOffset = useCallback((pageNumber: number): number => {
    let offset = PAGE_GAP;
    for (let i = 1; i < pageNumber; i++) {
      const pageHeight = pageHeights.get(i) || estimatedPageHeight;
      offset += pageHeight + PAGE_GAP;
    }
    return offset;
  }, [pageHeights, estimatedPageHeight]);

  // Notify when document loads
  useEffect(() => {
    if (pageCount > 0) {
      onDocumentLoad?.(pageCount);
    }
  }, [pageCount, onDocumentLoad]);

  // Calculate visible range based on scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container || pageCount === 0) return;

    const updateVisibleRange = () => {
      const scrollTop = container.scrollTop;
      const viewportHeight = container.clientHeight;

      // Find first visible page
      let startPage = 1;
      let accumulatedHeight = PAGE_GAP;
      for (let i = 1; i <= pageCount; i++) {
        const pageHeight = pageHeights.get(i) || estimatedPageHeight;
        if (accumulatedHeight + pageHeight > scrollTop) {
          startPage = i;
          break;
        }
        accumulatedHeight += pageHeight + PAGE_GAP;
      }

      // Find last visible page
      let endPage = startPage;
      accumulatedHeight = getPageOffset(startPage);
      for (let i = startPage; i <= pageCount; i++) {
        const pageHeight = pageHeights.get(i) || estimatedPageHeight;
        accumulatedHeight += pageHeight + PAGE_GAP;
        endPage = i;
        if (accumulatedHeight > scrollTop + viewportHeight) {
          break;
        }
      }

      // Apply overscan
      const overscanStart = Math.max(1, startPage - OVERSCAN_PAGES);
      const overscanEnd = Math.min(pageCount, endPage + OVERSCAN_PAGES);

      setVisibleRange(prev => {
        if (prev.start !== overscanStart || prev.end !== overscanEnd) {
          return { start: overscanStart, end: overscanEnd };
        }
        return prev;
      });
    };

    // Initial calculation
    updateVisibleRange();

    // Update on scroll (passive for performance)
    container.addEventListener('scroll', updateVisibleRange, { passive: true });
    return () => container.removeEventListener('scroll', updateVisibleRange);
  }, [pageCount, pageHeights, estimatedPageHeight, getPageOffset]);

  // Handle page dimensions update from VirtualizedPDFPage
  const handlePageDimensionsReady = useCallback((pageNumber: number, width: number, height: number) => {
    setPageHeights(prev => {
      const next = new Map(prev);
      next.set(pageNumber, height);
      return next;
    });
    setPageDimensions(prev => {
      const next = new Map(prev);
      next.set(pageNumber, { width, height });
      return next;
    });
  }, []);

  // Restore scroll position when returning from speed reader
  useEffect(() => {
    const saved = sessionStorage.getItem('glyph:reader-scroll');
    if (saved && pageCount > 0) {
      try {
        const { documentId: savedId, scrollTop } = JSON.parse(saved);
        if (savedId === documentId && containerRef.current) {
          // Use requestAnimationFrame to wait for rendering
          requestAnimationFrame(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = scrollTop;
            }
          });
        }
        sessionStorage.removeItem('glyph:reader-scroll');
      } catch {
        sessionStorage.removeItem('glyph:reader-scroll');
      }
    }
  }, [documentId, pageCount]);

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

  // Sidebar handlers
  const handleBookmarkClick = useCallback((bookmark: Bookmark) => {
    handlePageChange(bookmark.page);
  }, [handlePageChange]);

  const handleSidebarHighlightClick = useCallback((highlight: Highlight) => {
    handlePageChange(highlight.page);
  }, [handlePageChange]);

  const handleExport = useCallback(() => {
    if (highlights.length === 0 || !meta) {
      return;
    }
    downloadAnnotations(meta, highlights);
  }, [highlights, meta]);

  // Handle Ctrl+Shift+E for export
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        handleExport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExport]);

  // Handle text selection from PDFPage
  const handleTextSelect = useCallback((selection: TextSelection) => {
    // Close any existing highlight popover
    setHighlightPopover(null);

    // Get anchor position (center-top of first rect in viewport coordinates)
    const firstRect = selection.rects[0];
    if (!firstRect) return;

    // Find the page element to get its viewport position
    const pageElement = containerRef.current?.querySelector(
      `[data-page-number="${selection.page}"]`
    );
    if (!pageElement) return;

    const pageRect = pageElement.getBoundingClientRect();

    // Calculate anchor position in viewport coordinates
    const anchorX = pageRect.left + firstRect.x + firstRect.width / 2;
    const anchorY = pageRect.top + firstRect.y;

    setSelectionPopover({
      selection,
      anchorRect: { x: anchorX, y: anchorY },
    });
  }, []);

  // Handle highlight click from PDFPage
  const handleHighlightClick = useCallback((highlight: Highlight) => {
    // Close any existing selection popover
    setSelectionPopover(null);

    // Find the page element to calculate position
    const pageElement = containerRef.current?.querySelector(
      `[data-page-number="${highlight.page}"]`
    );
    if (!pageElement) return;

    const pageRect = pageElement.getBoundingClientRect();
    const dims = pageDimensions.get(highlight.page);

    // Use first rect of highlight for anchor position
    if (highlight.rects.length > 0 && dims) {
      const firstRect = highlight.rects[0];
      const anchorX = pageRect.left + firstRect.x * dims.width + (firstRect.width * dims.width) / 2;
      const anchorY = pageRect.top + firstRect.y * dims.height;

      setHighlightPopover({
        highlight,
        anchorRect: { x: anchorX, y: anchorY },
      });
    }
  }, [pageDimensions]);

  // Create highlight from selection
  const handleCreateHighlight = useCallback((color: HighlightColor, note?: string) => {
    if (!selectionPopover) return;

    const { selection } = selectionPopover;
    const dims = pageDimensions.get(selection.page);

    if (!dims) return;

    // Normalize rects to 0-1 range
    const normalizedRects = normalizeRects(selection.rects, dims.width, dims.height);

    addHighlight({
      documentId,
      page: selection.page,
      color,
      text: selection.text,
      rects: normalizedRects,
      note: note || undefined,
    });

    // Clear selection
    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionPopover, pageDimensions, addHighlight, documentId]);

  // Close selection popover
  const handleCloseSelectionPopover = useCallback(() => {
    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Close highlight popover
  const handleCloseHighlightPopover = useCallback(() => {
    setHighlightPopover(null);
  }, []);

  // Speed read handler for selection
  const handleSpeedReadSelection = useCallback(() => {
    if (!selectionPopover) return;

    // Save scroll position before navigating
    if (containerRef.current) {
      sessionStorage.setItem('glyph:reader-scroll', JSON.stringify({
        documentId,
        scrollTop: containerRef.current.scrollTop,
      }));
    }

    navigateToSpeedRead(router, selectionPopover.selection.text, {
      returnPath: `/reader/${documentId}`,
    });

    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionPopover, router, documentId]);

  // Speed read handler for highlight
  const handleSpeedReadHighlight = useCallback(() => {
    if (!highlightPopover) return;

    // Save scroll position before navigating
    if (containerRef.current) {
      sessionStorage.setItem('glyph:reader-scroll', JSON.stringify({
        documentId,
        scrollTop: containerRef.current.scrollTop,
      }));
    }

    navigateToSpeedRead(router, highlightPopover.highlight.text, {
      returnPath: `/reader/${documentId}`,
    });

    setHighlightPopover(null);
  }, [highlightPopover, router, documentId]);

  // Speed read handler for full document
  const handleSpeedReadDocument = useCallback(() => {
    // Save scroll position before navigating
    if (containerRef.current) {
      sessionStorage.setItem('glyph:reader-scroll', JSON.stringify({
        documentId,
        scrollTop: containerRef.current.scrollTop,
      }));
    }

    navigateToDocumentSpeedRead(router, documentId, `/reader/${documentId}`);
  }, [router, documentId]);

  // Update highlight color
  const handleUpdateHighlightColor = useCallback((color: HighlightColor) => {
    if (!highlightPopover) return;
    updateHighlightColor(highlightPopover.highlight.id, color);
    // Update the popover state with new color
    setHighlightPopover(prev => prev ? {
      ...prev,
      highlight: { ...prev.highlight, color }
    } : null);
  }, [highlightPopover, updateHighlightColor]);

  // Update highlight note
  const handleUpdateHighlightNote = useCallback((note: string) => {
    if (!highlightPopover) return;
    updateHighlightNote(highlightPopover.highlight.id, note);
    // Update the popover state with new note
    setHighlightPopover(prev => prev ? {
      ...prev,
      highlight: { ...prev.highlight, note }
    } : null);
  }, [highlightPopover, updateHighlightNote]);

  // Delete highlight
  const handleDeleteHighlight = useCallback(() => {
    if (!highlightPopover) return;
    removeHighlight(highlightPopover.highlight.id);
    setHighlightPopover(null);
  }, [highlightPopover, removeHighlight]);

  // Get document title
  const documentTitle = title || meta?.title || 'Untitled Document';

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
    <div className="flex flex-col h-full">
      <PDFControls
        zoom={zoom}
        onZoomChange={handleZoomChange}
        currentPage={currentPage}
        pageCount={pageCount}
        onPageChange={handlePageChange}
        title={documentTitle}
        onSidebarToggle={toggleSidebar}
        isSidebarOpen={sidebarOpen}
        isBookmarked={isPageBookmarked(currentPage)}
        onBookmarkToggle={() => toggleBookmark(currentPage)}
        onSpeedReadDocument={handleSpeedReadDocument}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <PDFSidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          documentTitle={documentTitle}
          outline={outline}
          isOutlineLoading={isOutlineLoading}
          bookmarks={bookmarks}
          highlights={highlights}
          onOutlineClick={handlePageChange}
          onBookmarkClick={handleBookmarkClick}
          onBookmarkDelete={removeBookmark}
          onBookmarkRename={updateBookmark}
          onHighlightClick={handleSidebarHighlightClick}
          onExport={handleExport}
        />
        <div
          ref={containerRef}
          className="pdf-viewer overflow-auto flex-1 bg-zinc-900 relative"
          data-testid="pdf-viewer"
        >
          {/* Search UI */}
          {searchOpen && (
            <PDFSearch
              query={searchQuery}
              onQueryChange={setSearchQuery}
              currentMatch={currentMatchIndex}
              totalMatches={matchCount}
              isSearching={isSearching}
              onNext={nextMatch}
              onPrevious={previousMatch}
              onClose={handleCloseSearch}
            />
          )}
          {/* Virtualized page container with total height for scrolling */}
          <div
            className="flex flex-col items-center relative"
            style={{ minHeight: totalHeight }}
          >
            {pdf && Array.from({ length: pageCount }, (_, i) => {
              const pageNumber = i + 1;
              const isInRange = pageNumber >= visibleRange.start && pageNumber <= visibleRange.end;
              const pageHeight = pageHeights.get(pageNumber) || estimatedPageHeight;
              const topOffset = getPageOffset(pageNumber);

              if (!isInRange) {
                // Render placeholder for non-visible pages
                return (
                  <div
                    key={pageNumber}
                    className="pdf-page-placeholder"
                    style={{
                      position: 'absolute',
                      top: topOffset,
                      height: pageHeight,
                      width: pageDimensions.get(pageNumber)?.width || 'auto',
                    }}
                    data-page-number={pageNumber}
                    data-placeholder="true"
                  />
                );
              }

              // Render actual virtualized page
              return (
                <div
                  key={pageNumber}
                  style={{
                    position: 'absolute',
                    top: topOffset,
                  }}
                >
                  <VirtualizedPDFPage
                    pdf={pdf}
                    pageNumber={pageNumber}
                    zoom={zoom}
                    searchMatches={getMatchesForPage(i)}
                    activeMatchIndex={currentMatchIndex}
                    allMatches={searchMatches}
                    isBookmarked={isPageBookmarked(pageNumber)}
                    onBookmarkToggle={() => toggleBookmark(pageNumber)}
                    highlights={getHighlightsForPage(pageNumber)}
                    onHighlightClick={handleHighlightClick}
                    selectedHighlightId={highlightPopover?.highlight.id}
                    onTextSelect={handleTextSelect}
                    onDimensionsReady={(width, height) => {
                      handlePageDimensionsReady(pageNumber, width, height);
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Selection Popover */}
          {selectionPopover && (
            <SelectionPopover
              text={selectionPopover.selection.text}
              page={selectionPopover.selection.page}
              anchorRect={selectionPopover.anchorRect}
              onCreateHighlight={handleCreateHighlight}
              onSpeedRead={handleSpeedReadSelection}
              onClose={handleCloseSelectionPopover}
            />
          )}

          {/* Highlight Popover */}
          {highlightPopover && (
            <HighlightPopover
              highlight={highlightPopover.highlight}
              anchorRect={highlightPopover.anchorRect}
              onUpdateNote={handleUpdateHighlightNote}
              onUpdateColor={handleUpdateHighlightColor}
              onDelete={handleDeleteHighlight}
              onSpeedRead={handleSpeedReadHighlight}
              onClose={handleCloseHighlightPopover}
            />
          )}
        </div>
      </div>
    </div>
  );
}
