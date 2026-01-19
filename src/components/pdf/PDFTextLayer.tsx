'use client';

import React, { useRef, useEffect } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { SearchMatch } from '@/types';
import { getTextContent } from '@/lib/pdf-utils';

interface PDFTextLayerProps {
  /** PDF page proxy */
  page: PDFPageProxy;
  /** Current zoom level */
  zoom: number;
  /** Callback when text is selected */
  onTextSelect?: (selection: TextSelection) => void;
  /** Search matches for this page */
  searchMatches?: SearchMatch[];
  /** Index of the active match (global index across all pages) */
  activeMatchIndex?: number;
  /** All matches (to calculate if this page has active match) */
  allMatches?: SearchMatch[];
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

// Helper function to escape HTML (prevents XSS)
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function PDFTextLayer({
  page,
  zoom,
  onTextSelect,
  searchMatches = [],
  activeMatchIndex = -1,
  allMatches = [],
}: PDFTextLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate the active match for this page
  const pageIndex = page.pageNumber - 1;
  const activeMatch = allMatches[activeMatchIndex];
  const activeMatchOnThisPage = activeMatch?.pageIndex === pageIndex ? activeMatch : null;

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

      // Track cumulative character position for search highlighting
      let charPosition = 0;

      // Render each text item as a span
      textContent.items.forEach((item) => {
        if (!('str' in item) || !item.str) return;

        const tx = item.transform;
        // PDF.js transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]

        const span = document.createElement('span');

        // Calculate position from transform matrix
        // tx[4] = x position, tx[5] = y position
        // tx[0] = font size scale
        const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * zoom;
        const left = tx[4] * zoom;
        const top = viewport.height - (tx[5] * zoom) - fontSize;

        span.style.left = `${left}px`;
        span.style.top = `${top}px`;
        span.style.fontSize = `${fontSize}px`;

        // Check if this text item contains any search matches
        const itemStart = charPosition;
        const itemEnd = charPosition + item.str.length;

        // Find matches that overlap with this text item
        const overlappingMatches = searchMatches.filter(match =>
          match.startIndex < itemEnd && match.endIndex > itemStart
        );

        if (overlappingMatches.length > 0) {
          // Build highlighted text with spans for matches
          let html = '';
          let lastIndex = 0;

          for (const match of overlappingMatches) {
            // Calculate relative positions within this text item
            const relStart = Math.max(0, match.startIndex - itemStart);
            const relEnd = Math.min(item.str.length, match.endIndex - itemStart);

            // Add text before match
            if (relStart > lastIndex) {
              html += escapeHtml(item.str.slice(lastIndex, relStart));
            }

            // Check if this match is the active one
            const isActive = activeMatchOnThisPage?.matchIndex === match.matchIndex;
            const activeClass = isActive ? ' search-match-active' : '';

            // Add highlighted match
            html += `<mark class="pdf-search-highlight${activeClass}">${escapeHtml(item.str.slice(relStart, relEnd))}</mark>`;
            lastIndex = relEnd;
          }

          // Add remaining text
          if (lastIndex < item.str.length) {
            html += escapeHtml(item.str.slice(lastIndex));
          }

          span.innerHTML = html;
        } else {
          span.textContent = item.str;
        }

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
        charPosition += item.str.length;
      });
    };

    renderTextLayer();

    return () => {
      isMounted = false;
    };
  }, [page, zoom, searchMatches, activeMatchOnThisPage]);

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
