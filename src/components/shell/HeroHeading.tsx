import React from 'react';

interface HeroHeadingProps {
  children: React.ReactNode;
  /** Scale down for tighter headers (e.g. Marks, Settings) */
  size?: 'xl' | 'lg' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

const SIZE: Record<NonNullable<HeroHeadingProps['size']>, React.CSSProperties> = {
  xl: { fontSize: 88, lineHeight: 0.88, letterSpacing: '-0.06em' },
  lg: { fontSize: 56, lineHeight: 0.95, letterSpacing: '-0.04em' },
  md: { fontSize: 36, lineHeight: 1, letterSpacing: '-0.035em' },
};

export function HeroHeading({
  children,
  size = 'xl',
  className = '',
  style,
}: HeroHeadingProps) {
  return (
    <h1
      className={className}
      style={{
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        fontWeight: 700,
        color: 'var(--ink)',
        margin: 0,
        ...SIZE[size],
        ...style,
      }}
    >
      {children}
    </h1>
  );
}
