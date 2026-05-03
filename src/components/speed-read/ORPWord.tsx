import React from 'react';
import { orpIndex } from '@/hooks/useSpeedReader';

interface ORPWordProps {
  word: string;
  size?: number;
  weight?: number;
  accentColor?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a single word with the ORP (optimal recognition point) letter
 * highlighted in the accent color. Word is visually aligned via inline-block
 * with fixed weight/size, so the ORP letter lands at a consistent x-anchor.
 */
export function ORPWord({
  word,
  size = 56,
  weight = 500,
  accentColor = 'var(--accent)',
  style,
}: ORPWordProps) {
  if (!word) return null;
  const orp = orpIndex(word);
  const effectiveSize = word.length > 18 ? Math.max(38, size - 16) : word.length > 12 ? Math.max(44, size - 8) : size;
  const before = word.slice(0, orp);
  const focal = word[orp] || '';
  const after = word.slice(orp + 1);
  return (
    <span
      style={{
        fontSize: effectiveSize,
        fontWeight: weight,
        letterSpacing: 0,
        display: 'inline-block',
        maxWidth: '100%',
        overflowWrap: 'anywhere',
        textAlign: 'center',
        fontVariantLigatures: 'none',
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        lineHeight: 1,
        ...style,
      }}
    >
      <span>{before}</span>
      <span style={{ color: accentColor }}>{focal}</span>
      <span>{after}</span>
    </span>
  );
}
