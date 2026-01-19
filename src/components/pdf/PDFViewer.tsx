'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { usePDF } from '@/hooks/usePDF';
import { useZoomKeyboard } from '@/hooks/useZoomKeyboard';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { PDFPage } from './PDFPage';
import { PDFControls } from './PDFControls';

interface PDFViewerProps {
  /** Document ID to load */
  documentId: string;
  /** Initial page to scroll to (1-based) */
  initialPage?: number;
  /** Initial zoom level (default: 1) */
  initialZoom?: number;
  /** Document title */
  title?: string;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Callback when document loads */
  onDocumentLoad?: (pageCount: number) => void;
  /** Toggle sidebar */
  onSidebarToggle?: () => void;
  /** Is sidebar open */
  isSidebarOpen?: boolean;
}

export function PDFViewer({
  documentId,
  initialPage = 1,
  initialZoom = 1,
  title,
  onPageChange,
  onDocumentLoad,
  onSidebarToggle,
  isSidebarOpen,
}: PDFViewerProps) {
  const { pdf, isLoading, error } = usePDF({ documentId });
  const [zoom, setZoom] = useState(initialZoom);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageCount, setPageCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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
        title={title}
        onSidebarToggle={onSidebarToggle}
        isSidebarOpen={isSidebarOpen}
      />
      <div
        ref={containerRef}
        className="pdf-viewer overflow-auto flex-1 bg-zinc-900"
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
    </div>
  );
}
