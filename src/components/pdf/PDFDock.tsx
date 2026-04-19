'use client';

import React from 'react';

export type PDFDockAction =
  | 'mark'
  | 'speed'
  | 'note'
  | 'find'
  | 'copy'
  | 'view';

interface PDFDockProps {
  isBookmarked: boolean;
  searchOpen: boolean;
  viewSheetOpen: boolean;
  onAction: (action: PDFDockAction) => void;
}

interface Tile {
  key: PDFDockAction;
  label: string;
  icon: string;
}

const TILES: Tile[] = [
  { key: 'mark', label: 'Mark', icon: '✦' },
  { key: 'speed', label: 'Speed', icon: '⚡' },
  { key: 'note', label: 'Note', icon: '✎' },
  { key: 'find', label: 'Find', icon: '⌕' },
  { key: 'copy', label: 'Copy', icon: '⎘' },
  { key: 'view', label: 'View', icon: '⚙' },
];

export function PDFDock({
  isBookmarked,
  searchOpen,
  viewSheetOpen,
  onAction,
}: PDFDockProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: `max(26px, env(safe-area-inset-bottom, 0px))`,
        left: 16,
        right: 16,
        zIndex: 30,
        background: 'var(--bg-glass)',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: '1px solid var(--rule)',
        padding: 12,
        display: 'flex',
        gap: 6,
        maxWidth: 440,
        margin: '0 auto',
      }}
    >
      {TILES.map((t) => {
        let active = false;
        if (t.key === 'mark' && isBookmarked) active = true;
        if (t.key === 'find' && searchOpen) active = true;
        if (t.key === 'view' && viewSheetOpen) active = true;
        return (
          <button
            key={t.key}
            onClick={() => onAction(t.key)}
            aria-label={t.label}
            aria-pressed={active}
            title={t.label}
            style={{
              flex: 1,
              padding: '10px 4px',
              borderRadius: 12,
              background: active ? 'var(--accent)' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              color: active ? '#fff' : 'var(--ink)',
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 150ms ease, color 150ms ease',
            }}
          >
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span
              style={{
                fontSize: 9,
                fontFamily: 'var(--font-mono), monospace',
                color: active ? '#fff' : 'var(--muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
