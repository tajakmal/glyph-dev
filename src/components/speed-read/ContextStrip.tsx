import React from 'react';

interface ContextStripProps {
  words: string[];
  index: number;
  before?: number;
  after?: number;
  color?: string;
  focalColor?: string;
}

/**
 * Dimmed context strip showing a few words before and after the focal word.
 * Addresses parafoveal-preview loss inherent to RSVP.
 */
export function ContextStrip({
  words,
  index,
  before = 5,
  after = 5,
  color = 'rgba(242,239,232,0.22)',
  focalColor = 'var(--ink)',
}: ContextStripProps) {
  const start = Math.max(0, index - before);
  const end = Math.min(words.length, index + after + 1);
  const slice = words.slice(start, end);
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.4em',
        justifyContent: 'center',
        alignItems: 'baseline',
        fontSize: 15,
        lineHeight: 1.6,
        maxWidth: 340,
        margin: '0 auto',
      }}
    >
      {slice.map((w, i) => {
        const g = start + i;
        const isFocal = g === index;
        const dist = Math.abs(g - index);
        const opacity = isFocal ? 1 : Math.max(0.25, 1 - dist * 0.1);
        return (
          <span
            key={g}
            style={{
              color: isFocal ? focalColor : color,
              opacity,
              fontWeight: isFocal ? 500 : 400,
              transition: 'opacity 0.3s',
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}
