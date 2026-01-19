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
