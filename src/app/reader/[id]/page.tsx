'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { TextReader } from '@/components/text/TextReader';
import { getDocument } from '@/lib/storage';

interface ReaderPageProps {
  params: Promise<{ id: string }>;
}

export default function ReaderPage({ params }: ReaderPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const documentMeta = getDocument(id);

  // Loading state
  if (!documentMeta) {
    return (
      <main className="h-screen flex flex-col bg-zinc-950">
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
      </main>
    );
  }

  // Render based on document kind
  if (documentMeta.kind === 'text') {
    return (
      <main className="h-screen flex flex-col bg-zinc-950">
        <div className="flex-1 overflow-hidden">
          <TextReader documentId={id} />
        </div>
      </main>
    );
  }

  // Default: PDF viewer
  return (
    <main className="h-screen flex flex-col bg-zinc-950">
      <div className="flex-1 overflow-hidden">
        <PDFViewer documentId={id} />
      </div>
    </main>
  );
}
