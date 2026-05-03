'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentMeta } from '@/types';

interface ShelfCardProps {
  document: DocumentMeta;
}

export function ShelfCard({ document }: ShelfCardProps) {
  const router = useRouter();
  const letter = (document.title?.[0] || document.fileName?.[0] || '·').toUpperCase();
  const progress = document.readingProgress ?? 0;
  const hasProgress = progress > 0;

  const ticks = 16;
  const kindLabel = document.kind === 'pdf' ? 'pdf' : 'text';

  return (
    <button
      onClick={() => router.push(`/reader/${document.id}`)}
      aria-label={`Open ${document.title}`}
      style={{
        padding: 12,
        background: 'var(--bg-elevated)',
        borderRadius: 12,
        border: '1px solid var(--rule)',
        aspectRatio: '1 / 1.15',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: 'var(--ink)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'border-color 180ms ease, transform 180ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-35)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}
    >
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: 0,
          color: hasProgress ? 'var(--accent)' : 'var(--ink)',
        }}
      >
        {letter}
      </div>
      <div>
        <div
          style={{
            display: 'flex',
            gap: 1,
            marginBottom: 8,
            height: 2,
          }}
        >
          {Array.from({ length: ticks }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: i / ticks < progress ? 'var(--accent)' : 'var(--rule-strong)',
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: 0,
            color: 'var(--ink)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={document.title}
        >
          {document.title}
        </div>
        <div
          style={{
            fontSize: 9,
            color: 'var(--muted)',
            marginTop: 2,
            fontFamily: 'var(--font-mono), monospace',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {kindLabel}
        </div>
      </div>
    </button>
  );
}
