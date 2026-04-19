'use client';

import React, { useState } from 'react';
import type { PDFBookmark, PDFHighlight, PDFOutlineItem } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';
import { MicroLabel } from '@/components/shell/MicroLabel';

type Tab = 'zoom' | 'outline' | 'bookmarks' | 'highlights';

interface PDFViewSheetProps {
  zoom: number;
  onZoomChange: (z: number) => void;
  outline: PDFOutlineItem[];
  isOutlineLoading: boolean;
  bookmarks: PDFBookmark[];
  highlights: PDFHighlight[];
  onOutlineClick: (page: number) => void;
  onBookmarkClick: (page: number) => void;
  onBookmarkDelete: (id: string) => void;
  onHighlightClick: (highlight: PDFHighlight) => void;
  onExport: () => void;
  onClose: () => void;
}

const ZOOM_PRESETS: Array<{ label: string; value: number }> = [
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
];

export function PDFViewSheet({
  zoom,
  onZoomChange,
  outline,
  isOutlineLoading,
  bookmarks,
  highlights,
  onOutlineClick,
  onBookmarkClick,
  onBookmarkDelete,
  onHighlightClick,
  onExport,
  onClose,
}: PDFViewSheetProps) {
  const [tab, setTab] = useState<Tab>('zoom');

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 40,
        }}
      />
      <div
        className="sheet-in"
        role="dialog"
        aria-modal="true"
        aria-label="Reader options"
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 'calc(16px + env(safe-area-inset-bottom))',
          maxWidth: 440,
          margin: '0 auto',
          zIndex: 50,
          borderRadius: 20,
          background: 'var(--bg-glass)',
          border: '1px solid var(--rule-strong)',
          color: 'var(--ink)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
          WebkitBackdropFilter: 'blur(20px)',
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            display: 'flex',
            gap: 4,
            borderBottom: '1px solid var(--rule)',
            overflow: 'auto',
          }}
        >
          {(['zoom', 'outline', 'bookmarks', 'highlights'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                background: tab === t ? 'var(--ink)' : 'transparent',
                color: tab === t ? 'var(--bg)' : 'var(--ink)',
                border: `1px solid ${tab === t ? 'var(--ink)' : 'var(--rule)'}`,
                fontSize: 10,
                fontFamily: 'var(--font-mono), monospace',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {t}
              {t === 'bookmarks' ? ` · ${bookmarks.length}` : ''}
              {t === 'highlights' ? ` · ${highlights.length}` : ''}
            </button>
          ))}
        </div>

        <div style={{ maxHeight: '48vh', overflow: 'auto', padding: 14 }}>
          {tab === 'zoom' && (
            <div>
              <MicroLabel style={{ marginBottom: 10 }}>Zoom</MicroLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ZOOM_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => onZoomChange(p.value)}
                    aria-pressed={Math.abs(zoom - p.value) < 0.01}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      background:
                        Math.abs(zoom - p.value) < 0.01
                          ? 'var(--accent)'
                          : 'transparent',
                      color:
                        Math.abs(zoom - p.value) < 0.01 ? '#fff' : 'var(--ink)',
                      border: `1px solid ${
                        Math.abs(zoom - p.value) < 0.01 ? 'var(--accent)' : 'var(--rule)'
                      }`,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono), monospace',
                      fontSize: 11,
                      letterSpacing: '0.12em',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <MicroLabel style={{ marginBottom: 10 }}>Fine tune</MicroLabel>
                <input
                  className="glyph-range"
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => onZoomChange(+e.target.value)}
                  style={{ width: '100%' }}
                />
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    fontFamily: 'var(--font-mono), monospace',
                    color: 'var(--muted)',
                    letterSpacing: '0.15em',
                  }}
                >
                  {Math.round(zoom * 100)}%
                </div>
              </div>
              <div style={{ marginTop: 20 }}>
                <MicroLabel style={{ marginBottom: 8 }}>Export</MicroLabel>
                <button
                  onClick={onExport}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'var(--bg-elevated)',
                    color: 'var(--ink)',
                    border: '1px solid var(--rule)',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  ⎋ Download annotations
                </button>
              </div>
            </div>
          )}

          {tab === 'outline' && (
            <div>
              {isOutlineLoading ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading outline…</div>
              ) : outline.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  No outline in this PDF.
                </div>
              ) : (
                <OutlineList items={outline} onItemClick={onOutlineClick} depth={0} />
              )}
            </div>
          )}

          {tab === 'bookmarks' && (
            <div>
              {bookmarks.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  No bookmarks yet.
                </div>
              ) : (
                bookmarks.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      padding: '10px 0',
                      borderBottom: '1px solid var(--rule)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <button
                      onClick={() => onBookmarkClick(b.page)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        background: 'transparent',
                        border: 0,
                        color: 'var(--ink)',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          fontFamily: 'var(--font-mono), monospace',
                          color: 'var(--accent)',
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          marginBottom: 2,
                        }}
                      >
                        p. {b.page}
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {b.label || `Page ${b.page}`}
                      </div>
                    </button>
                    <button
                      onClick={() => onBookmarkDelete(b.id)}
                      aria-label="Remove bookmark"
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: 'var(--muted)',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'highlights' && (
            <div>
              {highlights.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Select text to add highlights.
                </div>
              ) : (
                highlights.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => onHighlightClick(h)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 0',
                      borderBottom: '1px solid var(--rule)',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontFamily: 'var(--font-mono), monospace',
                        color: 'var(--muted)',
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      p. {h.page}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontFamily: 'var(--font-serif), Georgia, serif',
                        lineHeight: 1.45,
                        color: 'var(--ink)',
                        borderLeft: `2px solid ${HIGHLIGHT_COLORS[h.color].hex}`,
                        paddingLeft: 10,
                      }}
                    >
                      {h.text.length > 110 ? h.text.slice(0, 108) + '…' : h.text}
                    </div>
                    {h.note && (
                      <div
                        style={{
                          marginTop: 4,
                          paddingLeft: 10,
                          fontSize: 12,
                          color: 'var(--muted)',
                        }}
                      >
                        {h.note}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function OutlineList({
  items,
  onItemClick,
  depth,
}: {
  items: PDFOutlineItem[];
  onItemClick: (page: number) => void;
  depth: number;
}) {
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        paddingLeft: depth * 12,
      }}
    >
      {items.map((it, i) => (
        <li key={i}>
          <button
            onClick={() => onItemClick(it.page)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 0',
              borderBottom: '1px solid var(--rule)',
              background: 'transparent',
              border: 0,
              color: 'var(--ink)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--muted)', marginRight: 8, fontFamily: 'var(--font-mono), monospace', fontSize: 10 }}>
              p. {it.page}
            </span>
            {it.title}
          </button>
          {it.items.length > 0 && (
            <OutlineList
              items={it.items}
              onItemClick={onItemClick}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
