'use client';

import React, { useRef, useEffect } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { getTextContent } from '@/lib/pdf-utils';

interface PDFTextLayerProps {
  /** PDF page proxy */
  page: PDFPageProxy;
  /** Current zoom level */
  zoom: number;
  /** Callback when text is selected */
  onTextSelect?: (selection: TextSelection) => void;
}

export interface TextSelection {
  /** Selected text content */
  text: string;
  /** Page number (1-based) */
  page: number;
  /** Bounding rectangles of selection (page coordinates) */
  rects: DOMRect[];
  /** Range object for the selection */
  range: Range | null;
}

export function PDFTextLayer({ page, zoom, onTextSelect }: PDFTextLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isMounted = true;

    const renderTextLayer = async () => {
      // Clear existing content
      container.innerHTML = '';

      // Get text content from PDF
      const textContent = await getTextContent(page);

      if (!isMounted) return;

      // Get viewport for positioning
      const viewport = page.getViewport({ scale: zoom });

      // Render each text item as a span
      textContent.items.forEach((item) => {
        if (!('str' in item) || !item.str) return;

        const tx = item.transform;
        // PDF.js transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]

        const span = document.createElement('span');
        span.textContent = item.str;

        // Calculate position from transform matrix
        // tx[4] = x position, tx[5] = y position
        // tx[0] = font size scale
        const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * zoom;
        const left = tx[4] * zoom;
        const top = viewport.height - (tx[5] * zoom) - fontSize;

        span.style.left = `${left}px`;
        span.style.top = `${top}px`;
        span.style.fontSize = `${fontSize}px`;

        // Handle text width scaling
        if (item.width) {
          const actualWidth = item.width * zoom;
          const textWidth = span.offsetWidth || fontSize * item.str.length * 0.5;
          const scaleX = actualWidth / textWidth;
          if (scaleX > 0 && isFinite(scaleX)) {
            span.style.transform = `scaleX(${scaleX})`;
            span.style.transformOrigin = 'left bottom';
          }
        }

        container.appendChild(span);
      });
    };

    renderTextLayer();

    return () => {
      isMounted = false;
    };
  }, [page, zoom]);

  // Handle selection events
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onTextSelect) return;

    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const text = selection.toString().trim();
      if (!text) return;

      // Get selection range
      const range = selection.getRangeAt(0);

      // Check if selection is within this text layer
      if (!container.contains(range.commonAncestorContainer)) return;

      // Get bounding rects
      const rects = Array.from(range.getClientRects());

      // Convert to page coordinates
      const containerRect = container.getBoundingClientRect();
      const pageRects = rects.map(rect => new DOMRect(
        rect.x - containerRect.x,
        rect.y - containerRect.y,
        rect.width,
        rect.height
      ));

      onTextSelect({
        text,
        page: page.pageNumber,
        rects: pageRects,
        range: range.cloneRange(),
      });
    };

    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [page, onTextSelect]);

  return (
    <div
      ref={containerRef}
      className="pdf-text-layer allow-select"
      data-testid={`pdf-text-layer-${page.pageNumber}`}
    />
  );
}
