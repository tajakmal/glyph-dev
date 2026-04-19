'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Bookmark, DocumentMeta, Highlight } from '@/types';
import { getBookmarks, getHighlights, getDocuments } from '@/lib/storage';
import { AppShell } from '@/components/shell/AppShell';
import { MicroLabel } from '@/components/shell/MicroLabel';
import { HeroHeading } from '@/components/shell/HeroHeading';

type Filter = 'all' | 'highlights' | 'bookmarks' | 'notes';

interface UnifiedMark {
  id: string;
  documentId: string;
  kind: 'highlight' | 'bookmark' | 'note';
  text: string;
  note?: string;
  color?: string;
  createdAt: number;
  /** Optional navigation anchor (page or word index) */
  page?: number;
  wordIndex?: number;
  docKind: 'pdf' | 'text';
}

function formatAgo(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function MarksScreen() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [docs, setDocs] = useState<DocumentMeta[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage is a client-only read
    setMounted(true);
     
    setBookmarks(getBookmarks());
     
    setHighlights(getHighlights());
     
    setDocs(getDocuments());
  }, []);

  const docById = useMemo(() => {
    const map = new Map<string, DocumentMeta>();
    for (const d of docs) map.set(d.id, d);
    return map;
  }, [docs]);

  const marks: UnifiedMark[] = useMemo(() => {
    const all: UnifiedMark[] = [];
    for (const h of highlights) {
      const doc = docById.get(h.documentId);
      if (!doc) continue;
      all.push({
        id: h.id,
        documentId: h.documentId,
        kind: h.note && h.note.trim() ? 'note' : 'highlight',
        text: h.text,
        note: h.note,
        color: h.color,
        createdAt: h.createdAt,
        page: h.kind === 'pdf' ? h.page : undefined,
        wordIndex: h.kind === 'text' ? h.startWord : undefined,
        docKind: doc.kind,
      });
    }
    for (const b of bookmarks) {
      const doc = docById.get(b.documentId);
      if (!doc) continue;
      all.push({
        id: b.id,
        documentId: b.documentId,
        kind: 'bookmark',
        text: b.label || (b.kind === 'pdf' ? `Page ${b.page}` : `Word ${b.wordIndex + 1}`),
        createdAt: b.createdAt,
        page: b.kind === 'pdf' ? b.page : undefined,
        wordIndex: b.kind === 'text' ? b.wordIndex : undefined,
        docKind: doc.kind,
      });
    }
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }, [highlights, bookmarks, docById]);

  const filtered = useMemo(() => {
    if (filter === 'all') return marks;
    if (filter === 'highlights') return marks.filter((m) => m.kind === 'highlight');
    if (filter === 'bookmarks') return marks.filter((m) => m.kind === 'bookmark');
    if (filter === 'notes') return marks.filter((m) => m.kind === 'note');
    return marks;
  }, [marks, filter]);

  const counts = useMemo(
    () => ({
      all: marks.length,
      highlights: marks.filter((m) => m.kind === 'highlight').length,
      bookmarks: marks.filter((m) => m.kind === 'bookmark').length,
      notes: marks.filter((m) => m.kind === 'note').length,
    }),
    [marks]
  );

  // Capture "now" on mount for relative-time labels so renders stay pure.
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clock snapshot is a client-only read
    setNow(Date.now());
  }, []);

  const handleMarkClick = (m: UnifiedMark) => {
    const url = `/reader/${m.documentId}`;
    router.push(url);
  };

  return (
    <AppShell>
      <div style={{ padding: '58px 20px 0' }}>
        <MicroLabel>
          Your marks · {mounted ? marks.length : '—'}
        </MicroLabel>
        <HeroHeading size="md" style={{ marginTop: 10 }}>
          Things you
          <br />
          <span style={{ color: 'var(--accent)' }}>didn&apos;t want</span>
          <br />
          to forget.
        </HeroHeading>
      </div>

      {/* Filter chips */}
      <div
        style={{
          padding: '20px 20px 8px',
          display: 'flex',
          gap: 6,
          overflow: 'auto',
        }}
      >
        {(
          [
            { key: 'all', label: 'All', count: counts.all },
            { key: 'highlights', label: 'Highlights', count: counts.highlights },
            { key: 'bookmarks', label: 'Bookmarks', count: counts.bookmarks },
            { key: 'notes', label: 'Notes', count: counts.notes },
          ] as Array<{ key: Filter; label: string; count: number }>
        ).map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              aria-pressed={active}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                background: active ? 'var(--ink)' : 'transparent',
                color: active ? 'var(--bg)' : 'var(--ink)',
                border: `1px solid ${active ? 'var(--ink)' : 'var(--rule)'}`,
                fontSize: 10,
                fontFamily: 'var(--font-mono), monospace',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {c.label} · {c.count}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ padding: '8px 20px 0' }}>
        {!mounted ? null : filtered.length === 0 ? (
          <div
            style={{
              padding: '40px 0',
              color: 'var(--muted)',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            Nothing saved yet. Highlight text or bookmark a page to see it here.
          </div>
        ) : (
          filtered.map((m, i) => {
            const doc = docById.get(m.documentId);
            return (
              <button
                key={m.id}
                onClick={() => handleMarkClick(m)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 0',
                  borderTop: i === 0 ? '1px solid var(--rule)' : 'none',
                  borderBottom: '1px solid var(--rule)',
                  background: 'transparent',
                  border: 0,
                  borderTopColor: i === 0 ? 'var(--rule)' : undefined,
                  cursor: 'pointer',
                  color: 'var(--ink)',
                  fontFamily: 'inherit',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                  }}
                >
                  <span
                    className="micro-label"
                    style={{
                      color:
                        m.kind === 'highlight'
                          ? 'var(--accent)'
                          : 'var(--muted)',
                    }}
                  >
                    {m.kind === 'highlight' && '▬ highlight'}
                    {m.kind === 'bookmark' && '▸ bookmark'}
                    {m.kind === 'note' && '✎ note'}
                  </span>
                  <span
                    className="micro-label"
                    style={{ letterSpacing: '0.15em' }}
                  >
                    {formatAgo(m.createdAt, now)}
                    {m.page ? ` · p.${m.page}` : ''}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    fontFamily:
                      m.kind === 'highlight' || m.kind === 'note'
                        ? 'var(--font-serif), Georgia, serif'
                        : 'inherit',
                    fontStyle:
                      m.kind === 'highlight' ? 'italic' : 'normal',
                    borderLeft:
                      m.kind === 'highlight'
                        ? '2px solid var(--accent)'
                        : 'none',
                    paddingLeft: m.kind === 'highlight' ? 10 : 0,
                  }}
                >
                  {m.text.length > 180 ? m.text.slice(0, 178) + '…' : m.text}
                </div>
                {m.note && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--muted)',
                      marginTop: 6,
                      paddingLeft: m.kind === 'highlight' ? 10 : 0,
                    }}
                  >
                    {m.note}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                  {doc?.title ?? 'Unknown'}
                </div>
              </button>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
