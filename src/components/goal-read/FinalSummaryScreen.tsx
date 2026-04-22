'use client';

import React from 'react';
import Link from 'next/link';
import { useGoalContext } from '@/contexts/GoalContext';

export function FinalSummaryScreen() {
  const {
    session,
    chunkScores,
    totalCorrect,
    totalQuestions,
    restartGoal,
    exitGoal,
    archiveId,
  } = useGoalContext();
  if (!session || session.state.kind !== 'finalSummary') return null;

  const pct =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8,8,8,0.85)',
          zIndex: 112,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Goal complete"
        className="modal"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 113,
          maxWidth: 560,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          color: 'var(--ink)',
        }}
      >
        <div
          style={{
            padding: 'max(env(safe-area-inset-top), 18px) 20px 12px',
            borderBottom: '1px solid var(--rule)',
          }}
        >
          <div className="micro-label" style={{ color: 'var(--accent)' }}>
            ✦ Goal complete
          </div>
        </div>
        <div style={{ padding: '32px 22px', flex: 1, overflow: 'auto' }}>
          {totalQuestions > 0 ? (
            <>
              <div
                style={{
                  fontSize: 72,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  lineHeight: 0.92,
                  color: 'var(--accent)',
                }}
              >
                {totalCorrect}
                <span
                  style={{
                    fontSize: 32,
                    color: 'var(--muted)',
                    fontWeight: 500,
                  }}
                >
                  {' '}
                  / {totalQuestions}
                </span>
              </div>
              <div
                className="micro-label"
                style={{ color: 'var(--muted)', marginTop: 8 }}
              >
                {pct}% overall
              </div>
              <div style={{ marginTop: 28 }}>
                {session.chunks.map((chunk) => {
                  const s = chunkScores[chunk.index];
                  return (
                    <div
                      key={chunk.index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 2px',
                        borderTop: '1px solid var(--rule)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          minWidth: 0,
                          flex: 1,
                          paddingRight: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--ink)',
                            fontWeight: 500,
                          }}
                        >
                          Chunk {chunk.index + 1}
                        </div>
                        {chunk.miniPrimer && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={chunk.miniPrimer}
                          >
                            {chunk.miniPrimer}
                          </div>
                        )}
                      </div>
                      <div
                        className="micro-label"
                        style={{
                          color: s ? 'var(--ink)' : 'var(--muted)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s ? `${s.correct} / ${s.total}` : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 16, color: 'var(--muted-strong)' }}>
              No quiz questions were generated for this session.
            </div>
          )}

          {archiveId && (
            <div
              style={{
                marginTop: 24,
                textAlign: 'center',
              }}
            >
              <Link
                href={`/archive/${archiveId}`}
                style={{
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-mono), monospace',
                }}
              >
                Saved to archive →
              </Link>
            </div>
          )}
        </div>
        <div
          style={{
            padding: '14px 20px calc(16px + env(safe-area-inset-bottom))',
            borderTop: '1px solid var(--rule)',
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            onClick={restartGoal}
            style={{
              height: 48,
              padding: '0 18px',
              borderRadius: 24,
              border: '1px solid var(--rule)',
              background: 'transparent',
              color: 'var(--ink)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Re-read from start
          </button>
          <button
            onClick={exitGoal}
            style={{
              flex: 1,
              height: 48,
              padding: '0 22px',
              borderRadius: 24,
              border: 0,
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
