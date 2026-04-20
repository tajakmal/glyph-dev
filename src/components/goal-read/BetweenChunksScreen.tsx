'use client';

import React from 'react';
import { useGoalContext } from '@/contexts/GoalContext';

export function BetweenChunksScreen() {
  const {
    session,
    chunkScores,
    continueToNextChunk,
    rereadChunk,
    exitGoal,
  } = useGoalContext();
  if (!session || session.state.kind !== 'betweenChunks') return null;

  const chunkIndex = session.state.chunkIndex;
  const score = chunkScores[chunkIndex] ?? { correct: 0, total: 0 };
  const chunk = session.chunks[chunkIndex];
  const nextChunk = session.chunks[chunkIndex + 1];
  const pct = score.total > 0 ? score.correct / score.total : 0;
  const lowScore = score.total > 0 && pct < 0.5;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8,8,8,0.8)',
          zIndex: 112,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chunk results"
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
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div className="micro-label" style={{ color: 'var(--muted)' }}>
            Chunk {chunkIndex + 1} · Results
          </div>
          <button
            onClick={exitGoal}
            className="micro-label"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Exit goal
          </button>
        </div>

        <div style={{ padding: '26px 22px', flex: 1, overflow: 'auto' }}>
          {score.total > 0 ? (
            <>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  color: lowScore ? 'var(--ink)' : 'var(--accent)',
                }}
              >
                {score.correct}
                <span
                  style={{
                    fontSize: 28,
                    color: 'var(--muted)',
                    fontWeight: 500,
                  }}
                >
                  {' '}
                  / {score.total}
                </span>
              </div>
              <div
                className="micro-label"
                style={{ color: 'var(--muted)', marginTop: 6 }}
              >
                {Math.round(pct * 100)}% correct
              </div>
              {chunk && (
                <div
                  style={{
                    marginTop: 22,
                    display: 'flex',
                    gap: 4,
                    flexWrap: 'wrap',
                  }}
                >
                  {chunk.quiz.map((q) => {
                    const choice = session.answers[chunkIndex]?.[q.id];
                    const correct =
                      typeof choice === 'number' && choice === q.correctIndex;
                    return (
                      <span
                        key={q.id}
                        aria-label={correct ? 'Correct' : 'Incorrect'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: correct
                            ? 'rgba(134, 239, 172, 0.18)'
                            : 'rgba(249, 168, 212, 0.18)',
                          color: correct ? '#86efac' : '#f9a8d4',
                          fontSize: 14,
                          fontWeight: 700,
                        }}
                      >
                        {correct ? '✓' : '✕'}
                      </span>
                    );
                  })}
                </div>
              )}
              {lowScore && (
                <div
                  style={{
                    marginTop: 22,
                    fontSize: 14,
                    color: 'var(--muted-strong)',
                    lineHeight: 1.5,
                  }}
                >
                  Score is a little low — want to re-read this chunk?
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                color: 'var(--muted-strong)',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              This chunk didn&rsquo;t come with a quiz (the primer couldn&rsquo;t
              be generated). You can continue to the next chunk.
            </div>
          )}

          {nextChunk && nextChunk.miniPrimer && (
            <div
              style={{
                marginTop: 28,
                padding: 14,
                borderRadius: 12,
                border: '1px solid var(--rule)',
                background: 'rgba(242,239,232,0.03)',
              }}
            >
              <div
                className="micro-label"
                style={{ color: 'var(--muted)', marginBottom: 6 }}
              >
                Next up
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: 'var(--ink)',
                }}
              >
                {nextChunk.miniPrimer}
              </div>
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
            onClick={() => rereadChunk(chunkIndex)}
            style={{
              flex: lowScore ? 1 : 0,
              height: 48,
              padding: '0 18px',
              borderRadius: 24,
              border: lowScore ? 0 : '1px solid var(--rule)',
              background: lowScore ? 'var(--accent)' : 'transparent',
              color: lowScore ? '#fff' : 'var(--ink)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Re-read chunk
          </button>
          <button
            onClick={continueToNextChunk}
            style={{
              flex: lowScore ? 0 : 1,
              height: 48,
              padding: '0 22px',
              borderRadius: 24,
              border: lowScore ? '1px solid var(--rule)' : 0,
              background: lowScore ? 'transparent' : 'var(--accent)',
              color: lowScore ? 'var(--ink)' : '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </>
  );
}
