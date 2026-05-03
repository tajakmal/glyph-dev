'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  deleteArchivedSession,
  getArchivedSession,
} from '@/lib/archive';
import { getDocument } from '@/lib/storage';
import type { ArchivedSession } from '@/types/archive';
import { AppShell } from '@/components/shell/AppShell';
import { MicroLabel } from '@/components/shell/MicroLabel';

interface ArchiveDetailProps {
  archiveId: string;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | undefined): string | null {
  if (!ms) return null;
  const secs = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ArchiveDetail({ archiveId }: ArchiveDetailProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<ArchivedSession | null>(null);
  const [documentExists, setDocumentExists] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage
    setMounted(true);
    const s = getArchivedSession(archiveId);
    setSession(s);
    if (s) {
      setDocumentExists(Boolean(getDocument(s.documentId)));
    }
  }, [archiveId]);

  const scorePct = useMemo(() => {
    if (!session || session.totalQuestions === 0) return null;
    return Math.round((session.totalCorrect / session.totalQuestions) * 100);
  }, [session]);

  if (!mounted) {
    return (
      <AppShell>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div
            className="spinner"
            style={{
              width: 28,
              height: 28,
              border: '2px solid var(--rule-strong)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              margin: '0 auto',
            }}
          />
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <div
          style={{
            padding: '80px 20px 20px',
            textAlign: 'center',
            color: 'var(--muted)',
          }}
        >
          <div style={{ fontSize: 16, color: 'var(--ink)', marginBottom: 10 }}>
            This archive entry is gone.
          </div>
          <Link
            href="/archive"
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
          >
            Back to archive
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleDelete = () => {
    if (!confirm('Remove this archive entry? This cannot be undone.')) return;
    deleteArchivedSession(session.id);
    router.replace('/archive');
  };

  const handleOpenSource = () => {
    if (!documentExists) return;
    router.push(
      `/reader/${session.documentId}?mode=speed-read&start=${session.range.startWord}`
    );
  };

  return (
    <AppShell>
      {/* Top bar */}
      <div
        style={{
          padding: '58px 20px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          onClick={() => router.push('/archive')}
          aria-label="Back to archive"
          style={{
            background: 'transparent',
            border: 0,
            color: 'var(--muted)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            padding: '6px 10px 6px 0',
          }}
        >
          ← Archive
        </button>
        <button
          onClick={handleDelete}
          aria-label="Delete archive entry"
          style={{
            background: 'transparent',
            border: 0,
            color: 'var(--muted)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            padding: 6,
          }}
        >
          ✕ delete
        </button>
      </div>

      {/* Header */}
      <div style={{ padding: '16px 20px 0' }}>
        <MicroLabel
          tone={session.kind === 'goal' ? 'accent' : undefined}
          style={{ marginBottom: 8 }}
        >
          {session.kind === 'goal' ? '✦ Primer + quiz' : '▸ Recap + quiz'}
        </MicroLabel>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: 1.2,
            marginBottom: 8,
          }}
        >
          {session.documentTitle}
        </div>
        <div
          className="micro-label"
          style={{ color: 'var(--muted)', marginBottom: 20 }}
        >
          {formatDate(session.createdAt)} ·{' '}
          {(session.range.endWord - session.range.startWord + 1).toLocaleString()}{' '}
          words
          {session.kind === 'free' && formatDuration(session.readDurationMs)
            ? ` · ${formatDuration(session.readDurationMs)} read`
            : ''}
          {session.kind === 'free' && session.readAvgWpm
            ? ` · ${session.readAvgWpm} wpm`
            : ''}
        </div>
      </div>

      {/* Score card */}
      {session.totalQuestions > 0 && (
        <div style={{ padding: '0 20px' }}>
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              background: 'rgba(255,90,61,0.09)',
              border: '1px solid rgba(255,90,61,0.22)',
              marginBottom: 20,
            }}
          >
            <div
              className="micro-label"
              style={{ color: 'var(--accent)', marginBottom: 8 }}
            >
              Your score
            </div>
            <div
              style={{
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: 0,
                lineHeight: 1,
                color: 'var(--ink)',
              }}
            >
              {session.totalCorrect}
              <span
                style={{
                  fontSize: 20,
                  color: 'var(--muted)',
                  fontWeight: 500,
                }}
              >
                {' '}/ {session.totalQuestions}
              </span>
            </div>
            {scorePct !== null && (
              <div
                className="micro-label"
                style={{ color: 'var(--muted)', marginTop: 6 }}
              >
                {scorePct}% correct
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {session.summary && (
        <div style={{ padding: '0 20px 20px' }}>
          <MicroLabel style={{ color: 'var(--muted)', marginBottom: 10 }}>
            {session.kind === 'goal' ? 'Primer' : 'Recap'}
          </MicroLabel>
          <div
            style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: 15,
              lineHeight: 1.6,
              color: 'var(--ink)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {session.summary}
          </div>
        </div>
      )}

      {/* Anchors */}
      {session.anchors.length > 0 && (
        <div style={{ padding: '0 20px 20px' }}>
          <MicroLabel style={{ color: 'var(--muted)', marginBottom: 10 }}>
            {session.kind === 'goal'
              ? 'Attention anchors'
              : 'Questions to sit with'}
          </MicroLabel>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {session.anchors.map((a, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: 'var(--ink)',
                  marginBottom: 10,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    color: 'var(--accent)',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  ✦
                </span>
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quiz review */}
      {session.chunks.some((c) => c.questions.length > 0) && (
        <div style={{ padding: '0 20px 20px' }}>
          <MicroLabel style={{ color: 'var(--muted)', marginBottom: 10 }}>
            Quiz review
          </MicroLabel>
          {session.chunks.map((chunk) =>
            chunk.questions.length === 0 ? null : (
              <div key={chunk.index} style={{ marginBottom: 8 }}>
                {session.kind === 'goal' && session.chunks.length > 1 && (
                  <div
                    className="micro-label"
                    style={{
                      color: 'var(--muted)',
                      marginTop: 14,
                      marginBottom: 8,
                    }}
                  >
                    Chunk {chunk.index + 1}
                  </div>
                )}
                {chunk.questions.map((q, i) => {
                  const answered = typeof q.chosenIndex === 'number';
                  const correct =
                    answered && q.chosenIndex === q.correctIndex;
                  return (
                    <details
                      key={q.id}
                      style={{
                        borderTop: '1px solid var(--rule)',
                        padding: '12px 0',
                      }}
                    >
                      <summary
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          listStyle: 'none',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: !answered
                              ? 'rgba(242,239,232,0.08)'
                              : correct
                              ? 'rgba(134, 239, 172, 0.18)'
                              : 'rgba(249, 168, 212, 0.18)',
                            color: !answered
                              ? 'var(--muted)'
                              : correct
                              ? '#86efac'
                              : '#f9a8d4',
                            fontSize: 13,
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          {!answered ? '–' : correct ? '✓' : '✕'}
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            lineHeight: 1.45,
                            color: 'var(--ink)',
                            fontWeight: 500,
                          }}
                        >
                          Q{i + 1}. {q.question}
                        </span>
                      </summary>
                      <div style={{ paddingLeft: 34, marginTop: 8 }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--muted-strong)',
                            marginBottom: 4,
                          }}
                        >
                          Correct: {q.choices[q.correctIndex]}
                        </div>
                        {answered &&
                          q.chosenIndex !== q.correctIndex &&
                          typeof q.chosenIndex === 'number' && (
                            <div
                              style={{
                                fontSize: 13,
                                color: 'var(--muted)',
                                marginBottom: 4,
                              }}
                            >
                              You chose: {q.choices[q.chosenIndex]}
                            </div>
                          )}
                        {!answered && (
                          <div
                            style={{
                              fontSize: 13,
                              color: 'var(--muted)',
                              marginBottom: 4,
                            }}
                          >
                            (not answered)
                          </div>
                        )}
                        {q.explanation && (
                          <div
                            style={{
                              fontSize: 13,
                              lineHeight: 1.5,
                              color: 'var(--muted-strong)',
                              marginTop: 6,
                            }}
                          >
                            {q.explanation}
                          </div>
                        )}
                        {documentExists && (
                          <button
                            onClick={() =>
                              router.push(
                                `/reader/${session.documentId}?mode=speed-read&start=${q.source.startWord}`
                              )
                            }
                            style={{
                              marginTop: 10,
                              background: 'transparent',
                              border: '1px solid var(--rule)',
                              color: 'var(--muted)',
                              padding: '6px 10px',
                              borderRadius: 8,
                              fontFamily: 'var(--font-mono), monospace',
                              fontSize: 10,
                              letterSpacing: '0.18em',
                              textTransform: 'uppercase',
                              cursor: 'pointer',
                            }}
                          >
                            Jump to source →
                          </button>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '0 20px 40px' }}>
        <button
          onClick={handleOpenSource}
          disabled={!documentExists}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 24,
            background: documentExists ? 'var(--accent)' : 'var(--rule)',
            color: documentExists ? '#fff' : 'var(--muted)',
            border: 0,
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
            cursor: documentExists ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-mono), monospace',
          }}
        >
          {documentExists ? 'Re-read passage →' : 'Source document removed'}
        </button>
      </div>
    </AppShell>
  );
}
