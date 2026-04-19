'use client';

import React, { useState } from 'react';
import type { HighlightColor } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';

export interface SelectionSummary {
  startWord: number;
  endWord: number;
  text: string;
}

interface SelectionActionBarProps {
  /** Current selection, or null when nothing is selected */
  selection: SelectionSummary | null;
  onHighlight: (color: HighlightColor) => void;
  onSpeedRead: () => void;
  onBookmark: () => void;
  onCopy: () => void;
  onAsk: () => void;
  onDismiss: () => void;
  /** Called when user taps the idle "Speed-read" chip (no selection active) */
  onIdleSpeedRead: () => void;
}

const COLOR_ORDER: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'orange'];

/**
 * Floating action bar pinned to the bottom-right of the reader.
 *
 * States:
 *   - Idle: accent "Speed-read" pill (the primary CTA).
 *   - Selection: expands into a glass pill with four actions
 *     (highlight, speed-read, bookmark, copy) plus a close button.
 *     Tapping highlight reveals a color row inline.
 *
 * Lives outside the selection rect so the native iOS selection menu
 * (Copy / Look Up / Share…) never overlaps it.
 */
export function SelectionActionBar({
  selection,
  onHighlight,
  onSpeedRead,
  onBookmark,
  onCopy,
  onAsk,
  onDismiss,
  onIdleSpeedRead,
}: SelectionActionBarProps) {
  const [mode, setMode] = useState<'primary' | 'colors'>('primary');
  const [toast, setToast] = useState<string | null>(null);

  // Reset mode to 'primary' when the selection changes (React's
  // "storing information from previous renders" pattern).
  const selectionKey = selection
    ? `${selection.startWord}-${selection.endWord}`
    : null;
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (selectionKey !== lastKey) {
    setLastKey(selectionKey);
    if (mode !== 'primary') setMode('primary');
  }

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
  };

  const handleBookmark = () => {
    onBookmark();
    flash('Bookmarked');
  };
  const handleCopy = () => {
    onCopy();
    flash('Copied');
  };
  const handleSpeedRead = () => {
    onSpeedRead();
  };

  // Idle state — compact FAB
  if (!selection) {
    return (
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: 'calc(26px + env(safe-area-inset-bottom))',
          zIndex: 35,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        {toast && <Toast text={toast} />}
        <button
          onClick={onIdleSpeedRead}
          aria-label="Start speed-read from here"
          style={{
            pointerEvents: 'auto',
            height: 52,
            padding: '0 22px 0 18px',
            borderRadius: 26,
            background: 'var(--accent)',
            color: '#fff',
            border: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 10px 24px rgba(255,90,61,0.45)',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
            <path d="M1 1l12 7-12 7V1z" fill="#fff" />
          </svg>
          Speed-read
        </button>
      </div>
    );
  }

  // Selection state — expanded glass pill at bottom of screen
  return (
    <div
      // Prevent selection loss on mousedown
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        // Don't preempt the bar's own click handlers
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
      }}
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 'calc(26px + env(safe-area-inset-bottom))',
        zIndex: 35,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      {toast && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            bottom: 72,
            pointerEvents: 'none',
          }}
        >
          <Toast text={toast} />
        </div>
      )}
      <div
        role="toolbar"
        aria-label="Selection actions"
        className="sheet-in"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 8,
          borderRadius: 28,
          background: '#14110c',
          color: '#faf6ed',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
          maxWidth: 416,
          width: '100%',
        }}
      >
        <div
          style={{
            paddingLeft: 10,
            paddingRight: 4,
            fontSize: 10,
            fontFamily: 'var(--font-mono), monospace',
            color: 'rgba(250,246,237,0.55)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: mode === 'colors' ? '0 0 auto' : '1 1 auto',
            minWidth: 0,
          }}
        >
          {selection.endWord - selection.startWord + 1} word
          {selection.endWord - selection.startWord === 0 ? '' : 's'}
        </div>
        {mode === 'primary' ? (
          <>
            <ActionButton
              label="Highlight"
              icon="✦"
              accent
              onClick={() => setMode('colors')}
            />
            <ActionButton label="Speed-read" icon="⚡" onClick={handleSpeedRead} />
            <ActionButton label="Ask" icon="?" onClick={onAsk} />
            <ActionButton label="Bookmark" icon="✎" onClick={handleBookmark} />
            <ActionButton label="Copy" icon="⎘" onClick={handleCopy} />
            <DismissButton onClick={onDismiss} />
          </>
        ) : (
          <>
            <ActionButton
              label="Back"
              icon="‹"
              onClick={() => setMode('primary')}
            />
            {COLOR_ORDER.map((c) => (
              <button
                key={c}
                aria-label={`Highlight ${c}`}
                onClick={() => {
                  onHighlight(c);
                  flash('Highlighted');
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    background: HIGHLIGHT_COLORS[c].hex,
                    border: '1px solid rgba(255,255,255,0.25)',
                  }}
                />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  icon: string;
  accent?: boolean;
  onClick: () => void;
}

function ActionButton({ label, icon, accent, onClick }: ActionButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 38,
        height: 34,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: accent ? 'var(--accent)' : 'transparent',
        color: accent ? '#fff' : '#faf6ed',
        borderRadius: 10,
        fontSize: 14,
        border: 0,
        cursor: 'pointer',
        padding: 0,
        gap: 1,
      }}
    >
      {icon}
    </button>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Dismiss selection"
      onClick={onClick}
      style={{
        width: 30,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        color: 'rgba(250,246,237,0.6)',
        borderRadius: 10,
        border: 0,
        cursor: 'pointer',
        padding: 0,
        fontSize: 16,
      }}
    >
      ✕
    </button>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div
      role="status"
      style={{
        pointerEvents: 'none',
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(20,17,12,0.95)',
        color: '#faf6ed',
        fontSize: 10,
        fontFamily: 'var(--font-mono), monospace',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
      }}
    >
      {text}
    </div>
  );
}
