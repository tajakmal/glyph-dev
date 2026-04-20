'use client';

import React, { useEffect } from 'react';
import { useGoalContext } from '@/contexts/GoalContext';
import { useReaderContext } from '@/contexts/ReaderContext';

const CONTEXT_PADDING = 40;

/**
 * Bottom-sheet overlay shown when the user taps "Show source" on a quiz
 * question. Renders the supporting passage inline with a highlighted span,
 * instead of scrolling the underlying reader. Closes back to the quiz.
 */
export function SourceModal() {
  const { showSource, backToQuiz, session } = useGoalContext();
  const { words } = useReaderContext();

  useEffect(() => {
    if (!showSource) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        backToQuiz();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSource, backToQuiz]);

  if (!showSource || !session) return null;

  const chunk = session.chunks[showSource.chunkIndex];
  if (!chunk) return null;

  const src = showSource.question.source;
  const padStart = Math.max(chunk.range.startWord, src.startWord - CONTEXT_PADDING);
  const padEnd = Math.min(chunk.range.endWord, src.endWord + CONTEXT_PADDING);

  const before = words.slice(padStart, src.startWord).join(' ');
  const source = words.slice(src.startWord, src.endWord + 1).join(' ');
  const after = words.slice(src.endWord + 1, padEnd + 1).join(' ');

  const hasBefore = padStart > chunk.range.startWord;
  const hasAfter = padEnd < chunk.range.endWord;

  return (
    <>
      <div
        onClick={backToQuiz}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8,8,8,0.72)',
          zIndex: 120,
          animation: 'fade-in 160ms ease-out',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Source passage"
        className="modal"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 121,
          maxWidth: 560,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          color: 'var(--ink)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'max(env(safe-area-inset-top), 18px) 20px 14px',
            borderBottom: '1px solid var(--rule)',
          }}
        >
          <div
            className="micro-label"
            style={{ color: 'var(--muted)', marginBottom: 8 }}
          >
            Source · Chunk {showSource.chunkIndex + 1}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              lineHeight: 1.35,
              color: 'var(--ink)',
            }}
          >
            {showSource.question.question}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '22px 20px',
            fontSize: 17,
            lineHeight: 1.65,
            fontFamily: 'var(--font-serif), Georgia, serif',
            color: 'var(--ink)',
          }}
        >
          {hasBefore && (
            <span style={{ color: 'var(--muted)', opacity: 0.7 }}>… </span>
          )}
          {before && (
            <span style={{ color: 'var(--muted)' }}>{before} </span>
          )}
          <mark
            style={{
              background: 'var(--accent-20)',
              color: 'var(--ink)',
              padding: '1px 4px',
              borderRadius: 3,
              boxShadow: '0 0 0 1px var(--accent-35)',
            }}
          >
            {source}
          </mark>
          {after && (
            <span style={{ color: 'var(--muted)' }}> {after}</span>
          )}
          {hasAfter && (
            <span style={{ color: 'var(--muted)', opacity: 0.7 }}> …</span>
          )}
        </div>

        <div
          style={{
            padding: '12px 20px calc(16px + env(safe-area-inset-bottom))',
            borderTop: '1px solid var(--rule)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={backToQuiz}
            aria-label="Back to quiz"
            style={{
              height: 44,
              padding: '0 20px',
              borderRadius: 22,
              border: 0,
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span aria-hidden="true">‹</span>
            Back to quiz
          </button>
        </div>
      </div>
    </>
  );
}
