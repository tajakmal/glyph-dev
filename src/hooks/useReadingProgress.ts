'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getDocument, saveDocument } from '@/lib/storage';
import type { DocumentMeta } from '@/types';

interface UseReadingProgressOptions {
  documentId: string;
  currentWordIndex: number;
  currentPage: number;
  totalWords: number;
  wpm?: number;
  /** Whether the speed reader is actively playing */
  isSpeedReading?: boolean;
}

interface UseReadingProgressReturn {
  /** Saved last word index for this document (for resume) */
  savedWordIndex: number;
  /** Saved last page for this document */
  savedPage: number;
  /** Saved WPM for this document */
  savedWpm: number;
  /** Force save current progress now */
  saveNow: () => void;
}

/**
 * Hook for persisting and restoring reading progress.
 * Auto-saves word index and page to localStorage, debounced for performance.
 */
export function useReadingProgress({
  documentId,
  currentWordIndex,
  currentPage,
  totalWords,
  wpm,
  isSpeedReading = false,
}: UseReadingProgressOptions): UseReadingProgressReturn {
  const lastSavedRef = useRef({ wordIndex: -1, page: -1 });
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved progress on mount
  const doc = getDocument(documentId);
  const savedWordIndex = doc?.lastWordIndex ?? 0;
  const savedPage = doc?.lastReadPage ?? 1;
  const savedWpm = doc?.speedReadWpm ?? 300;

  const saveProgress = useCallback(() => {
    const currentDoc = getDocument(documentId);
    if (!currentDoc) return;

    const progress = totalWords > 0 ? currentWordIndex / totalWords : 0;

    const updated: DocumentMeta = {
      ...currentDoc,
      lastWordIndex: currentWordIndex,
      lastReadPage: currentPage,
      readingProgress: Math.min(1, progress),
      totalWords: totalWords || currentDoc.totalWords,
      lastReadAt: Date.now(),
    };

    if (wpm !== undefined) {
      updated.speedReadWpm = wpm;
    }

    saveDocument(updated);
    lastSavedRef.current = { wordIndex: currentWordIndex, page: currentPage };
  }, [documentId, currentWordIndex, currentPage, totalWords, wpm]);

  // Periodic auto-save every 5 seconds during active reading
  useEffect(() => {
    if (!isSpeedReading) return;

    saveTimerRef.current = setInterval(() => {
      if (
        currentWordIndex !== lastSavedRef.current.wordIndex ||
        currentPage !== lastSavedRef.current.page
      ) {
        saveProgress();
      }
    }, 5000);

    return () => {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current);
      }
    };
  }, [isSpeedReading, saveProgress, currentWordIndex, currentPage]);

  // Save on pause (when isSpeedReading goes from true to false)
  const wasSpeedReadingRef = useRef(isSpeedReading);
  useEffect(() => {
    if (wasSpeedReadingRef.current && !isSpeedReading) {
      saveProgress();
    }
    wasSpeedReadingRef.current = isSpeedReading;
  }, [isSpeedReading, saveProgress]);

  // Save on page change (for PDF scrolling)
  useEffect(() => {
    if (currentPage !== lastSavedRef.current.page && currentPage > 0) {
      // Debounce page saves to avoid excessive writes during fast scrolling
      const timer = setTimeout(() => {
        saveProgress();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentPage, saveProgress]);

  // Save on unmount
  useEffect(() => {
    return () => {
      saveProgress();
    };
  }, [saveProgress]);

  return {
    savedWordIndex,
    savedPage,
    savedWpm,
    saveNow: saveProgress,
  };
}
