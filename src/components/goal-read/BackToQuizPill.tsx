'use client';

import React from 'react';
import { useGoalContext } from '@/contexts/GoalContext';

/**
 * Floating pill anchored bottom-right that returns the user to the quiz after
 * they've viewed the source span. Rendered while `showSource` is active.
 */
export function BackToQuizPill() {
  const { showSource, backToQuiz } = useGoalContext();
  if (!showSource) return null;

  return (
    <button
      onClick={backToQuiz}
      aria-label="Back to quiz"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(22px + env(safe-area-inset-bottom))',
        zIndex: 120,
        height: 48,
        padding: '0 18px',
        borderRadius: 24,
        background: 'var(--accent)',
        color: '#fff',
        border: 0,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 10px 24px rgba(255,90,61,0.45)',
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 11,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        fontWeight: 700,
      }}
    >
      <span aria-hidden="true">‹</span>
      Back to quiz
    </button>
  );
}
