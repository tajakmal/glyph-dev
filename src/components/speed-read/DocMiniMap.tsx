import React from 'react';

interface DocMiniMapProps {
  /** Current position, 0-based */
  index: number;
  /** Total word/token count */
  total: number;
  /** Chapter marker positions (word indices) */
  chapters?: Array<{ start: number; title?: string }>;
  /** Bar height in px (default 2) */
  height?: number;
  /** Color of the filled portion */
  accent?: string;
}

export function DocMiniMap({
  index,
  total,
  chapters = [],
  height = 2,
  accent = 'var(--accent)',
}: DocMiniMapProps) {
  if (total <= 0) return null;
  const pct = Math.max(0, Math.min(1, index / Math.max(1, total - 1)));
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        height,
        background: 'var(--rule)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {chapters.map((ch, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${(ch.start / total) * 100}%`,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'var(--muted)',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: '0 auto 0 0',
          width: `${pct * 100}%`,
          background: accent,
          transition: 'width 150ms ease',
        }}
      />
    </div>
  );
}
