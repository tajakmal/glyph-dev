'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { HighlightColor } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';

interface SelectionPillProps {
  /** Anchor position (top-center of selection) */
  anchorRect: { x: number; y: number };
  /** Highlight action — called with optional color */
  onHighlight: (color: HighlightColor, note?: string) => void;
  /** Speed-read from selection */
  onSpeedRead: () => void;
  /** Add bookmark / note placeholder */
  onBookmark?: () => void;
  /** Copy text */
  onCopy?: () => void;
  /** Close popover */
  onClose: () => void;
}

const COLOR_ORDER: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'orange'];

/**
 * Floating dark pill popover used on the text reader when text is selected.
 * Four primary icons: highlight / speed / note / copy. Tapping highlight
 * opens a color row inside the same pill.
 */
export function SelectionPill({
  anchorRect,
  onHighlight,
  onSpeedRead,
  onBookmark,
  onCopy,
  onClose,
}: SelectionPillProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: anchorRect.x, y: anchorRect.y - 8 });
  const [mode, setMode] = useState<'primary' | 'colors'>('primary');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let x = anchorRect.x - rect.width / 2;
    let y = anchorRect.y - rect.height - 10;
    x = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    if (y < 8) y = anchorRect.y + 14;
    setPos({ x, y });
  }, [anchorRect.x, anchorRect.y, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="popover no-select"
      role="toolbar"
      aria-label="Selection actions"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 60,
        background: '#14110c',
        color: '#faf6ed',
        borderRadius: 12,
        padding: 6,
        display: 'flex',
        gap: 2,
        boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {mode === 'primary' ? (
        <>
          <PillButton
            label="Highlight"
            icon="✦"
            onClick={() => setMode('colors')}
            accent
          />
          <PillButton label="Speed-read" icon="⚡" onClick={onSpeedRead} />
          {onBookmark && (
            <PillButton label="Bookmark" icon="✎" onClick={onBookmark} />
          )}
          {onCopy && <PillButton label="Copy" icon="⎘" onClick={onCopy} />}
        </>
      ) : (
        <>
          <PillButton label="Back" icon="‹" onClick={() => setMode('primary')} />
          {COLOR_ORDER.map((c) => (
            <PillButton
              key={c}
              label={c}
              swatch={HIGHLIGHT_COLORS[c].hex}
              onClick={() => {
                onHighlight(c);
                onClose();
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

interface PillButtonProps {
  label: string;
  icon?: string;
  swatch?: string;
  accent?: boolean;
  onClick: () => void;
}

function PillButton({ label, icon, swatch, accent, onClick }: PillButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 34,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: accent ? 'var(--accent)' : 'transparent',
        borderRadius: 8,
        fontSize: 14,
        color: accent ? '#fff' : '#faf6ed',
        border: 0,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {swatch ? (
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            background: swatch,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        />
      ) : (
        icon
      )}
    </button>
  );
}
