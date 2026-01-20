'use client';

import React from 'react';
import type { PDFHighlight } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';
import { denormalizeRects } from '@/lib/highlight-utils';

interface PDFHighlightLayerProps {
  /** Highlights for this page */
  highlights: PDFHighlight[];
  /** Page width in pixels */
  pageWidth: number;
  /** Page height in pixels */
  pageHeight: number;
  /** Callback when highlight is clicked */
  onHighlightClick?: (highlight: PDFHighlight) => void;
  /** Currently selected highlight ID */
  selectedHighlightId?: string;
}

export function PDFHighlightLayer({
  highlights,
  pageWidth,
  pageHeight,
  onHighlightClick,
  selectedHighlightId,
}: PDFHighlightLayerProps) {
  return (
    <div className="pdf-highlight-layer">
      {highlights.map((highlight) => {
        const pixelRects = denormalizeRects(highlight.rects, pageWidth, pageHeight);
        const isSelected = highlight.id === selectedHighlightId;
        const colorInfo = HIGHLIGHT_COLORS[highlight.color];

        return (
          <div key={highlight.id} className="highlight-group">
            {pixelRects.map((rect, index) => (
              <div
                key={index}
                className={`
                  absolute cursor-pointer transition-all
                  ${isSelected ? 'ring-2 ring-offset-1 ring-zinc-400' : ''}
                  hover:brightness-90
                `}
                style={{
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  backgroundColor: colorInfo.bg,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onHighlightClick?.(highlight);
                }}
                data-highlight-id={highlight.id}
              />
            ))}
            {/* Note indicator */}
            {highlight.note && pixelRects.length > 0 && (
              <div
                className="absolute w-3 h-3 bg-zinc-700 rounded-full flex items-center justify-center cursor-pointer hover:bg-zinc-600"
                style={{
                  left: `${pixelRects[pixelRects.length - 1].x + pixelRects[pixelRects.length - 1].width + 4}px`,
                  top: `${pixelRects[pixelRects.length - 1].y}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onHighlightClick?.(highlight);
                }}
                title="View note"
              >
                <svg className="w-2 h-2 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
