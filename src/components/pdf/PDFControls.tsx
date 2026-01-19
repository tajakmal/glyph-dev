'use client';

import React from 'react';
import { VALIDATION } from '@/types';

interface PDFControlsProps {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  /** Set zoom level */
  onZoomChange: (zoom: number) => void;
  /** Current page number (1-based) */
  currentPage: number;
  /** Total page count */
  pageCount: number;
  /** Go to specific page */
  onPageChange: (page: number) => void;
  /** Document title */
  title?: string;
  /** Toggle sidebar */
  onSidebarToggle?: () => void;
  /** Is sidebar open */
  isSidebarOpen?: boolean;
  /** Is current page bookmarked */
  isBookmarked?: boolean;
  /** Toggle bookmark on current page */
  onBookmarkToggle?: () => void;
}

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function PDFControls({
  zoom,
  onZoomChange,
  currentPage,
  pageCount,
  onPageChange,
  title,
  onSidebarToggle,
  isSidebarOpen,
  isBookmarked,
  onBookmarkToggle,
}: PDFControlsProps) {
  const zoomIn = () => {
    const newZoom = Math.min(zoom + VALIDATION.ZOOM_STEP, VALIDATION.MAX_ZOOM);
    onZoomChange(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(zoom - VALIDATION.ZOOM_STEP, VALIDATION.MIN_ZOOM);
    onZoomChange(newZoom);
  };

  const resetZoom = () => {
    onZoomChange(1);
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
      {/* Left: Sidebar toggle and title */}
      <div className="flex items-center gap-3">
        {onSidebarToggle && (
          <button
            onClick={onSidebarToggle}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {title && (
          <span className="text-zinc-300 text-sm font-medium truncate max-w-[200px]" title={title}>
            {title}
          </span>
        )}
      </div>

      {/* Center: Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={zoomOut}
          disabled={zoom <= VALIDATION.MIN_ZOOM}
          className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom out"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <select
          value={zoom}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          className="bg-zinc-800 text-zinc-300 text-sm rounded-lg px-2 py-1 border border-zinc-700 focus:outline-none focus:border-zinc-600"
        >
          {ZOOM_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {Math.round(preset * 100)}%
            </option>
          ))}
          {!ZOOM_PRESETS.includes(zoom) && (
            <option value={zoom}>{zoomPercent}%</option>
          )}
        </select>

        <button
          onClick={zoomIn}
          disabled={zoom >= VALIDATION.MAX_ZOOM}
          className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom in"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button
          onClick={resetZoom}
          className="px-2 py-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg text-sm transition-colors"
          aria-label="Reset zoom to fit width"
        >
          Fit
        </button>
      </div>

      {/* Right: Bookmark and Page indicator */}
      <div className="flex items-center gap-3">
        {onBookmarkToggle && (
          <button
            onClick={onBookmarkToggle}
            className={`p-2 rounded-lg transition-colors ${
              isBookmarked
                ? 'text-red-500 bg-red-500/10'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            aria-pressed={isBookmarked}
          >
            <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={currentPage}
            onChange={(e) => {
              const page = parseInt(e.target.value);
              if (page >= 1 && page <= pageCount) {
                onPageChange(page);
              }
            }}
            className="w-12 bg-zinc-800 text-zinc-300 text-center rounded px-1 py-0.5 border border-zinc-700"
          />
          <span>of {pageCount}</span>
        </div>
      </div>
    </div>
  );
}
