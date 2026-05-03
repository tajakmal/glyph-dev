'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentMeta } from '@/types';

interface ContinueCardProps {
  document: DocumentMeta;
}

export function ContinueCard({ document }: ContinueCardProps) {
  const router = useRouter();
  const progress = document.readingProgress ?? 0;
  const pct = Math.round(progress * 100);

  let subline: string;
  if (document.kind === 'pdf') {
    subline = `p. ${document.lastReadPage ?? 1} of ${document.pageCount ?? '—'}`;
  } else if (document.lastWordIndex && document.totalWords) {
    subline = `Word ${document.lastWordIndex + 1} of ${document.totalWords.toLocaleString()}`;
  } else if (document.textPreview) {
    subline =
      document.textPreview.slice(0, 64).trim() +
      (document.textPreview.length > 64 ? '…' : '');
  } else {
    subline = `${document.wordCount ?? 0} words`;
  }

  return (
    <button
      onClick={() => router.push(`/reader/${document.id}`)}
      aria-label={`Continue ${document.title}`}
      style={{
        display: 'block',
        width: '100%',
        padding: 16,
        borderRadius: 16,
        background: 'var(--accent-10)',
        border: '1px solid var(--accent-20)',
        textAlign: 'left',
        cursor: 'pointer',
        color: 'var(--ink)',
        fontFamily: 'inherit',
        transition: 'border-color 180ms ease, background 180ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-35)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-20)';
      }}
    >
      <div
        className="micro-label micro-label--accent"
        style={{ marginBottom: 8 }}
      >
        Continue
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: 0,
          color: 'var(--ink)',
        }}
      >
        {document.title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
        {subline}
      </div>
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 3,
            background: 'var(--rule)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.max(pct, 4)}%`,
              height: '100%',
              background: 'var(--accent)',
              transition: 'width 220ms ease',
            }}
          />
        </div>
        <div
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono), monospace',
            color: 'var(--muted)',
            letterSpacing: '0.1em',
          }}
        >
          {pct}%
        </div>
      </div>
    </button>
  );
}
