'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { Bookmark, Highlight, HighlightColor } from '@/types';
import { usePDF } from '@/hooks/usePDF';
import { usePDFSearch } from '@/hooks/usePDFSearch';
import { usePDFOutline } from '@/hooks/usePDFOutline';
import { useZoomKeyboard } from '@/hooks/useZoomKeyboard';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useHighlights } from '@/hooks/useHighlights';
import { PDFPage } from './PDFPage';
import { PDFControls } from './PDFControls';
import { PDFSearch } from './PDFSearch';
import { PDFSidebar } from './PDFSidebar';
import { SelectionPopover, HighlightPopover } from './PDFHighlightPopover';
import type { TextSelection } from './PDFTextLayer';
import { normalizeRects } from '@/lib/highlight-utils';
import { downloadAnnotations } from '@/lib/export';

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
  const { pdf, isLoading, error, meta } = usePDF({ documentId });
  const [zoom, setZoom] = useState(initialZoom);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageCount, setPageCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      setPageCount(pdf.numPages);
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

  // Handle page render to track dimensions
  const handlePageRenderComplete = useCallback((pageNumber: number, width: number, height: number) => {
    setPageDimensions(prev => {
      const next = new Map(prev);
      next.set(pageNumber, { width, height });
      return next;
    });
  }, []);

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

    // Store selected text in sessionStorage for speed reader to access
    sessionStorage.setItem('glyph:speed-read-text', selectionPopover.selection.text);
    router.push('/');

    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionPopover, router]);

  // Speed read handler for highlight
  const handleSpeedReadHighlight = useCallback(() => {
    if (!highlightPopover) return;

    // Store highlight text in sessionStorage for speed reader to access
    sessionStorage.setItem('glyph:speed-read-text', highlightPopover.highlight.text);
    router.push('/');

    setHighlightPopover(null);
  }, [highlightPopover, router]);

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
          <div className="flex flex-col items-center py-4">
            {pages.map((page, index) => (
              <PDFPage
                key={index + 1}
                page={page}
                pageNumber={index + 1}
                zoom={zoom}
                searchMatches={getMatchesForPage(index)}
                activeMatchIndex={currentMatchIndex}
                allMatches={searchMatches}
                isBookmarked={isPageBookmarked(index + 1)}
                onBookmarkToggle={() => toggleBookmark(index + 1)}
                highlights={getHighlightsForPage(index + 1)}
                onHighlightClick={handleHighlightClick}
                selectedHighlightId={highlightPopover?.highlight.id}
                onTextSelect={handleTextSelect}
                onRenderComplete={() => {
                  // Get dimensions from the page element
                  const pageEl = containerRef.current?.querySelector(
                    `[data-page-number="${index + 1}"]`
                  );
                  if (pageEl) {
                    const rect = pageEl.getBoundingClientRect();
                    handlePageRenderComplete(index + 1, rect.width, rect.height);
                  }
                }}
              />
            ))}
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
