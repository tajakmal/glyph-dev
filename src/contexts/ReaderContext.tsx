'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentKind, DocumentMeta } from '@/types';
import { usePDF } from '@/hooks/usePDF';
import { extractAllTextCached } from '@/lib/pdf-utils';
import { getText as getTextContent } from '@/lib/storage';
import { tokenize } from '@/lib/tokenize';
import { buildPageWordCounts, mapWordIndexToPage } from '@/lib/word-mapping';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { getDocument as getDocumentMeta, getPreferences } from '@/lib/storage';

// =============================================================================
// Types
// =============================================================================

export type ViewMode = 'pdf' | 'speed-read';

interface ReaderContextValue {
  /** Current view mode */
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  /** Document info */
  documentId: string;
  documentKind: DocumentKind;
  documentMeta: DocumentMeta | null;

  /** PDF document proxy (null for text documents) */
  pdf: PDFDocumentProxy | null;
  pageCount: number;
  isLoading: boolean;
  error: Error | null;

  /** Tokenized words for the full document */
  words: string[];
  /** Per-page word counts (PDF only) */
  pageWordCounts: number[];
  /** Whether words/pageWordCounts are ready */
  isTextReady: boolean;

  /** Current word index (shared between views) */
  currentWordIndex: number;
  setCurrentWordIndex: (index: number) => void;

  /** Current PDF page (1-based) */
  currentPage: number;
  setCurrentPage: (page: number) => void;

  /** Current speed-read WPM (shared so progress auto-save can persist it) */
  speedReadWpm: number;
  setSpeedReadWpm: (wpm: number) => void;

  // ==========================================================================
  // Bidirectional navigation
  // ==========================================================================

  /** Switch to speed-read mode starting at a specific word */
  startSpeedReadAt: (wordIndex: number) => void;

  /** Switch to PDF mode and scroll to the page containing a word */
  jumpToWordInPDF: (wordIndex: number) => void;

  /** Register a callback for scrolling the PDF to a specific page (called by PDFViewer) */
  registerPdfScrollToPage: (fn: (page: number, options?: { instant?: boolean }) => void) => void;
}

// =============================================================================
// Context
// =============================================================================

export const ReaderContext = createContext<ReaderContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface ReaderProviderProps {
  documentId: string;
  documentKind: DocumentKind;
  initialMode?: ViewMode;
  /** Optional override for starting word index (e.g. from ?start= param) */
  initialWordIndex?: number;
  /** Optional override for starting PDF page (e.g. from ?page= param) */
  initialPage?: number;
  children: React.ReactNode;
}

export function ReaderProvider({
  documentId,
  documentKind,
  initialMode = 'pdf',
  initialWordIndex: overrideWordIndex,
  initialPage: overridePage,
  children,
}: ReaderProviderProps) {
  // Load saved progress for resume
  const savedDoc = getDocumentMeta(documentId);
  const initialWordIndex = overrideWordIndex ?? savedDoc?.lastWordIndex ?? 0;
  const initialPage = overridePage ?? savedDoc?.lastReadPage ?? 1;
  const initialWpm =
    savedDoc?.speedReadWpm ??
    (typeof window !== 'undefined' ? getPreferences().defaultWpm : 320);

  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [currentWordIndex, setCurrentWordIndex] = useState(initialWordIndex);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [speedReadWpm, setSpeedReadWpm] = useState(initialWpm);
  const [words, setWords] = useState<string[]>([]);
  const [pageWordCounts, setPageWordCounts] = useState<number[]>([]);
  const [isTextReady, setIsTextReady] = useState(false);
  const [isSpeedReading, setIsSpeedReading] = useState(false);

  // Ref for PDF scroll callback (registered by PDFViewer)
  const pdfScrollToPageRef = useRef<((page: number, options?: { instant?: boolean }) => void) | null>(null);

  // Load PDF if it's a PDF document
  const isPdf = documentKind === 'pdf';
  const {
    pdf,
    isLoading: isPdfLoading,
    error: pdfError,
    meta,
    pageCount,
  } = usePDF({ documentId });

  // For text documents, we don't use usePDF
  const isLoading = isPdf ? isPdfLoading : false;
  const error = isPdf ? pdfError : null;

  // Extract and tokenize text when PDF loads
  useEffect(() => {
    if (!pdf || !isPdf) return;

    let cancelled = false;

    async function extractText() {
      try {
        // Build page word counts and extract full text in parallel
        const [counts, fullText] = await Promise.all([
          buildPageWordCounts(pdf!),
          extractAllTextCached(pdf!, documentId),
        ]);

        if (cancelled) return;

        const tokenized = tokenize(fullText);
        setPageWordCounts(counts);
        setWords(tokenized);
        setIsTextReady(true);
      } catch (err) {
        console.error('Failed to extract text from PDF:', err);
      }
    }

    extractText();
    return () => { cancelled = true; };
  }, [pdf, isPdf, documentId]);

  // Load text document content
  useEffect(() => {
    if (isPdf) return;

    let cancelled = false;

    async function loadText() {
      try {
        const text = await getTextContent(documentId);
        if (cancelled || !text) return;

        const tokenized = tokenize(text);
        setWords(tokenized);
        setIsTextReady(true);
      } catch (err) {
        console.error('Failed to load text document:', err);
      }
    }

    loadText();
    return () => { cancelled = true; };
  }, [isPdf, documentId]);

  // ---- Reading progress persistence ----

  useReadingProgress({
    documentId,
    currentWordIndex,
    currentPage,
    totalWords: words.length,
    wpm: speedReadWpm,
    isSpeedReading,
  });

  // Track speed reading state for progress auto-save
  useEffect(() => {
    setIsSpeedReading(viewMode === 'speed-read');
  }, [viewMode]);

  // ---- Bidirectional navigation ----

  const startSpeedReadAt = useCallback((wordIndex: number) => {
    setCurrentWordIndex(wordIndex);
    setViewMode('speed-read');
  }, []);

  const jumpToWordInPDF = useCallback((wordIndex: number) => {
    if (pageWordCounts.length > 0) {
      const { page } = mapWordIndexToPage(wordIndex, pageWordCounts);
      setCurrentPage(page);

      // Instant scroll to the page — the word-level smooth scroll happens
      // in VirtualizedPDFPage's overlay effect for a clean single animation
      if (pdfScrollToPageRef.current) {
        pdfScrollToPageRef.current(page, { instant: true });
      }
    }

    setCurrentWordIndex(wordIndex);
    setViewMode('pdf');
  }, [pageWordCounts]);

  const registerPdfScrollToPage = useCallback((fn: (page: number, options?: { instant?: boolean }) => void) => {
    pdfScrollToPageRef.current = fn;
  }, []);

  const value: ReaderContextValue = {
    viewMode,
    setViewMode,
    documentId,
    documentKind,
    documentMeta: meta,
    pdf: isPdf ? pdf : null,
    pageCount: isPdf ? pageCount : 0,
    isLoading,
    error,
    words,
    pageWordCounts,
    isTextReady,
    currentWordIndex,
    setCurrentWordIndex,
    currentPage,
    setCurrentPage,
    speedReadWpm,
    setSpeedReadWpm,
    startSpeedReadAt,
    jumpToWordInPDF,
    registerPdfScrollToPage,
  };

  return (
    <ReaderContext.Provider value={value}>
      {children}
    </ReaderContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useReaderContext(): ReaderContextValue {
  const ctx = useContext(ReaderContext);
  if (!ctx) {
    throw new Error('useReaderContext must be used within a ReaderProvider');
  }
  return ctx;
}
