'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SpritzReader } from '@/components/SpritzReader';
import { getPDF } from '@/lib/storage';
import { loadPDF, extractAllText } from '@/lib/pdf-utils';
import { getDocuments } from '@/lib/storage';

function SpeedReadContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [text, setText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [returnPath, setReturnPath] = useState<string | null>(null);

  useEffect(() => {
    const loadText = async () => {
      setIsLoading(true);

      try {
        // Get return path from sessionStorage first (before any early returns)
        const storedReturnPath = sessionStorage.getItem('glyph:speedread-return');
        if (storedReturnPath) {
          setReturnPath(storedReturnPath);
        }

        // Check for text in URL params (small text)
        const urlText = searchParams.get('text');
        if (urlText) {
          setText(decodeURIComponent(urlText));
          setIsLoading(false);
          return;
        }

        // Check for text in sessionStorage
        const source = searchParams.get('source');
        if (source === 'session') {
          const sessionText = sessionStorage.getItem('glyph:speedread-text');
          if (sessionText) {
            setText(sessionText);
            sessionStorage.removeItem('glyph:speedread-text');
          }
          setIsLoading(false);
          return;
        }

        // Check for document ID (full document speed read)
        const documentId = searchParams.get('documentId');
        if (documentId) {
          // Get document metadata
          const documents = getDocuments();
          const doc = documents.find(d => d.id === documentId);
          if (doc) {
            setDocumentTitle(doc.title);
            setReturnPath(`/reader/${documentId}`);
          }

          // Load PDF and extract text
          const pdfData = await getPDF(documentId);
          if (pdfData) {
            const pdf = await loadPDF(pdfData);
            const extractedText = await extractAllText(pdf);
            setText(extractedText);
          }
          setIsLoading(false);
          return;
        }

        // No text source found
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load text:', error);
        setIsLoading(false);
      }
    };

    loadText();
  }, [searchParams]);

  const handleBack = () => {
    if (returnPath) {
      router.push(returnPath);
    } else {
      router.push('/');
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
          <p className="text-zinc-400">Loading text...</p>
        </div>
      </div>
    );
  }

  if (!text) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950">
        <p className="text-zinc-400 mb-4">No text to speed read.</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-zinc-800 text-zinc-200 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header with back button */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Reader</span>
        </button>
        {documentTitle && (
          <span className="text-zinc-500 text-sm truncate">
            Reading: {documentTitle}
          </span>
        )}
      </div>

      {/* Speed Reader */}
      <div className="flex-1 overflow-hidden">
        <SpritzReader initialText={text} />
      </div>
    </div>
  );
}

export default function SpeedReadPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
      </div>
    }>
      <SpeedReadContent />
    </Suspense>
  );
}
