'use client';

import React from 'react';
import { useGoalContext } from '@/contexts/GoalContext';

/**
 * Small pill rendered in the SpeedReadPanel top bar while a goal session is
 * active. Tapping it pauses the RSVP engine and re-opens the PrimerModal in
 * review mode (closing resumes playback if it was active).
 */
export function PrimerPill({ onPauseEngine }: { onPauseEngine: () => void }) {
  const { session, openPrimer } = useGoalContext();
  if (!session) return null;
  if (
    session.state.kind === 'idle' ||
    session.state.kind === 'generating' ||
    session.state.kind === 'primerReady'
  ) {
    return null;
  }

  return (
    <button
      onClick={() => {
        onPauseEngine();
        openPrimer();
      }}
      className="micro-label"
      aria-label="Re-open primer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 999,
        background: 'var(--accent-10)',
        color: 'var(--accent)',
        border: '1px solid rgba(255,90,61,0.25)',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono), monospace',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      <span aria-hidden="true">✦</span>
      primer
    </button>
  );
}
