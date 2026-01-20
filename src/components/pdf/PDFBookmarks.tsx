'use client';

import React, { useState } from 'react';
import type { PDFBookmark } from '@/types';

interface PDFBookmarksProps {
  bookmarks: PDFBookmark[];
  onBookmarkClick: (bookmark: PDFBookmark) => void;
  onBookmarkDelete: (id: string) => void;
  onBookmarkRename: (id: string, label: string) => void;
}

export function PDFBookmarks({
  bookmarks,
  onBookmarkClick,
  onBookmarkDelete,
  onBookmarkRename,
}: PDFBookmarksProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleDoubleClick = (bookmark: PDFBookmark) => {
    setEditingId(bookmark.id);
    setEditValue(bookmark.label || `Page ${bookmark.page}`);
  };

  const handleRenameSubmit = (id: string) => {
    if (editValue.trim()) {
      onBookmarkRename(id, editValue.trim());
    }
    setEditingId(null);
  };

  if (bookmarks.length === 0) {
    return (
      <div className="p-4 text-zinc-500 text-sm text-center">
        No bookmarks yet.
        <br />
        Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs">B</kbd> to bookmark the current page.
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-800">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/50 cursor-pointer group"
          onClick={() => onBookmarkClick(bookmark)}
          onDoubleClick={() => handleDoubleClick(bookmark)}
        >
          {/* Bookmark icon */}
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>

          {/* Label */}
          <div className="flex-1 min-w-0">
            {editingId === bookmark.id ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleRenameSubmit(bookmark.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(bookmark.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-zinc-700 text-zinc-100 text-sm rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-500"
                autoFocus
              />
            ) : (
              <>
                <div className="text-zinc-200 text-sm truncate">
                  {bookmark.label || `Page ${bookmark.page}`}
                </div>
                <div className="text-zinc-500 text-xs">
                  Page {bookmark.page}
                </div>
              </>
            )}
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkDelete(bookmark.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-opacity"
            aria-label="Delete bookmark"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
