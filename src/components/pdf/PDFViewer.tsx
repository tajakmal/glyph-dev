'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const { pdf, isLoading, error, pageCount: _pageCount } = usePDF({ documentId });
  const [zoom, _setZoom] = useState(initialZoom);
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
