'use client';

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type {
  DocumentMeta,
  HighlightColor,
  TextHighlight,
  TextBookmark,
} from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';
import {
  getDocument,
  getText,
  updateLastOpened,
  deleteDocumentComplete,
} from '@/lib/storage';
import { tokenize } from '@/lib/tokenize';
import { useTextHighlights } from '@/hooks/useTextHighlights';
import { useTextBookmarks } from '@/hooks/useTextBookmarks';
import {
  getSpeedReadSession,
  clearSpeedReadSession,
  navigateToDocumentSpeedRead,
} from '@/lib/speed-read';
import { getFeatureFlag } from '@/lib/feature-flags';
import { getPreferences } from '@/lib/storage';
import { trackEvent } from '@/lib/telemetry';
import { ReaderContext } from '@/contexts/ReaderContext';
import { HighlightPopover } from '@/components/pdf/PDFHighlightPopover';
import { SelectionActionBar } from './SelectionActionBar';

interface TextReaderProps {
  documentId: string;
}

const PROGRESS_TICKS = 60;

export function TextReader({ documentId }: TextReaderProps) {
  const router = useRouter();
  const readerCtx = useContext(ReaderContext);
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetTab, setSheetTab] = useState<'bookmarks' | 'notes'>('bookmarks');
  const [sheetOpen, setSheetOpen] = useState(false);
  const isProgressTrackingEnabled = getFeatureFlag('reader_progress_unified');

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const suppressScrollIndexRef = useRef(false);

  // Read typography preferences once on mount
  const [readingFont, setReadingFont] = useState<'fraunces' | 'space-grotesk' | 'system'>('fraunces');
  const [textSize, setTextSize] = useState<'sm' | 'md' | 'lg'>('md');
  useEffect(() => {
    const prefs = getPreferences();
     
    setReadingFont(prefs.readingFont);
     
    setTextSize(prefs.textSize);
  }, []);

  const bodyFontFamily =
    readingFont === 'space-grotesk'
      ? 'var(--font-sans), system-ui, sans-serif'
      : readingFont === 'system'
      ? 'system-ui, -apple-system, sans-serif'
      : 'var(--font-serif), Georgia, serif';
  const bodyFontSize = textSize === 'sm' ? 15 : textSize === 'lg' ? 19 : 17;

  const words = useMemo(() => {
    if (!textContent) return [];
    return tokenize(textContent);
  }, [textContent]);

  const {
    highlights,
    addHighlight,
    removeHighlight,
    updateHighlightNote,
    updateHighlightColor,
    getHighlightAtWord,
  } = useTextHighlights({ documentId, words });

  const {
    bookmarks,
    addBookmark,
    removeBookmark,
    toggleBookmark: toggleWordBookmark,
    isWordBookmarked,
  } = useTextBookmarks({ documentId });

  const isCurrentWordBookmarked = useMemo(
    () => isWordBookmarked(currentWordIndex),
    [isWordBookmarked, currentWordIndex]
  );

  const textContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{
    startWord: number;
    endWord: number;
    text: string;
    anchorRect: { x: number; y: number };
  } | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<{
    highlight: TextHighlight;
    anchorRect: { x: number; y: number };
  } | null>(null);

  // Load document
  useEffect(() => {
    async function loadDocument() {
      setIsLoading(true);
      setError(null);
      try {
        const docMeta = getDocument(documentId);
        if (!docMeta) {
          setError('Document not found');
          setIsLoading(false);
          return;
        }
        setMeta(docMeta);
        updateLastOpened(documentId);
        const content = await getText(documentId);
        if (content === null) {
          setError('Text content not found');
          setIsLoading(false);
          return;
        }
        setTextContent(content);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load document');
      } finally {
        setIsLoading(false);
      }
    }
    loadDocument();
  }, [documentId]);

  // Highlight word when returning from speed-read
  const prevViewModeRef = useRef(readerCtx?.viewMode);
  useEffect(() => {
    const prevMode = prevViewModeRef.current;
    const curMode = readerCtx?.viewMode;
    prevViewModeRef.current = curMode;

    if (prevMode === 'speed-read' && curMode === 'pdf' && readerCtx) {
      const wordIndex = readerCtx.currentWordIndex;
      requestAnimationFrame(() => {
        const wordSpan = textContainerRef.current?.querySelector(
          `[data-word-index="${wordIndex}"]`
        ) as HTMLElement | null;
        if (!wordSpan) return;
        wordSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
        wordSpan.style.backgroundColor = 'var(--accent-35)';
        wordSpan.style.boxShadow = '0 0 0 4px var(--accent-20)';
        wordSpan.style.borderRadius = '3px';
        const clearHighlight = () => {
          wordSpan.style.transition = 'background-color 0.6s ease-out, box-shadow 0.6s ease-out';
          wordSpan.style.backgroundColor = '';
          wordSpan.style.boxShadow = '';
          setTimeout(() => {
            wordSpan.style.transition = '';
            wordSpan.style.borderRadius = '';
          }, 600);
          document.removeEventListener('pointerdown', clearHighlight);
        };
        setTimeout(() => {
          document.addEventListener('pointerdown', clearHighlight, { once: true });
        }, 500);
      });
    }
  }, [readerCtx?.viewMode, readerCtx?.currentWordIndex, readerCtx]);

  // Scroll to speed-read resume target
  useEffect(() => {
    if (isLoading || !textContent) return;
    const session = getSpeedReadSession();
    if (!session || session.documentId !== documentId || session.kind !== 'text') {
      return;
    }
    clearSpeedReadSession();
    requestAnimationFrame(() => {
      const wordSpan = textContainerRef.current?.querySelector(
        `[data-word-index="${session.wordIndex}"]`
      );
      if (!wordSpan) return;
      wordSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (wordSpan as HTMLElement).style.backgroundColor = 'var(--accent-35)';
      (wordSpan as HTMLElement).style.boxShadow = '0 0 0 4px var(--accent-20)';
      setTimeout(() => {
        (wordSpan as HTMLElement).style.transition = 'all .6s ease';
        (wordSpan as HTMLElement).style.backgroundColor = '';
        (wordSpan as HTMLElement).style.boxShadow = '';
      }, 2500);
    });
  }, [isLoading, textContent, documentId]);

  // Persist live reading position
  useEffect(() => {
    if (!isProgressTrackingEnabled || words.length === 0) return;
    sessionStorage.setItem(
      `glyph:text-last-word:${documentId}`,
      JSON.stringify({ wordIndex: currentWordIndex, updatedAt: Date.now() })
    );
  }, [isProgressTrackingEnabled, currentWordIndex, words.length, documentId]);

  // Track current word based on scroll position
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    let rafId: number | null = null;

    const updateCurrentWord = () => {
      if (suppressScrollIndexRef.current) return;
      const textContainer = textContainerRef.current;
      if (!textContainer) return;
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetY = containerRect.top + 80;
      const targetX = containerRect.left + containerRect.width / 2;
      const element = document.elementFromPoint(targetX, targetY);
      if (!element) return;
      const wordSpan =
        element.closest('[data-word-index]') ||
        element.querySelector('[data-word-index]');
      if (wordSpan) {
        const wordIndex = parseInt(
          wordSpan.getAttribute('data-word-index') || '0',
          10
        );
        setCurrentWordIndex(wordIndex);
      }
    };

    const handleScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateCurrentWord);
    };

    updateCurrentWord();
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [textContent]);

  // Navigation handlers
  const handleNavigateHome = useCallback(() => router.push('/'), [router]);
  const handleDelete = useCallback(async () => {
    await deleteDocumentComplete(documentId);
    router.push('/');
  }, [documentId, router]);

  /**
   * Find the first word whose top edge is *at or below* the scroll container's
   * top — i.e., the first word fully visible on screen, not one clipped above.
   * Used when the user taps the idle Speed-read FAB so reading starts exactly
   * where their eyes are.
   */
  const getFirstVisibleWordIndex = useCallback((): number => {
    const scrollContainer = scrollContainerRef.current;
    const textContainer = textContainerRef.current;
    if (!scrollContainer || !textContainer) return currentWordIndex;

    const containerTop = scrollContainer.getBoundingClientRect().top;
    const spans = textContainer.querySelectorAll<HTMLElement>('[data-word-index]');
    for (const span of spans) {
      const rect = span.getBoundingClientRect();
      // Allow a 2px cushion for subpixel rounding
      if (rect.top >= containerTop - 2) {
        const idx = parseInt(span.getAttribute('data-word-index') || '', 10);
        if (Number.isFinite(idx)) return idx;
      }
    }
    return currentWordIndex;
  }, [currentWordIndex]);

  const handleSpeedRead = useCallback(
    (startAt?: number) => {
      const start = startAt ?? currentWordIndex;
      if (readerCtx) {
        readerCtx.startSpeedReadAt(start);
      } else {
        navigateToDocumentSpeedRead(router, documentId, {
          returnPath: `/reader/${documentId}`,
          startWordIndex: start,
          kind: 'text',
        });
      }
      trackEvent('text_reader_speedread_started', {
        documentId,
        startWordIndex: start,
        source: startAt !== undefined ? 'selection' : 'fab',
      });
    },
    [readerCtx, router, documentId, currentWordIndex]
  );

  const handleBookmarkToggle = useCallback(() => {
    if (isCurrentWordBookmarked) {
      toggleWordBookmark(currentWordIndex);
    } else {
      const word = words[currentWordIndex] || '';
      addBookmark(currentWordIndex, word + '...');
    }
    trackEvent('text_reader_bookmark_toggled', {
      documentId,
      wordIndex: currentWordIndex,
    });
  }, [
    isCurrentWordBookmarked,
    toggleWordBookmark,
    currentWordIndex,
    words,
    addBookmark,
    documentId,
  ]);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'b' || e.key === 'B') handleBookmarkToggle();
      if (e.key === 's' || e.key === 'S') setSheetOpen((v) => !v);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBookmarkToggle]);

  // Selection detection
  const processSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !textContainerRef.current) {
      return;
    }
    const range = sel.getRangeAt(0);
    const selectedText = sel.toString().trim();
    if (!selectedText) return;
    const container = textContainerRef.current;
    if (!container.contains(range.commonAncestorContainer)) return;

    const findWordSpan = (node: Node): Element | null => {
      let el: Node | null = node;
      if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
      if (!el || !(el instanceof Element)) return null;
      return el.closest('[data-word-index]');
    };

    let startSpan = findWordSpan(range.startContainer);
    let endSpan = findWordSpan(range.endContainer);

    if (!startSpan || !endSpan) {
      const wordSpans = container.querySelectorAll('[data-word-index]');
      let firstMatch: Element | null = null;
      let lastMatch: Element | null = null;
      for (const span of wordSpans) {
        if (range.intersectsNode(span)) {
          if (!firstMatch) firstMatch = span;
          lastMatch = span;
        }
      }
      if (!firstMatch || !lastMatch) return;
      startSpan = startSpan || firstMatch;
      endSpan = endSpan || lastMatch;
    }

    if (!container.contains(startSpan) || !container.contains(endSpan)) return;

    const startWord = parseInt(startSpan.getAttribute('data-word-index') || '0', 10);
    const endWord = parseInt(endSpan.getAttribute('data-word-index') || '0', 10);
    const normalizedStart = Math.min(startWord, endWord);
    const normalizedEnd = Math.max(startWord, endWord);

    const rects = range.getClientRects();
    const rect =
      rects.length > 0
        ? { first: rects[0], last: rects[rects.length - 1] }
        : {
            first: range.getBoundingClientRect(),
            last: range.getBoundingClientRect(),
          };
    if (rect.first.width === 0 && rect.first.height === 0) return;

    setSelection({
      startWord: normalizedStart,
      endWord: normalizedEnd,
      text: selectedText,
      anchorRect: {
        x: (rect.first.left + rect.last.right) / 2,
        y: rect.first.top,
      },
    });
  }, []);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleSelectionChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
        if (!textContainerRef.current) return;
        const range = sel.getRangeAt(0);
        if (!textContainerRef.current.contains(range.commonAncestorContainer)) return;
        if (!sel.toString().trim()) return;
        processSelection();
      }, 300);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [processSelection]);

  const handleCloseSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleCreateHighlight = useCallback(
    (color: HighlightColor, note?: string) => {
      if (!selection) return;
      const selectedWords = words.slice(selection.startWord, selection.endWord + 1);
      const text = selectedWords.join(' ');
      addHighlight({
        startWord: selection.startWord,
        endWord: selection.endWord,
        text,
        color,
        note,
      });
      trackEvent('text_reader_highlight_created', {
        documentId,
        color,
        startWord: selection.startWord,
        endWord: selection.endWord,
        hasNote: Boolean(note && note.trim()),
      });
      handleCloseSelection();
    },
    [selection, words, addHighlight, handleCloseSelection, documentId]
  );

  const handleSpeedReadSelection = useCallback(() => {
    if (!selection) return;
    handleSpeedRead(selection.startWord);
    handleCloseSelection();
  }, [selection, handleSpeedRead, handleCloseSelection]);

  const handleBookmarkSelection = useCallback(() => {
    if (!selection) return;
    const selectedWords = words.slice(selection.startWord, selection.endWord + 1);
    addBookmark(selection.startWord, selectedWords.join(' '), selection.endWord);
    handleCloseSelection();
  }, [selection, words, addBookmark, handleCloseSelection]);

  const handleCopySelection = useCallback(() => {
    if (!selection) return;
    const text = selection.text;
    const doFallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // Silent — toast still shows; user can long-press to copy via native menu
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(doFallback);
    } else {
      doFallback();
    }
    handleCloseSelection();
  }, [selection, handleCloseSelection]);

  // Highlight click → edit popover
  const handleHighlightClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      const target = e.target as HTMLElement;
      const highlightId = target.getAttribute('data-highlight-id');
      if (!highlightId) return;
      const highlight = highlights.find((h) => h.id === highlightId);
      if (!highlight) return;
      e.stopPropagation();
      const rect = target.getBoundingClientRect();
      setActiveHighlight({
        highlight,
        anchorRect: { x: rect.left + rect.width / 2, y: rect.top },
      });
    },
    [highlights]
  );

  const handleCloseHighlightPopover = useCallback(
    () => setActiveHighlight(null),
    []
  );
  const handleHighlightColorChange = useCallback(
    (color: HighlightColor) => {
      if (activeHighlight) updateHighlightColor(activeHighlight.highlight.id, color);
    },
    [activeHighlight, updateHighlightColor]
  );
  const handleHighlightNoteUpdate = useCallback(
    (note: string) => {
      if (activeHighlight) updateHighlightNote(activeHighlight.highlight.id, note);
    },
    [activeHighlight, updateHighlightNote]
  );
  const handleHighlightDelete = useCallback(() => {
    if (activeHighlight) {
      removeHighlight(activeHighlight.highlight.id);
      setActiveHighlight(null);
    }
  }, [activeHighlight, removeHighlight]);
  const handleHighlightSpeedRead = useCallback(() => {
    if (!activeHighlight) return;
    handleSpeedRead(activeHighlight.highlight.startWord);
    setActiveHighlight(null);
  }, [activeHighlight, handleSpeedRead]);

  // Bookmark jump
  const scrollToBookmark = useCallback((bookmark: TextBookmark) => {
    if (!textContainerRef.current) return;
    setSheetOpen(false);
    setCurrentWordIndex(bookmark.wordIndex);
    suppressScrollIndexRef.current = true;
    const container = textContainerRef.current;
    const startIdx = bookmark.wordIndex;
    const endIdx = bookmark.endWordIndex ?? bookmark.wordIndex;
    const spans: HTMLElement[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const span = container.querySelector(
        `[data-word-index="${i}"]`
      ) as HTMLElement | null;
      if (span) spans.push(span);
    }
    if (spans.length === 0) return;
    requestAnimationFrame(() => {
      spans[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      spans.forEach((span) => {
        span.style.backgroundColor = 'var(--accent-35)';
        span.style.boxShadow = '0 0 0 4px var(--accent-20)';
        span.style.borderRadius = '3px';
      });
      const clearHighlight = () => {
        spans.forEach((span) => {
          span.style.transition = 'background-color 0.6s ease-out, box-shadow 0.6s ease-out';
          span.style.backgroundColor = '';
          span.style.boxShadow = '';
          setTimeout(() => {
            span.style.transition = '';
            span.style.borderRadius = '';
          }, 600);
        });
        document.removeEventListener('pointerdown', clearHighlight);
      };
      setTimeout(() => {
        document.addEventListener('pointerdown', clearHighlight, { once: true });
      }, 500);
      setTimeout(() => {
        suppressScrollIndexRef.current = false;
      }, 800);
    });
  }, []);

  const scrollToHighlight = useCallback(
    (highlight: TextHighlight) => {
      if (!textContainerRef.current) return;
      setSheetOpen(false);
      const wordSpan = textContainerRef.current.querySelector(
        `[data-word-index="${highlight.startWord}"]`
      );
      if (wordSpan) {
        wordSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    []
  );

  const getBookmarkSnippet = useCallback(
    (wordIndex: number): string => {
      if (words.length === 0) return '';
      const startIdx = Math.max(0, wordIndex - 5);
      const endIdx = Math.min(words.length - 1, wordIndex + 5);
      let snippet = words.slice(startIdx, endIdx + 1).join(' ');
      if (startIdx > 0) snippet = '…' + snippet;
      if (endIdx < words.length - 1) snippet = snippet + '…';
      return snippet;
    },
    [words]
  );

  const highlightsWithNotes = useMemo(
    () => highlights.filter((h) => h.note && h.note.trim().length > 0),
    [highlights]
  );

  const documentTitle = meta?.title || 'Untitled Document';
  const progress = words.length
    ? (currentWordIndex + 1) / words.length
    : 0;
  const pct = Math.round(progress * 100);

  if (isLoading) {
    return (
      <div
        style={{
          height: '100%',
          background: 'var(--paper)',
          color: 'var(--paper-ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="spinner"
          style={{
            width: 32,
            height: 32,
            border: '2px solid rgba(20,17,12,0.15)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
          }}
          aria-label="Loading"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: '100%',
          background: 'var(--paper)',
          color: 'var(--paper-ink)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600 }}>
          {error === 'Document not found'
            ? 'Document not found'
            : error === 'Text content not found'
            ? 'Content missing'
            : 'Failed to load'}
        </div>
        <div style={{ color: 'var(--paper-muted)', fontSize: 14 }}>{error}</div>
        <button
          onClick={error === 'Text content not found' ? handleDelete : handleNavigateHome}
          style={{
            marginTop: 8,
            padding: '10px 18px',
            borderRadius: 999,
            background: 'var(--paper-ink)',
            color: 'var(--paper)',
            border: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {error === 'Text content not found' ? 'Delete document' : 'Back to library'}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--paper)',
        color: 'var(--paper-ink)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: 'max(env(safe-area-inset-top), 20px) 16px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--paper-rule)',
          gap: 12,
        }}
      >
        <button
          onClick={handleNavigateHome}
          aria-label="Back to library"
          style={topIconStyle}
        >
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
            <path
              d="M7 1L3 6l4 5"
              stroke="var(--paper-ink)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div
          className="micro-label"
          style={{ color: 'var(--paper-muted)', flex: 1, textAlign: 'center' }}
          title={documentTitle}
        >
          {documentTitle.length > 24
            ? documentTitle.slice(0, 22) + '…'
            : documentTitle}{' '}
          · {pct}%
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleBookmarkToggle}
            aria-label={isCurrentWordBookmarked ? 'Remove bookmark' : 'Bookmark this position'}
            aria-pressed={isCurrentWordBookmarked}
            style={topIconStyle}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 1h10v14l-5-3-5 3V1z"
                stroke="var(--paper-ink)"
                strokeWidth="1.3"
                fill={isCurrentWordBookmarked ? 'var(--accent)' : 'none'}
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={() => setSheetOpen((v) => !v)}
            aria-label="Open bookmarks and notes"
            style={topIconStyle}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="1.5" fill="var(--paper-ink)" />
              <circle cx="3" cy="8" r="1.5" fill="var(--paper-ink)" />
              <circle cx="13" cy="8" r="1.5" fill="var(--paper-ink)" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress strip */}
      <div style={{ padding: '6px 16px 0', display: 'flex', gap: 2 }}>
        {Array.from({ length: PROGRESS_TICKS }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 2,
              background:
                i / PROGRESS_TICKS < progress
                  ? 'var(--accent)'
                  : 'rgba(20,17,12,0.08)',
            }}
          />
        ))}
      </div>

      {/* Body */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          padding: '28px 24px 120px',
          overflow: 'auto',
        }}
      >
        <div className="micro-label" style={{ color: 'var(--paper-muted)', marginBottom: 8 }}>
          {meta?.kind === 'text' && words.length ? `${words.length.toLocaleString()} words` : 'Text'}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: 30,
            fontWeight: 500,
            margin: '0 0 18px',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: 'var(--paper-ink)',
          }}
        >
          <span style={{ fontStyle: 'italic' }}>{documentTitle}</span>
        </h1>
        <div
          ref={textContainerRef}
          className="text-reader-content"
          style={{
            fontFamily: bodyFontFamily,
            fontSize: bodyFontSize,
            lineHeight: 1.65,
            color: 'var(--paper-ink)',
            WebkitUserSelect: 'text',
            userSelect: 'text',
          }}
          onMouseUp={processSelection}
        >
          {(() => {
            if (!textContent) return null;
            const paragraphs = textContent.split('\n');
            let globalWordIndex = 0;
            return paragraphs.map((paragraph, pIndex) => {
              const paragraphWords = tokenize(paragraph);
              if (paragraphWords.length === 0) {
                return (
                  <p key={pIndex} style={{ margin: '0 0 16px' }}>
                    {'\u00A0'}
                  </p>
                );
              }
              const wordElements = paragraphWords.map((word, wIndex) => {
                const currentIndex = globalWordIndex;
                globalWordIndex++;
                const highlight = getHighlightAtWord(currentIndex);
                const bgStyle = highlight
                  ? { backgroundColor: HIGHLIGHT_COLORS[highlight.color].bg }
                  : undefined;
                return (
                  <React.Fragment key={`${pIndex}-${wIndex}`}>
                    <span
                      data-word-index={currentIndex}
                      data-highlight-id={highlight?.id}
                      style={{
                        ...bgStyle,
                        padding: highlight ? '1px 2px' : undefined,
                        borderRadius: highlight ? 2 : undefined,
                        cursor: highlight ? 'pointer' : undefined,
                      }}
                      onClick={highlight ? handleHighlightClick : undefined}
                    >
                      {word}
                    </span>
                    {wIndex < paragraphWords.length - 1 && ' '}
                  </React.Fragment>
                );
              });
              return (
                <p key={pIndex} style={{ margin: '0 0 16px', textWrap: 'pretty' }}>
                  {wordElements}
                </p>
              );
            });
          })()}
        </div>
      </div>

      {/* Floating action bar — morphs between idle (Speed-read FAB) and selection actions */}
      <SelectionActionBar
        selection={selection}
        onHighlight={handleCreateHighlight}
        onSpeedRead={handleSpeedReadSelection}
        onBookmark={handleBookmarkSelection}
        onCopy={handleCopySelection}
        onDismiss={handleCloseSelection}
        onIdleSpeedRead={() => handleSpeedRead(getFirstVisibleWordIndex())}
      />

      {/* Existing highlight edit popover */}
      {activeHighlight && (
        <HighlightPopover
          highlight={activeHighlight.highlight}
          anchorRect={activeHighlight.anchorRect}
          onUpdateNote={handleHighlightNoteUpdate}
          onUpdateColor={handleHighlightColorChange}
          onDelete={handleHighlightDelete}
          onSpeedRead={handleHighlightSpeedRead}
          onClose={handleCloseHighlightPopover}
        />
      )}

      {/* Bottom sheet: bookmarks + notes */}
      {sheetOpen && (
        <>
          <div
            onClick={() => setSheetOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(20,17,12,0.25)',
              zIndex: 40,
            }}
          />
          <div
            className="sheet-in"
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 'calc(20px + env(safe-area-inset-bottom))',
              zIndex: 50,
              borderRadius: 20,
              background: 'var(--paper)',
              border: '1px solid var(--paper-rule)',
              boxShadow: '0 16px 40px rgba(20,17,12,0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                display: 'flex',
                gap: 4,
                borderBottom: '1px solid var(--paper-rule)',
              }}
            >
              <SheetTab
                active={sheetTab === 'bookmarks'}
                onClick={() => setSheetTab('bookmarks')}
              >
                Bookmarks · {bookmarks.length}
              </SheetTab>
              <SheetTab
                active={sheetTab === 'notes'}
                onClick={() => setSheetTab('notes')}
              >
                Notes · {highlightsWithNotes.length}
              </SheetTab>
            </div>
            <div style={{ maxHeight: '40vh', overflow: 'auto' }}>
              {sheetTab === 'bookmarks' ? (
                bookmarks.length === 0 ? (
                  <SheetEmpty text="No bookmarks yet. Use the bookmark icon to save a spot." />
                ) : (
                  bookmarks.map((bm) => (
                    <div
                      key={bm.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--paper-rule)',
                        display: 'flex',
                        gap: 8,
                      }}
                    >
                      <button
                        onClick={() => scrollToBookmark(bm)}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          background: 'transparent',
                          border: 0,
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--paper-ink)',
                          font: 'inherit',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontFamily: 'var(--font-serif), Georgia, serif',
                            lineHeight: 1.45,
                          }}
                        >
                          &ldquo;{bm.label || getBookmarkSnippet(bm.wordIndex)}&rdquo;
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            fontFamily: 'var(--font-mono), monospace',
                            color: 'var(--paper-muted)',
                            letterSpacing: '0.12em',
                            marginTop: 4,
                          }}
                        >
                          Word {bm.wordIndex + 1} / {words.length}
                        </div>
                      </button>
                      <button
                        onClick={() => removeBookmark(bm.id)}
                        aria-label="Remove bookmark"
                        style={{
                          background: 'transparent',
                          border: 0,
                          color: 'var(--paper-muted)',
                          cursor: 'pointer',
                          padding: 4,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )
              ) : highlightsWithNotes.length === 0 ? (
                <SheetEmpty text="No notes yet. Highlight text and attach a note." />
              ) : (
                highlightsWithNotes.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => scrollToHighlight(h)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--paper-rule)',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      color: 'var(--paper-ink)',
                      font: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontFamily: 'var(--font-serif), Georgia, serif',
                        fontStyle: 'italic',
                        lineHeight: 1.45,
                        borderLeft: `2px solid ${HIGHLIGHT_COLORS[h.color].hex}`,
                        paddingLeft: 10,
                      }}
                    >
                      &ldquo;
                      {h.text.length > 110 ? h.text.slice(0, 108) + '…' : h.text}
                      &rdquo;
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--paper-muted)',
                        marginTop: 6,
                        paddingLeft: 10,
                      }}
                    >
                      {h.note}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const topIconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'transparent',
  border: 0,
  color: 'var(--paper-ink)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
};

function SheetTab({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 20,
        background: active ? 'var(--paper-ink)' : 'transparent',
        color: active ? 'var(--paper)' : 'var(--paper-ink)',
        border: `1px solid ${active ? 'var(--paper-ink)' : 'var(--paper-rule)'}`,
        fontSize: 10,
        fontFamily: 'var(--font-mono), monospace',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function SheetEmpty({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '28px 18px',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--paper-muted)',
      }}
    >
      {text}
    </div>
  );
}
