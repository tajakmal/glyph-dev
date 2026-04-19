'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDocumentLibrary } from '@/hooks/useDocumentLibrary';
import { AppShell } from '@/components/shell/AppShell';
import { MicroLabel } from '@/components/shell/MicroLabel';
import { ContinueCard } from '@/components/library/ContinueCard';
import { ShelfCard } from '@/components/library/ShelfCard';

export default function HomePage() {
  const { documents, isLoading, removeDocument } = useDocumentLibrary();
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...documents].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
    [documents]
  );

  const continuing =
    sorted.find((d) => (d.readingProgress ?? 0) > 0 && (d.readingProgress ?? 0) < 1) ||
    sorted[0];

  const shelfDocs = showAll ? sorted : sorted.slice(0, 4);

  return (
    <AppShell>
      {/* Header */}
      <div style={{ padding: '58px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
          }}
        >
          <MicroLabel>
            Glyph <span style={{ color: 'var(--accent)' }}>✦</span>
          </MicroLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={iconBtnStyle} aria-label="Search library" onClick={() => router.push('/marks')}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
                <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
            <Link href="/settings" style={iconBtnStyle} aria-label="Settings">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="2" fill="currentColor" />
                <circle cx="2" cy="7" r="1.5" fill="currentColor" />
                <circle cx="12" cy="7" r="1.5" fill="currentColor" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Hero wordmark */}
        <div style={{ marginTop: 16, marginBottom: 20 }}>
          <div className="hero-display">
            read
            <br />
            fast,
            <br />
            <span style={{ color: 'var(--accent)' }}>read slow</span>.
          </div>
        </div>
      </div>

      {/* Continue */}
      <div style={{ padding: '0 20px' }}>
        {isLoading ? (
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--rule)',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 13,
            }}
          >
            Loading…
          </div>
        ) : continuing ? (
          <ContinueCard document={continuing} />
        ) : (
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--rule)',
              color: 'var(--muted)',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <MicroLabel tone="accent" style={{ marginBottom: 8 }}>
              Start
            </MicroLabel>
            Nothing here yet.{' '}
            <Link href="/new" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
              Add something to read
            </Link>
            .
          </div>
        )}
      </div>

      {/* Shelf */}
      <div style={{ padding: '24px 20px 32px' }}>
        <div
          className="micro-label"
          style={{
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>
            Shelf · {sorted.length}
          </span>
          {sorted.length > 4 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{
                background: 'none',
                border: 0,
                color: 'var(--accent)',
                font: 'inherit',
                cursor: 'pointer',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontSize: 10,
                fontFamily: 'var(--font-mono), monospace',
                padding: 0,
              }}
            >
              {showAll ? 'less ↑' : 'all ↓'}
            </button>
          )}
        </div>

        {sorted.length === 0 && !isLoading ? (
          <div style={{ padding: '16px 4px', color: 'var(--muted)', fontSize: 13 }}>
            Upload a PDF or paste text to fill the shelf.{' '}
            <Link href="/new" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
              Start →
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              position: 'relative',
            }}
          >
            {shelfDocs.map((d) => (
              <div key={d.id} style={{ position: 'relative' }}>
                <ShelfCard document={d} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId((curr) => (curr === d.id ? null : d.id));
                  }}
                  aria-label="Card options"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--rule)',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <circle cx="2.5" cy="6" r="1" fill="currentColor" />
                    <circle cx="6" cy="6" r="1" fill="currentColor" />
                    <circle cx="9.5" cy="6" r="1" fill="currentColor" />
                  </svg>
                </button>
                {menuId === d.id && (
                  <>
                    <div
                      onClick={() => setMenuId(null)}
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 36,
                        right: 8,
                        zIndex: 50,
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--rule-strong)',
                        borderRadius: 10,
                        padding: 4,
                        minWidth: 140,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        WebkitBackdropFilter: 'blur(16px)',
                        backdropFilter: 'blur(16px)',
                      }}
                    >
                      <button
                        onClick={() => {
                          setMenuId(null);
                          router.push(`/reader/${d.id}?mode=speed-read`);
                        }}
                        style={menuItemStyle}
                      >
                        ⚡ Speed-read
                      </button>
                      <button
                        onClick={() => {
                          setMenuId(null);
                          if (confirm(`Delete "${d.title}"? This can't be undone.`)) {
                            removeDocument(d.id);
                          }
                        }}
                        style={{
                          ...menuItemStyle,
                          color: 'var(--accent)',
                        }}
                      >
                        ✕ Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 18,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--rule)',
  color: 'var(--ink)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  textDecoration: 'none',
  padding: 0,
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--ink)',
  textAlign: 'left',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
