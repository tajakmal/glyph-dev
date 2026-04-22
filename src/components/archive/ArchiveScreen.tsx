'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getArchivedSessions } from '@/lib/archive';
import type { ArchivedSession } from '@/types/archive';
import { AppShell } from '@/components/shell/AppShell';
import { MicroLabel } from '@/components/shell/MicroLabel';
import { HeroHeading } from '@/components/shell/HeroHeading';

type Filter = 'all' | 'goal' | 'free';

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
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function ArchiveScreen() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sessions, setSessions] = useState<ArchivedSession[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage
    setMounted(true);
    setSessions(getArchivedSessions());
    setNow(Date.now());
  }, []);

  const counts = useMemo(
    () => ({
      all: sessions.length,
      goal: sessions.filter((s) => s.kind === 'goal').length,
      free: sessions.filter((s) => s.kind === 'free').length,
    }),
    [sessions]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return sessions;
    return sessions.filter((s) => s.kind === filter);
  }, [sessions, filter]);

  return (
    <AppShell>
      <div style={{ padding: '58px 20px 0' }}>
        <MicroLabel>
          Your archive · {mounted ? sessions.length : '—'}
        </MicroLabel>
        <HeroHeading size="md" style={{ marginTop: 10 }}>
          Primers,
          <br />
          <span style={{ color: 'var(--accent)' }}>recaps</span>,
          <br />
          and quizzes.
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
            { key: 'goal', label: 'Primers', count: counts.goal },
            { key: 'free', label: 'Recaps', count: counts.free },
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
              lineHeight: 1.5,
            }}
          >
            Nothing archived yet.
            <br />
            Start a focused read or ask for a quiz after a session.
          </div>
        ) : (
          filtered.map((s, i) => {
            const pct =
              s.totalQuestions > 0
                ? Math.round((s.totalCorrect / s.totalQuestions) * 100)
                : null;
            const words = Math.max(
              0,
              s.range.endWord - s.range.startWord + 1
            );
            return (
              <button
                key={s.id}
                onClick={() => router.push(`/archive/${s.id}`)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 0',
                  borderTop: i === 0 ? '1px solid var(--rule)' : 'none',
                  borderBottom: '1px solid var(--rule)',
                  background: 'transparent',
                  border: 0,
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
                        s.kind === 'goal' ? 'var(--accent)' : 'var(--muted)',
                    }}
                  >
                    {s.kind === 'goal' ? '✦ primer + quiz' : '▸ recap + quiz'}
                  </span>
                  <span
                    className="micro-label"
                    style={{ letterSpacing: '0.15em' }}
                  >
                    {formatAgo(s.createdAt, now)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 15,
                    lineHeight: 1.4,
                    fontWeight: 500,
                    marginBottom: 4,
                  }}
                >
                  {s.documentTitle}
                </div>
                {s.summary && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--muted)',
                      lineHeight: 1.5,
                      fontFamily: 'var(--font-serif), Georgia, serif',
                      marginBottom: 6,
                    }}
                  >
                    {s.summary.length > 160
                      ? s.summary.slice(0, 158) + '…'
                      : s.summary}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{words.toLocaleString()} words</span>
                  {s.totalQuestions > 0 && (
                    <span>
                      {s.totalCorrect}/{s.totalQuestions} correct
                      {pct !== null ? ` · ${pct}%` : ''}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {mounted && sessions.length === 0 && (
        <div
          style={{
            padding: '20px 20px 0',
            textAlign: 'center',
          }}
        >
          <Link
            href="/"
            style={{
              color: 'var(--accent)',
              textDecoration: 'underline',
              fontSize: 13,
            }}
          >
            Back to library →
          </Link>
        </div>
      )}
    </AppShell>
  );
}
