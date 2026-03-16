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

  // Loading state (matches on both server and client)
  if (documentMeta === undefined) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!documentMeta) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400">
        <svg className="w-16 h-16 mb-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-lg mb-2">Document not found</p>
        <p className="text-sm text-zinc-500 mb-6">This document may have been deleted.</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
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
    >
      <UnifiedReaderLayout />
    </ReaderProvider>
  );
}

export default function ReaderPage({ params }: ReaderPageProps) {
  const { id } = use(params);

  return (
    <main className="h-screen flex flex-col bg-zinc-950">
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="h-full flex items-center justify-center">
            <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
          </div>
        }>
          <ReaderContent id={id} />
        </Suspense>
      </div>
    </main>
  );
}
