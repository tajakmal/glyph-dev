'use client';

import { use, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { getDocument } from '@/lib/storage';
import { ReaderProvider } from '@/contexts/ReaderContext';
import { UnifiedReaderLayout } from '@/components/reader/UnifiedReaderLayout';
import type { ViewMode } from '@/contexts/ReaderContext';
import type { DocumentMeta } from '@/types';

interface ReaderPageProps {
  params: Promise<{ id: string }>;
}

function ReaderContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Defer localStorage read to client to avoid SSR hydration mismatch
  const [documentMeta, setDocumentMeta] = useState<DocumentMeta | null | undefined>(undefined);
  useEffect(() => {
    setDocumentMeta(getDocument(id));
  }, [id]);

  // Support ?mode=speed-read for deep-linking
  const modeParam = searchParams.get('mode');
  const initialMode: ViewMode = modeParam === 'speed-read' ? 'speed-read' : 'pdf';

  // Support ?start=N to resume from a specific word index (used by Return screen)
  const startParam = searchParams.get('start');
  const initialWordIndex =
    startParam != null && /^\d+$/.test(startParam)
      ? Number.parseInt(startParam, 10)
      : undefined;

  // Support ?page=N when entering from a PDF bookmark/highlight.
  const pageParam = searchParams.get('page');
  const initialPage =
    pageParam != null && /^\d+$/.test(pageParam)
      ? Number.parseInt(pageParam, 10)
      : undefined;

  // Loading state (matches on both server and client)
  if (documentMeta === undefined) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
        }}
      >
        <div
          className="spinner"
          style={{
            width: 28,
            height: 28,
            border: '2px solid var(--rule-strong)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  if (!documentMeta) {
    return (
      <div
        style={{
          height: '100%',
          background: 'var(--bg)',
          color: 'var(--ink)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600 }}>Document not found</p>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          This document may have been deleted.
        </p>
        <button
          onClick={() => router.push('/')}
          style={{
            marginTop: 8,
            padding: '10px 18px',
            borderRadius: 999,
            background: 'var(--accent)',
            color: '#fff',
            border: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <ReaderProvider
      documentId={id}
      documentKind={documentMeta.kind}
      initialMode={initialMode}
      initialWordIndex={initialWordIndex}
      initialPage={initialPage}
    >
      <UnifiedReaderLayout />
    </ReaderProvider>
  );
}

export default function ReaderPage({ params }: ReaderPageProps) {
  const { id } = use(params);

  return (
    <main
      className="app-fixed-viewport"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Suspense
          fallback={
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                className="spinner"
                style={{
                  width: 28,
                  height: 28,
                  border: '2px solid var(--rule-strong)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                }}
              />
            </div>
          }
        >
          <ReaderContent id={id} />
        </Suspense>
      </div>
    </main>
  );
}
