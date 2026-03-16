'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import { useRouter } from 'next/navigation';
import type { PDFBookmark, PDFHighlight, HighlightColor } from '@/types';
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
import { navigateToSpeedRead, navigateToDocumentSpeedRead, getSpeedReadSession, clearSpeedReadSession } from '@/lib/speed-read';
import { mapWordIndexToPage, buildPageWordCounts } from '@/lib/word-mapping';
import { updateLastReadPage } from '@/lib/storage';
import { getFeatureFlag } from '@/lib/feature-flags';
import { trackEvent } from '@/lib/telemetry';
import { ReaderContext } from '@/contexts/ReaderContext';

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
  const isProgressTrackingEnabled = getFeatureFlag('reader_progress_unified');

  // Optional ReaderContext — enables seamless speed-read switching when available
  const readerCtx = useContext(ReaderContext);
  const [zoom, setZoom] = useState(initialZoom);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [searchOpen, setSearchOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageWordCountsRef = useRef<number[] | null>(null);
  const pageWordCountsPromiseRef = useRef<Promise<number[]> | null>(null);

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
    highlight: PDFHighlight;
    anchorRect: { x: number; y: number };
  } | null>(null);

  // Sidebar state with localStorage persistence
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Default closed on mobile
    if (window.innerWidth < 640) return false;
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
  const handlePageChange = useCallback((page: number, options?: { instant?: boolean }) => {
    const container = containerRef.current;
    if (!container) return;

    const pageElement = container.querySelector(`[data-page-number="${page}"]`);
    if (pageElement) {
      pageElement.scrollIntoView({
        behavior: options?.instant ? 'instant' : 'smooth',
        block: 'start',
      });
    }
  }, []);

  // Register scroll-to-page callback with ReaderContext for bidirectional navigation
  useEffect(() => {
    if (readerCtx) {
      readerCtx.registerPdfScrollToPage(handlePageChange);
    }
  }, [readerCtx, handlePageChange]);

  // Highlight the target word when returning from speed-read.
  // Uses an overlay div (rendered by VirtualizedPDFPage) instead of inline styles,
  // so text layer re-renders don't destroy the highlight.
  const [wordHighlightTarget, setWordHighlightTarget] = useState<{ page: number; indexOnPage: number } | null>(null);
  const prevViewModeRef = useRef(readerCtx?.viewMode);
  const highlightTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const prevMode = prevViewModeRef.current;
    const curMode = readerCtx?.viewMode;
    prevViewModeRef.current = curMode;

    if (prevMode === 'speed-read' && curMode === 'pdf' && readerCtx) {
      const wordIndex = readerCtx.currentWordIndex;
      const { page, indexOnPage } = mapWordIndexToPage(wordIndex, readerCtx.pageWordCounts);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: responding to view mode transition
      setWordHighlightTarget({ page, indexOnPage });

      // Clear any previous timers
      highlightTimersRef.current.forEach(clearTimeout);
      highlightTimersRef.current = [];

      // Auto-clear after 8 seconds
      highlightTimersRef.current.push(
        setTimeout(() => setWordHighlightTarget(null), 8000)
      );

      // Clear on user interaction (delayed so "Back to Reader" click doesn't immediately clear)
      const clearOnInteraction = () => {
        setWordHighlightTarget(null);
        highlightTimersRef.current.forEach(clearTimeout);
        highlightTimersRef.current = [];
      };
      highlightTimersRef.current.push(
        setTimeout(() => {
          document.addEventListener('pointerdown', clearOnInteraction, { once: true });
        }, 1500)
      );
    }
    // Only track viewMode changes — readerCtx ref is stable
  }, [readerCtx?.viewMode, readerCtx]);

  const getPageWordCounts = useCallback(async (): Promise<number[]> => {
    if (!pdf) return [];
    if (pageWordCountsRef.current) return pageWordCountsRef.current;
    if (pageWordCountsPromiseRef.current) return pageWordCountsPromiseRef.current;

    pageWordCountsPromiseRef.current = buildPageWordCounts(pdf)
      .then((counts) => {
        pageWordCountsRef.current = counts;
        pageWordCountsPromiseRef.current = null;
        return counts;
      })
      .catch((error) => {
        pageWordCountsPromiseRef.current = null;
        throw error;
      });

    return pageWordCountsPromiseRef.current;
  }, [pdf]);

  useEffect(() => {
    pageWordCountsRef.current = null;
    pageWordCountsPromiseRef.current = null;
  }, [documentId, pdf]);

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
        trackEvent('pdf_reader_bookmark_toggled', {
          documentId,
          page: currentPage,
          source: 'keyboard',
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, toggleBookmark, documentId]);

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

  useEffect(() => {
    if (!isProgressTrackingEnabled || pageCount === 0) return;
    updateLastReadPage(documentId, currentPage);
  }, [isProgressTrackingEnabled, documentId, currentPage, pageCount]);

  // Check for speed read session and scroll to the page with focus highlight
  useEffect(() => {
    if (!pdf || isLoading || pageCount === 0) return;

    const session = getSpeedReadSession();
    if (!session || session.documentId !== documentId || session.kind !== 'pdf') {
      return;
    }

    // Clear the session to prevent re-triggering
    clearSpeedReadSession();

    // Build page word counts to map word index to page
    getPageWordCounts().then((pageWordCounts) => {
      const { page } = mapWordIndexToPage(session.wordIndex, pageWordCounts);

      // Navigate to the page
      const container = containerRef.current;
      if (!container) return;

      const pageElement = container.querySelector(`[data-page-number="${page}"]`);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add temporary focus highlight to the page
        // Note: For PDFs, we highlight the page since mapping to specific word positions
        // within the rendered text layer is complex and may not be reliable
        pageElement.classList.add('ring-4', 'ring-zinc-400', 'ring-offset-2', 'ring-offset-zinc-950');

        // Remove highlight on user interaction or after 3 seconds
        const clearHighlight = () => {
          pageElement.classList.remove('ring-4', 'ring-zinc-400', 'ring-offset-2', 'ring-offset-zinc-950');
          container.removeEventListener('scroll', clearHighlight);
          document.removeEventListener('click', clearHighlight);
        };

        // Set up listeners to clear on interaction
        container.addEventListener('scroll', clearHighlight, { once: true });
        document.addEventListener('click', clearHighlight, { once: true });

        // Also clear after 3 seconds
        setTimeout(clearHighlight, 3000);
      }
    });
  }, [pdf, isLoading, pageCount, documentId, getPageWordCounts]);

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

  // Track current page on scroll using scrollTop-based calculation
  // This works reliably even when pages are virtualized (not rendered in DOM)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || pageCount === 0) return;

    const calculateCurrentPage = () => {
      const scrollTop = container.scrollTop;
      // Use a small offset so the indicator updates as soon as user enters a page
      const viewportOffset = container.clientHeight * 0.25;
      const scrollPosition = scrollTop + viewportOffset;

      // Find which page contains this scroll position using accumulated heights
      let accumulatedHeight = PAGE_GAP;
      for (let i = 1; i <= pageCount; i++) {
        const pageHeight = pageHeights.get(i) || estimatedPageHeight;
        const pageBottom = accumulatedHeight + pageHeight;

        if (scrollPosition < pageBottom) {
          return i;
        }
        accumulatedHeight = pageBottom + PAGE_GAP;
      }

      // If we've scrolled past all pages, return the last page
      return pageCount;
    };

    const handleScroll = () => {
      const newPage = calculateCurrentPage();
      if (newPage !== currentPage) {
        setCurrentPage(newPage);
        onPageChange?.(newPage);
      }
    };

    // Calculate initial page
    handleScroll();

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentPage, pageCount, pageHeights, estimatedPageHeight, onPageChange]);

  // Sidebar handlers
  const handleBookmarkClick = useCallback((bookmark: PDFBookmark) => {
    handlePageChange(bookmark.page);
  }, [handlePageChange]);

  const handleSidebarHighlightClick = useCallback((highlight: PDFHighlight) => {
    handlePageChange(highlight.page);
  }, [handlePageChange]);

  const handleExport = useCallback(() => {
    if (highlights.length === 0 || !meta) {
      return;
    }
    downloadAnnotations(meta, highlights);
    trackEvent('pdf_reader_export_annotations', {
      documentId,
      highlightCount: highlights.length,
    });
  }, [highlights, meta, documentId]);

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
  const handleHighlightClick = useCallback((highlight: PDFHighlight) => {
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
    trackEvent('pdf_reader_highlight_created', {
      documentId,
      page: selection.page,
      color,
      hasNote: Boolean(note && note.trim()),
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
  // Uses ReaderContext for instant switching when available, falls back to router navigation
  const handleSpeedReadSelection = useCallback(async () => {
    if (!selectionPopover || !pdf) return;

    const { page, startWordOnPage } = selectionPopover.selection;

    // Try to map selection to global word index
    if (page !== undefined && startWordOnPage !== undefined) {
      try {
        const pageWordCounts = await getPageWordCounts();
        let startWordIndex = 0;
        for (let i = 0; i < page - 1; i++) {
          startWordIndex += pageWordCounts[i] || 0;
        }
        startWordIndex += startWordOnPage;

        // Use context for instant switching (no page navigation)
        if (readerCtx) {
          readerCtx.startSpeedReadAt(startWordIndex);
          trackEvent('pdf_reader_speedread_started', {
            documentId,
            source: 'selection',
            startWordIndex,
          });
          setSelectionPopover(null);
          window.getSelection()?.removeAllRanges();
          return;
        }

        // Fallback: router-based navigation
        if (containerRef.current) {
          sessionStorage.setItem('glyph:reader-scroll', JSON.stringify({
            documentId,
            scrollTop: containerRef.current.scrollTop,
          }));
        }
        navigateToDocumentSpeedRead(router, documentId, {
          returnPath: `/reader/${documentId}`,
          startWordIndex,
          kind: 'pdf',
        });
        trackEvent('pdf_reader_speedread_started', {
          documentId,
          source: 'selection',
          startWordIndex,
        });

        setSelectionPopover(null);
        window.getSelection()?.removeAllRanges();
        return;
      } catch (error) {
        console.warn('Failed to map selection to word index, falling back to selection text:', error);
      }
    }

    // Fallback: speed read just the selection text
    navigateToSpeedRead(router, selectionPopover.selection.text, {
      returnPath: `/reader/${documentId}`,
    });
    trackEvent('pdf_reader_speedread_started', {
      documentId,
      source: 'selection_fallback',
    });

    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionPopover, pdf, router, documentId, getPageWordCounts, readerCtx]);

  // Speed read handler for highlight
  const handleSpeedReadHighlight = useCallback(async () => {
    if (!highlightPopover) return;

    // With context: map highlight to word index for full-document speed read
    if (readerCtx) {
      try {
        const pageWordCounts = await getPageWordCounts();
        const { page } = highlightPopover.highlight;
        let startWordIndex = 0;
        for (let i = 0; i < page - 1; i++) {
          startWordIndex += pageWordCounts[i] || 0;
        }
        readerCtx.startSpeedReadAt(startWordIndex);
        trackEvent('pdf_reader_speedread_started', {
          documentId,
          source: 'highlight',
          startWordIndex,
        });
        setHighlightPopover(null);
        return;
      } catch {
        // Fall through to router-based fallback
      }
    }

    // Fallback: router-based navigation with just highlight text
    if (containerRef.current) {
      sessionStorage.setItem('glyph:reader-scroll', JSON.stringify({
        documentId,
        scrollTop: containerRef.current.scrollTop,
      }));
    }

    navigateToSpeedRead(router, highlightPopover.highlight.text, {
      returnPath: `/reader/${documentId}`,
    });
    trackEvent('pdf_reader_speedread_started', {
      documentId,
      source: 'highlight',
    });

    setHighlightPopover(null);
  }, [highlightPopover, router, documentId, readerCtx, getPageWordCounts]);

  // Speed read handler for full document
  const handleSpeedReadDocument = useCallback(async () => {
    // With context: start from current page (instant, no navigation)
    if (readerCtx) {
      try {
        const pageWordCounts = await getPageWordCounts();
        let startWordIndex = 0;
        for (let i = 0; i < currentPage - 1; i++) {
          startWordIndex += pageWordCounts[i] || 0;
        }
        readerCtx.startSpeedReadAt(startWordIndex);
        trackEvent('pdf_reader_speedread_started', {
          documentId,
          source: 'topbar',
          page: currentPage,
        });
        return;
      } catch {
        // Fall through to router-based fallback
      }
    }

    // Fallback: router-based navigation
    if (containerRef.current) {
      sessionStorage.setItem('glyph:reader-scroll', JSON.stringify({
        documentId,
        scrollTop: containerRef.current.scrollTop,
      }));
    }

    navigateToDocumentSpeedRead(router, documentId, {
      returnPath: `/reader/${documentId}`,
      kind: 'pdf',
    });
    trackEvent('pdf_reader_speedread_started', {
      documentId,
      source: 'topbar',
      page: currentPage,
    });
  }, [router, documentId, currentPage, readerCtx, getPageWordCounts]);

  // Update highlight color
  const handleUpdateHighlightColor = useCallback((color: HighlightColor) => {
    if (!highlightPopover) return;
    updateHighlightColor(highlightPopover.highlight.id, color);
    trackEvent('pdf_reader_highlight_color_changed', {
      documentId,
      highlightId: highlightPopover.highlight.id,
      color,
    });
    // Update the popover state with new color
    setHighlightPopover(prev => prev ? {
      ...prev,
      highlight: { ...prev.highlight, color }
    } : null);
  }, [highlightPopover, updateHighlightColor, documentId]);

  // Update highlight note
  const handleUpdateHighlightNote = useCallback((note: string) => {
    if (!highlightPopover) return;
    updateHighlightNote(highlightPopover.highlight.id, note);
    trackEvent('pdf_reader_highlight_note_updated', {
      documentId,
      highlightId: highlightPopover.highlight.id,
      noteLength: note.length,
    });
    // Update the popover state with new note
    setHighlightPopover(prev => prev ? {
      ...prev,
      highlight: { ...prev.highlight, note }
    } : null);
  }, [highlightPopover, updateHighlightNote, documentId]);

  // Delete highlight
  const handleDeleteHighlight = useCallback(() => {
    if (!highlightPopover) return;
    removeHighlight(highlightPopover.highlight.id);
    trackEvent('pdf_reader_highlight_deleted', {
      documentId,
      highlightId: highlightPopover.highlight.id,
    });
    setHighlightPopover(null);
  }, [highlightPopover, removeHighlight, documentId]);

  const handleTopbarBookmarkToggle = useCallback(() => {
    toggleBookmark(currentPage);
    trackEvent('pdf_reader_bookmark_toggled', {
      documentId,
      page: currentPage,
      source: 'topbar',
    });
  }, [toggleBookmark, currentPage, documentId]);

  // Get document title
  const documentTitle = title || meta?.title || 'Untitled Document';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full" />
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
        onBookmarkToggle={handleTopbarBookmarkToggle}
        onSpeedReadDocument={handleSpeedReadDocument}
      />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop */}
        <div
          className={`sm:hidden fixed inset-0 bg-black/50 z-20 transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={toggleSidebar}
        />
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
                    onBookmarkToggle={() => {
                      toggleBookmark(pageNumber);
                      trackEvent('pdf_reader_bookmark_toggled', {
                        documentId,
                        page: pageNumber,
                        source: 'page',
                      });
                    }}
                    highlights={getHighlightsForPage(pageNumber)}
                    onHighlightClick={handleHighlightClick}
                    selectedHighlightId={highlightPopover?.highlight.id}
                    onTextSelect={handleTextSelect}
                    onDimensionsReady={(width, height) => {
                      handlePageDimensionsReady(pageNumber, width, height);
                    }}
                    wordHighlightIndex={
                      wordHighlightTarget?.page === pageNumber
                        ? wordHighlightTarget.indexOnPage
                        : undefined
                    }
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
