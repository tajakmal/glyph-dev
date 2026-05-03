import React from 'react';

interface HeroHeadingProps {
  children: React.ReactNode;
  /** Scale down for tighter headers (e.g. Marks, Settings) */
  size?: 'xl' | 'lg' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

const SIZE: Record<NonNullable<HeroHeadingProps['size']>, React.CSSProperties> = {
  xl: { fontSize: 76, lineHeight: 0.94, letterSpacing: 0 },
  lg: { fontSize: 52, lineHeight: 0.98, letterSpacing: 0 },
  md: { fontSize: 36, lineHeight: 1.04, letterSpacing: 0 },
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
