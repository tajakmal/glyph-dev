'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SpritzReader } from '@/components/SpritzReader';
import { tokenize } from '@/lib/tokenize';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

function SpeedReadContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [words, setWords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
          const decoded = decodeURIComponent(urlText);
          setWords(tokenize(decoded));
          setIsLoading(false);
          return;
        }

        // Check for text in sessionStorage
        const source = searchParams.get('source');
        if (source === 'session') {
          const sessionText = sessionStorage.getItem('glyph:speedread-text');
          if (sessionText) {
            setWords(tokenize(sessionText));
            sessionStorage.removeItem('glyph:speedread-text');
          }
          setIsLoading(false);
          return;
        }

        // Redirect document-based speed reads to the unified reader page
        const docId = searchParams.get('documentId');
        if (docId) {
          router.replace(`/reader/${docId}?mode=speed-read`);
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

  // No-op index change handler for standalone speed reading (no document context to save to)

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

  if (words.length === 0) {
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

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header with navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {/* Home/Library button */}
          <button
            onClick={handleGoHome}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Back to Library"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          {/* Back to Reader button - only shows if we have a return path */}
          {returnPath && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Reader</span>
            </button>
          )}

        </div>
        <ThemeToggle />
      </div>

      {/* Speed Reader */}
      <div className="flex-1 overflow-hidden">
        <SpritzReader
          words={words}
        />
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
