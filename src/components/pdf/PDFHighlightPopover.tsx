'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { HighlightColor, Highlight } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';

interface SelectionPopoverProps {
  /** The selected text */
  text: string;
  /** Page number */
  page: number;
  /** Anchor position (top-center of selection) */
  anchorRect: { x: number; y: number };
  /** Create highlight with color */
  onCreateHighlight: (color: HighlightColor, note?: string) => void;
  /** Trigger speed reading */
  onSpeedRead: () => void;
  /** Close popover */
  onClose: () => void;
}

interface HighlightPopoverProps {
  /** The highlight being edited */
  highlight: Highlight;
  /** Anchor position */
  anchorRect: { x: number; y: number };
  /** Update note */
  onUpdateNote: (note: string) => void;
  /** Update color */
  onUpdateColor: (color: HighlightColor) => void;
  /** Delete highlight */
  onDelete: () => void;
  /** Trigger speed reading */
  onSpeedRead: () => void;
  /** Close popover */
  onClose: () => void;
}

const COLOR_OPTIONS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'orange'];

/**
 * Detect if we should use the mobile bottom-bar layout.
 * Uses viewport width + touch heuristics. Returns true on first render
 * if SSR-safe check passes, to avoid flash of desktop layout on phones.
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });

  useEffect(() => {
    const check = () => {
      const narrow = window.innerWidth < 640;
      const hasTouch = 'ontouchstart' in window
        || navigator.maxTouchPoints > 0
        || window.matchMedia('(pointer: coarse)').matches;
      setIsMobile(narrow && hasTouch);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

export function SelectionPopover({
  text,
  anchorRect,
  onCreateHighlight,
  onSpeedRead,
  onClose,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [selectedColor, setSelectedColor] = useState<HighlightColor | null>(null);
  const isMobile = useIsMobile();

  // Position popover above selection (desktop only)
  const [position, setPosition] = useState({ x: anchorRect.x, y: anchorRect.y - 8 });

  useEffect(() => {
    if (isMobile) return; // Bottom bar doesn't need positioning
    const popover = popoverRef.current;
    if (!popover) return;

    const rect = popover.getBoundingClientRect();
    let x = anchorRect.x - rect.width / 2;
    let y = anchorRect.y - rect.height - 8;

    x = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    if (y < 8) {
      y = anchorRect.y + 8;
    }

    setPosition({ x, y });
  }, [anchorRect, isMobile]);

  // Close on click/tap outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to avoid immediate close from selection click/tap
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleColorClick = (color: HighlightColor) => {
    if (showNote) {
      setSelectedColor(color);
    } else {
      onCreateHighlight(color);
    }
  };

  const handleCreateWithNote = () => {
    if (selectedColor) {
      onCreateHighlight(selectedColor, note);
    }
  };

  // Shared action bar content (used by both mobile and desktop)
  const actionBar = (
    <>
      <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-1'} p-2`}>
        {/* Color buttons */}
        {COLOR_OPTIONS.map((color) => (
          <button
            key={color}
            onClick={() => handleColorClick(color)}
            className={`${isMobile ? 'w-9 h-9' : 'w-7 h-7'} rounded-full transition-transform hover:scale-110 active:scale-95 ${
              selectedColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-800' : ''
            }`}
            style={{ backgroundColor: HIGHLIGHT_COLORS[color].hex }}
            aria-label={`Highlight ${color}`}
          />
        ))}

        <div className={`w-px ${isMobile ? 'h-8' : 'h-6'} bg-zinc-600 mx-1`} />

        {/* Note button */}
        <button
          onClick={() => setShowNote(!showNote)}
          className={`${isMobile ? 'p-2' : 'p-1.5'} rounded hover:bg-zinc-700 transition-colors ${
            showNote ? 'text-red-500' : 'text-zinc-400'
          }`}
          aria-label="Add note"
        >
          <svg className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </button>

        {/* Speed Read button */}
        <button
          onClick={onSpeedRead}
          className={`${isMobile ? 'p-2' : 'p-1.5'} rounded text-zinc-400 hover:bg-zinc-700 hover:text-red-500 transition-colors`}
          aria-label="Speed read from here"
        >
          <svg className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>

        {/* Close button */}
        <button
          onClick={onClose}
          className={`${isMobile ? 'p-2' : 'p-1.5'} rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-colors`}
          aria-label="Close"
        >
          <svg className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Selected text preview (mobile only) */}
      {isMobile && text && (
        <div className="px-3 pb-1">
          <p className="text-zinc-500 text-xs line-clamp-1">
            &quot;{text.slice(0, 80)}{text.length > 80 ? '...' : ''}&quot;
          </p>
        </div>
      )}

      {/* Note input area */}
      {showNote && (
        <div className="px-2 pb-2">
          <p className="text-zinc-500 text-xs mb-1">Select a color first, then add a note:</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note..."
            className="w-full bg-zinc-700 text-zinc-100 text-sm rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-red-500"
            rows={3}
            maxLength={2000}
            autoFocus
          />
          {selectedColor && (
            <button
              onClick={handleCreateWithNote}
              className="mt-2 w-full py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
            >
              Create Highlight
            </button>
          )}
        </div>
      )}
    </>
  );

  // Mobile: fixed bottom bar that sits above iOS native UI
  if (isMobile) {
    return (
      <div
        ref={popoverRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-800 border-t border-zinc-700 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] safe-area-bottom"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {actionBar}
      </div>
    );
  }

  // Desktop: floating popover near selection
  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl"
      style={{ left: position.x, top: position.y }}
    >
      {actionBar}
    </div>
  );
}

