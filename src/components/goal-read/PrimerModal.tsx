'use client';

import React, { useMemo } from 'react';
import { useGoalContext } from '@/contexts/GoalContext';
import { formatRemaining } from '@/hooks/useSpeedReader';
import { useReaderContext } from '@/contexts/ReaderContext';

/**
 * Full-screen on mobile / centered on desktop modal that shows the streaming
 * primer summary, attention anchors, and a "Start reading" / "Resume reading"
 * CTA. Opens while generation streams and can be re-opened during a read via
 * the PrimerPill.
 */
export function PrimerModal() {
  const {
    session,
    primerOpen,
    closePrimer,
    streaming,
    summaryText,
    payload,
    generationError,
    startFocusGoal: _startFocusGoal,
    beginReading,
    retryGeneration,
    cancelGeneration,
    fallbackToPlainSpeedRead,
  } = useGoalContext();
  const { speedReadWpm } = useReaderContext();

  void _startFocusGoal; // unused in this component, kept for clarity

  const sessionState = session?.state.kind ?? 'idle';
  const inError = sessionState === 'error';
  const inReview =
    sessionState === 'reading' ||
    sessionState === 'quiz' ||
    sessionState === 'betweenChunks' ||
    sessionState === 'finalSummary';

  const ctaLabel = useMemo(() => {
    if (sessionState === 'generating') return 'Generating…';
    if (inReview) return 'Resume reading';
    return 'Start reading';
  }, [sessionState, inReview]);

  const ctaReady =
    !!session &&
    (sessionState === 'primerReady' || inReview) &&
    !generationError;

  if (!primerOpen || !session) return null;

  const rangeWordCount = session.range.endWord - session.range.startWord + 1;
  const mins = formatRemaining(rangeWordCount, speedReadWpm);

  const handlePrimary = () => {
    if (inReview) {
      closePrimer();
      return;
    }
    if (!ctaReady) return;
    beginReading();
  };

  const handleCancel = () => {
    if (inReview) {
      closePrimer();
      return;
    }
    cancelGeneration();
  };

  return (
    <>
      <div
        onClick={closePrimer}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8,8,8,0.55)',
          zIndex: 100,
          animation: 'fade-in 160ms ease-out',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reading primer"
        className="modal"
        style={modalStyle}
      >
        <div style={{ flex: 1, overflow: 'auto', padding: '26px 24px 8px' }}>
          <div
            className="micro-label"
            style={{ color: 'var(--muted)', marginBottom: 8 }}
          >
            ✦ Primer
          </div>

          {/* Streaming summary */}
          <div
            style={{
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              fontSize: 17,
              lineHeight: 1.55,
              color: 'var(--ink)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {summaryText ? (
              <>
                {summaryText}
                {streaming && (
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 7,
                      height: 16,
                      marginLeft: 4,
                      background: 'var(--accent)',
                      verticalAlign: 'middle',
                      animation: 'glyph-cursor-blink 900ms infinite',
                    }}
                  />
                )}
              </>
            ) : streaming ? (
              <SummarySkeleton />
            ) : null}
          </div>

          {/* Anchors — rendered once payload arrives */}
          {payload && payload.anchors.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div
                className="micro-label"
                style={{ color: 'var(--muted)', marginBottom: 10 }}
              >
                What to look for
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {payload.anchors.map((a, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 15,
                      lineHeight: 1.5,
                      color: 'var(--ink)',
                      display: 'flex',
                      gap: 10,
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

          {session.partialFailure && payload && (
            <div style={partialFailureStyle}>
              Some chunks were missing in the AI response. Those sections will
              play as plain speed-read.
            </div>
          )}

          {/* Error state */}
          {generationError && (
            <div style={errorStyle}>
              Couldn&rsquo;t generate a primer — {generationError}
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button
                  onClick={retryGeneration}
                  style={retryBtnStyle}
                >
                  Retry
                </button>
                <button
                  onClick={fallbackToPlainSpeedRead}
                  style={secondaryBtnStyle}
                >
                  Plain speed-read instead
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px calc(16px + env(safe-area-inset-bottom))',
            borderTop: '1px solid var(--rule)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            className="micro-label"
            style={{
              color: 'var(--muted)',
              textAlign: 'center',
              letterSpacing: '0.16em',
            }}
          >
            {rangeWordCount.toLocaleString()} words · {mins} ·{' '}
            {session.chunks.length} chunk{session.chunks.length === 1 ? '' : 's'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleCancel}
              style={cancelBtnStyle}
            >
              {inReview ? 'Close' : 'Cancel'}
            </button>
            {!inError && (
              <button
                onClick={handlePrimary}
                disabled={!ctaReady}
                style={{
                  ...primaryBtnStyle,
                  background: ctaReady ? 'var(--accent)' : 'var(--rule)',
                  color: ctaReady ? '#fff' : 'var(--muted)',
                  cursor: ctaReady ? 'pointer' : 'not-allowed',
                }}
              >
                {ctaLabel}
                {streaming && !inReview && (
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      marginLeft: 8,
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.85)',
                      animation: 'pulse 1s infinite',
                    }}
                  />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SummarySkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: 0.5,
      }}
    >
      {[0.95, 0.88, 0.72].map((w, i) => (
        <div
          key={i}
          style={{
            height: 14,
            width: `${w * 100}%`,
            background: 'var(--rule)',
            borderRadius: 6,
            animation: `pulse 1.4s ${i * 0.12}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

const modalStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 101,
  left: 0,
  right: 0,
  bottom: 0,
  top: 0,
  margin: 'auto',
  maxWidth: 560,
  maxHeight: '92vh',
  background: 'var(--bg)',
  color: 'var(--ink)',
  borderRadius: 20,
  border: '1px solid var(--rule)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
};

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  height: 52,
  borderRadius: 26,
  border: 0,
  fontFamily: 'var(--font-mono), monospace',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  fontSize: 11,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cancelBtnStyle: React.CSSProperties = {
  height: 52,
  padding: '0 20px',
  borderRadius: 26,
  border: '1px solid var(--rule)',
  background: 'transparent',
  color: 'var(--ink)',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono), monospace',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  fontSize: 11,
  fontWeight: 600,
};

const retryBtnStyle: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  borderRadius: 18,
  border: 0,
  background: 'var(--accent)',
  color: '#fff',
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  borderRadius: 18,
  border: '1px solid var(--rule)',
  background: 'transparent',
  color: 'var(--ink)',
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  fontWeight: 600,
  cursor: 'pointer',
};

const errorStyle: React.CSSProperties = {
  marginTop: 20,
  padding: 14,
  borderRadius: 12,
  background: 'rgba(255, 90, 61, 0.08)',
  border: '1px solid rgba(255, 90, 61, 0.25)',
  color: 'var(--ink)',
  fontSize: 13,
  lineHeight: 1.5,
};

const partialFailureStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  borderRadius: 10,
  background: 'rgba(253, 186, 116, 0.1)',
  border: '1px solid rgba(253, 186, 116, 0.25)',
  color: 'var(--ink)',
  fontSize: 12,
  lineHeight: 1.5,
};
