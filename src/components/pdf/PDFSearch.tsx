'use client';

import React, { useRef, useEffect } from 'react';

interface PDFSearchProps {
  /** Current query */
  query: string;
  /** Set query */
  onQueryChange: (query: string) => void;
  /** Current match index (0-based) */
  currentMatch: number;
  /** Total matches */
  totalMatches: number;
  /** Is searching */
  isSearching: boolean;
  /** Go to next match */
  onNext: () => void;
  /** Go to previous match */
  onPrevious: () => void;
  /** Close search */
  onClose: () => void;
}

export function PDFSearch({
  query,
  onQueryChange,
  currentMatch,
  totalMatches,
  isSearching,
  onNext,
  onPrevious,
  onClose,
}: PDFSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrevious();
      } else {
        onNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="absolute top-2 right-2 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2 flex items-center gap-2">
      {/* Search icon */}
      <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search in document..."
        className="w-48 bg-transparent text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none"
      />

      {/* Match counter */}
      <div className="text-zinc-400 text-sm min-w-[60px] text-center">
        {isSearching ? (
          <span className="text-zinc-500">...</span>
        ) : totalMatches > 0 ? (
          <span>{currentMatch + 1} / {totalMatches}</span>
        ) : query ? (
          <span className="text-zinc-500">0 / 0</span>
        ) : null}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPrevious}
          disabled={totalMatches === 0}
          className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous match"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onNext}
          disabled={totalMatches === 0}
          className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next match"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="p-1 text-zinc-400 hover:text-zinc-100"
        aria-label="Close search"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