export function HighlightPopover({
  highlight,
  anchorRect,
  onUpdateNote,
  onUpdateColor,
  onDelete,
  onSpeedRead,
  onClose,
}: HighlightPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState(highlight.note || '');
  const [showNote, setShowNote] = useState(!!highlight.note);
  const isMobile = useIsMobile();

  // Position popover (desktop only)
  const [position, setPosition] = useState({ x: anchorRect.x, y: anchorRect.y - 8 });

  useEffect(() => {
    if (isMobile) return;
    const popover = popoverRef.current;
    if (!popover) return;

    const rect = popover.getBoundingClientRect();
    let x = anchorRect.x - rect.width / 2;
    let y = anchorRect.y - rect.height - 8;

    x = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    if (y < 8) y = anchorRect.y + 8;

    setPosition({ x, y });
  }, [anchorRect, showNote, isMobile]);

  // Close on click/tap outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (note !== highlight.note) {
          onUpdateNote(note);
        }
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose, note, highlight.note, onUpdateNote]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (note !== highlight.note) {
          onUpdateNote(note);
        }
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, note, highlight.note, onUpdateNote]);

  // Shared action bar content
  const actionBar = (
    <>
      <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-1'} p-2`}>
        {/* Color buttons */}
        {COLOR_OPTIONS.map((color) => (
          <button
            key={color}
            onClick={() => onUpdateColor(color)}
            className={`${isMobile ? 'w-9 h-9' : 'w-7 h-7'} rounded-full transition-transform hover:scale-110 active:scale-95 ${
              highlight.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-800' : ''
            }`}
            style={{ backgroundColor: HIGHLIGHT_COLORS[color].hex }}
            aria-label={`Change to ${color}`}
          />
        ))}

        <div className={`w-px ${isMobile ? 'h-8' : 'h-6'} bg-zinc-600 mx-1`} />

        {/* Note button */}
        <button
          onClick={() => setShowNote(!showNote)}
          className={`${isMobile ? 'p-2' : 'p-1.5'} rounded hover:bg-zinc-700 transition-colors ${
            showNote || highlight.note ? 'text-red-500' : 'text-zinc-400'
          }`}
          aria-label="Edit note"
        >
          <svg className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </button>

        {/* Speed Read button */}
        <button
          onClick={onSpeedRead}
          className={`${isMobile ? 'p-2' : 'p-1.5'} rounded text-zinc-400 hover:bg-zinc-700 hover:text-red-500 transition-colors`}
          aria-label="Speed read from here"
        >
          <svg className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>

        {/* Delete button */}
        <button
          onClick={onDelete}
          className={`${isMobile ? 'p-2' : 'p-1.5'} rounded text-zinc-400 hover:bg-zinc-700 hover:text-red-500 transition-colors`}
          aria-label="Delete highlight"
        >
          <svg className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        {/* Close button */}
        <button
          onClick={() => {
            if (note !== highlight.note) {
              onUpdateNote(note);
            }
            onClose();
          }}
          className={`${isMobile ? 'p-2' : 'p-1.5'} rounded text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-colors`}
          aria-label="Close"
        >
          <svg className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Note editor */}
      {showNote && (
        <div className="px-2 pb-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note..."
            className="w-full bg-zinc-700 text-zinc-100 text-sm rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-red-500"
            rows={3}
            maxLength={2000}
            autoFocus
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-zinc-500 text-xs">{note.length}/2000</span>
            {note !== highlight.note && (
              <button
                onClick={() => onUpdateNote(note)}
                className="text-red-500 text-xs hover:text-red-400"
              >
                Save
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview of highlighted text */}
      <div className="px-2 pb-2 border-t border-zinc-700 mt-1 pt-2">
        <p className="text-zinc-400 text-xs line-clamp-2">
          &quot;{highlight.text.slice(0, 100)}{highlight.text.length > 100 ? '...' : ''}&quot;
        </p>
      </div>
    </>
  );

  // Mobile: fixed bottom bar
  if (isMobile) {
    return (
      <div
        ref={popoverRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-800 border-t border-zinc-700 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {actionBar}
      </div>
    );
  }

  // Desktop: floating popover
  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl"
      style={{ left: position.x, top: position.y }}
    >
      {actionBar}
    </div>
  );
}
