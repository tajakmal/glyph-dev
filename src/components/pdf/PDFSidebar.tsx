'use client';

import React, { useState } from 'react';
import type { PDFOutlineItem, Bookmark, Highlight } from '@/types';
import { PDFOutline } from './PDFOutline';
import { PDFBookmarks } from './PDFBookmarks';

interface PDFSidebarProps {
  /** Is sidebar open */
  isOpen: boolean;
  /** Toggle sidebar */
  onToggle: () => void;
  /** Document title */
  documentTitle: string;
  /** Outline items */
  outline: PDFOutlineItem[];
  /** Is outline loading */
  isOutlineLoading?: boolean;
  /** Bookmarks */
  bookmarks: Bookmark[];
  /** Highlights */
  highlights: Highlight[];
  /** Callback when outline item clicked */
  onOutlineClick: (page: number) => void;
  /** Callback when bookmark clicked */
  onBookmarkClick: (bookmark: Bookmark) => void;
  /** Callback when bookmark deleted */
  onBookmarkDelete: (id: string) => void;
  /** Callback when bookmark renamed */
  onBookmarkRename: (id: string, label: string) => void;
  /** Callback when highlight clicked */
  onHighlightClick: (highlight: Highlight) => void;
  /** Callback for export */
  onExport: () => void;
}

type TabType = 'contents' | 'bookmarks' | 'highlights';

function getHighlightColor(color: string): string {
  const colors: Record<string, string> = {
    yellow: '#fde047',
    green: '#86efac',
    blue: '#93c5fd',
    pink: '#f9a8d4',
    orange: '#fdba74',
  };
  return colors[color] || colors.yellow;
}

function PDFHighlightsList({
  highlights,
  onHighlightClick,
}: {
  highlights: Highlight[];
  onHighlightClick: (highlight: Highlight) => void;
}) {
  if (highlights.length === 0) {
    return (
      <div className="p-4 text-zinc-500 text-sm text-center">
        No highlights yet.
        <br />
        Select text to create a highlight.
      </div>
    );
  }

  // Group by page
  const byPage = highlights.reduce((acc, h) => {
    if (!acc[h.page]) acc[h.page] = [];
    acc[h.page].push(h);
    return acc;
  }, {} as Record<number, Highlight[]>);

  return (
    <div className="py-2">
      {Object.entries(byPage)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([page, pageHighlights]) => (
          <div key={page}>
            <div className="px-3 py-1 text-xs text-zinc-500 font-medium bg-zinc-800/50">
              Page {page}
            </div>
            {pageHighlights.map((highlight) => (
              <div
                key={highlight.id}
                className="px-3 py-2 hover:bg-zinc-800/50 cursor-pointer"
                onClick={() => onHighlightClick(highlight)}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: getHighlightColor(highlight.color) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300 text-sm line-clamp-2">
                      &quot;{highlight.text.slice(0, 100)}{highlight.text.length > 100 ? '...' : ''}&quot;
                    </p>
                    {highlight.note && (
                      <p className="text-zinc-500 text-xs mt-1 line-clamp-1">
                        Note: {highlight.note}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

export function PDFSidebar({
  isOpen,
  onToggle,
  documentTitle,
  outline,
  isOutlineLoading,
  bookmarks,
  highlights,
  onOutlineClick,
  onBookmarkClick,
  onBookmarkDelete,
  onBookmarkRename,
  onHighlightClick,
  onExport,
}: PDFSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('contents');

  if (!isOpen) {
    return null;
  }

  return (
    <div className="w-[280px] h-full bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <h2 className="text-zinc-200 text-sm font-medium truncate flex-1" title={documentTitle}>
          {documentTitle}
        </h2>
        <button
          onClick={onToggle}
          className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded"
          aria-label="Close sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('contents')}
          className={`flex-1 py-2 text-sm transition-colors ${
            activeTab === 'contents'
              ? 'text-red-500 border-b-2 border-red-500'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Contents
        </button>
        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`flex-1 py-2 text-sm transition-colors ${
            activeTab === 'bookmarks'
              ? 'text-red-500 border-b-2 border-red-500'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Bookmarks
          {bookmarks.length > 0 && (
            <span className="ml-1 text-xs text-zinc-500">({bookmarks.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('highlights')}
          className={`flex-1 py-2 text-sm transition-colors ${
            activeTab === 'highlights'
              ? 'text-red-500 border-b-2 border-red-500'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Notes
          {highlights.length > 0 && (
            <span className="ml-1 text-xs text-zinc-500">({highlights.length})</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'contents' && (
          <PDFOutline
            outline={outline}
            onItemClick={onOutlineClick}
            isLoading={isOutlineLoading}
          />
        )}
        {activeTab === 'bookmarks' && (
          <PDFBookmarks
            bookmarks={bookmarks}
            onBookmarkClick={onBookmarkClick}
            onBookmarkDelete={onBookmarkDelete}
            onBookmarkRename={onBookmarkRename}
          />
        )}
        {activeTab === 'highlights' && (
          <PDFHighlightsList
            highlights={highlights}
            onHighlightClick={onHighlightClick}
          />
        )}
      </div>

      {/* Export Button */}
      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={onExport}
          disabled={highlights.length === 0}
          className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Export Annotations
        </button>
      </div>
    </div>
  );
}
