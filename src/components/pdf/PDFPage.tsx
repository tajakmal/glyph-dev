'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { SearchMatch } from '@/types';
import { renderPage } from '@/lib/pdf-utils';
import { PDFTextLayer, TextSelection } from './PDFTextLayer';

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
          searchMatches={searchMatches}
          activeMatchIndex={activeMatchIndex}
          allMatches={allMatches}
        />
      )}
      {/* Highlight layer will be added in later task */}
    </div>
  );
}
