import React from 'react';

type Tone = 'muted' | 'accent' | 'ink';

interface MicroLabelProps {
  children: React.ReactNode;
  tone?: Tone;
  as?: 'div' | 'span' | 'p';
  className?: string;
  style?: React.CSSProperties;
}

export function MicroLabel({
  children,
  tone = 'muted',
  as = 'div',
  className = '',
  style,
}: MicroLabelProps) {
  const Tag = as;
  const toneClass =
    tone === 'accent'
      ? 'micro-label--accent'
      : tone === 'ink'
      ? 'micro-label--ink'
      : '';
  return (
    <Tag
      className={`micro-label ${toneClass} ${className}`.trim()}
      style={style}
    >
      {children}
    </Tag>
  );
}
