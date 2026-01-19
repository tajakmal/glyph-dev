'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { SearchMatch, Highlight } from '@/types';
import { renderPage } from '@/lib/pdf-utils';
import { PDFTextLayer, TextSelection } from './PDFTextLayer';
import { PDFHighlightLayer } from './PDFHighlightLayer';

interface PDFPageProps {
  /** PDF page proxy */
  page: PDFPageProxy;
  /** Page number (1-based) */
  pageNumber: number;
  /** Zoom level (1 = 100%) */
  zoom: number;
  /** Optional: callback when rendered */
  onRenderComplete?: () => void;
  /** Optional: callback when text is selected */
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
  /** Highlights for this page */
  highlights?: Highlight[];
  /** Callback when highlight is clicked */
  onHighlightClick?: (highlight: Highlight) => void;
  /** Currently selected highlight ID */
  selectedHighlightId?: string;
}

export function PDFPage({
  page,
  pageNumber,
  zoom,
  onRenderComplete,
  onTextSelect,
  searchMatches = [],
  activeMatchIndex = -1,
  allMatches = [],
  isBookmarked,
  onBookmarkToggle,
  highlights,
  onHighlightClick,
  selectedHighlightId,
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
    </div>
  );
}
