'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentMeta, HighlightColor, TextHighlight, TextBookmark } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';
import { getDocument, getText, updateLastOpened, deleteDocumentComplete } from '@/lib/storage';
import { tokenize } from '@/lib/tokenize';
import { SelectionPopover, HighlightPopover } from '@/components/pdf/PDFHighlightPopover';
import { useTextHighlights } from '@/hooks/useTextHighlights';
import { useTextBookmarks } from '@/hooks/useTextBookmarks';
import { getSpeedReadSession, clearSpeedReadSession, navigateToDocumentSpeedRead } from '@/lib/speed-read';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { getFeatureFlag } from '@/lib/feature-flags';
import { trackEvent } from '@/lib/telemetry';
import { ReaderContext } from '@/contexts/ReaderContext';

interface TextReaderProps {
  documentId: string;
}

type SidebarTab = 'bookmarks' | 'notes';

export function TextReader({ documentId }: TextReaderProps) {
  const router = useRouter();
  const readerCtx = useContext(ReaderContext);
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Default closed on mobile
    if (window.innerWidth < 640) return false;
    const stored = localStorage.getItem('glyph:sidebar-open');
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [activeTab, setActiveTab] = useState<SidebarTab>('bookmarks');
  const isTopbarSpeedReadEnabled = getFeatureFlag('textreader_topbar_speedread_enabled');
  const isProgressTrackingEnabled = getFeatureFlag('reader_progress_unified');

  // Current word index for position tracking
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  // Tokenize text content into words (moved up so we can pass to highlights hook)
  const words = useMemo(() => {
    if (!textContent) return [];
    return tokenize(textContent);
  }, [textContent]);

  // Text highlights hook
  const {
    highlights,
    addHighlight,
    removeHighlight,
    updateHighlightNote,
    updateHighlightColor,
    getHighlightAtWord,
  } = useTextHighlights({ documentId, words });

  // Text bookmarks hook
  const {
    bookmarks,
    toggleBookmark: toggleWordBookmark,
    isWordBookmarked,
  } = useTextBookmarks({ documentId });

  // Check if current word is bookmarked
  const isCurrentWordBookmarked = useMemo(() => {
    return isWordBookmarked(currentWordIndex);
  }, [isWordBookmarked, currentWordIndex]);

  // Selection state
  const textContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{
    startWord: number;
    endWord: number;
    text: string;
    anchorRect: { x: number; y: number };
  } | null>(null);

  // Active highlight for popover (when clicking a highlighted word)
  const [activeHighlight, setActiveHighlight] = useState<{
    highlight: TextHighlight;
    anchorRect: { x: number; y: number };
  } | null>(null);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('glyph:sidebar-open', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  // Load document metadata and content
  useEffect(() => {
    async function loadDocument() {
      setIsLoading(true);
      setError(null);

      try {
        // Get document metadata
        const docMeta = getDocument(documentId);
        if (!docMeta) {
          setError('Document not found');
          setIsLoading(false);
          return;
        }

        setMeta(docMeta);

        // Update lastOpenedAt
        updateLastOpened(documentId);

        // Get text content from IndexedDB
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

  // Highlight + scroll to current word when returning from speed-read mode
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

        // Apply persistent highlight — stays until user taps/clicks the screen
        wordSpan.style.backgroundColor = 'rgba(251, 146, 60, 0.5)';
        wordSpan.style.boxShadow = '0 0 0 4px rgba(251, 146, 60, 0.35)';
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

        // Only clear on user interaction (tap/click), not scroll.
        // Delay listener registration so the tap that triggered "back to reader" doesn't immediately clear it.
        setTimeout(() => {
          document.addEventListener('pointerdown', clearHighlight, { once: true });
        }, 500);
      });
    }
  }, [readerCtx?.viewMode, readerCtx?.currentWordIndex, readerCtx]);

  // Check for speed read session and scroll to the word with focus highlight
  useEffect(() => {
    if (isLoading || !textContent) return;

    const session = getSpeedReadSession();
    if (!session || session.documentId !== documentId || session.kind !== 'text') {
      return;
    }

    // Clear the session to prevent re-triggering
    clearSpeedReadSession();

    // Wait for next frame to ensure DOM is ready
    requestAnimationFrame(() => {
      const wordSpan = textContainerRef.current?.querySelector(
        `[data-word-index="${session.wordIndex}"]`
      );
      if (!wordSpan) return;

      // Scroll to the word
      wordSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add temporary focus highlight
      wordSpan.classList.add('ring-2', 'ring-zinc-400', 'bg-zinc-400/20', 'rounded');

      // Remove highlight on user interaction or after 3 seconds
      const clearHighlight = () => {
        wordSpan.classList.remove('ring-2', 'ring-zinc-400', 'bg-zinc-400/20', 'rounded');
        scrollContainerRef.current?.removeEventListener('scroll', clearHighlight);
        document.removeEventListener('click', clearHighlight);
      };

      // Set up listeners to clear on interaction
      scrollContainerRef.current?.addEventListener('scroll', clearHighlight, { once: true });
      document.addEventListener('click', clearHighlight, { once: true });

      // Also clear after 3 seconds
      setTimeout(clearHighlight, 3000);
    });
  }, [isLoading, textContent, documentId]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev: boolean) => !prev);
  }, []);

  const handleNavigateHome = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleDelete = useCallback(async () => {
    await deleteDocumentComplete(documentId);
    router.push('/');
  }, [documentId, router]);

  const handleSpeedRead = useCallback(() => {
    if (!isTopbarSpeedReadEnabled) return;

    if (readerCtx) {
      readerCtx.startSpeedReadAt(currentWordIndex > 0 ? currentWordIndex : 0);
    } else {
      navigateToDocumentSpeedRead(router, documentId, {
        returnPath: `/reader/${documentId}`,
        startWordIndex: currentWordIndex > 0 ? currentWordIndex : undefined,
        kind: 'text',
      });
    }
    trackEvent('text_reader_speedread_started', {
      documentId,
      startWordIndex: currentWordIndex,
      source: 'topbar',
    });
  }, [isTopbarSpeedReadEnabled, readerCtx, router, documentId, currentWordIndex]);

  const handleBookmarkToggle = useCallback(() => {
    toggleWordBookmark(currentWordIndex);
    trackEvent('text_reader_bookmark_toggled', {
      documentId,
      wordIndex: currentWordIndex,
    });
  }, [toggleWordBookmark, currentWordIndex, documentId]);

  // Persist live text reading position for future unified progress sync.
  useEffect(() => {
    if (!isProgressTrackingEnabled || words.length === 0) return;
    sessionStorage.setItem(
      `glyph:text-last-word:${documentId}`,
      JSON.stringify({
        wordIndex: currentWordIndex,
        updatedAt: Date.now(),
      })
    );
  }, [isProgressTrackingEnabled, currentWordIndex, words.length, documentId]);

  // Track current word based on scroll position
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let rafId: number | null = null;

    const updateCurrentWord = () => {
      const textContainer = textContainerRef.current;
      if (!textContainer) return;

      // Get the scroll container's bounding rect
      const containerRect = scrollContainer.getBoundingClientRect();
      // Target point: near the top of the visible area with a small offset
      const targetY = containerRect.top + 80; // 80px offset from top
      const targetX = containerRect.left + containerRect.width / 2;

      // Find element at this point
      const element = document.elementFromPoint(targetX, targetY);
      if (!element) return;

      // Find the nearest word span
      const wordSpan = element.closest('[data-word-index]') ||
                       element.querySelector('[data-word-index]');

      if (wordSpan) {
        const wordIndex = parseInt(wordSpan.getAttribute('data-word-index') || '0', 10);
        setCurrentWordIndex(wordIndex);
      }
    };

    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updateCurrentWord);
    };

    // Initial update
    updateCurrentWord();

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [textContent]);

  // Keyboard shortcuts for sidebar toggle and bookmark
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        toggleSidebar();
      }
      if (e.key === 'b' || e.key === 'B') {
        handleBookmarkToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar, handleBookmarkToggle]);

  // Handle text selection (works for both mouse and touch via selectionchange)
  const processSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !textContainerRef.current) {
      return;
    }

    const range = sel.getRangeAt(0);
    const selectedText = sel.toString().trim();
    if (!selectedText) {
      return;
    }

    const container = textContainerRef.current;
    if (!container.contains(range.commonAncestorContainer)) {
      return;
    }

    // Try to find word spans from selection endpoints
    const findWordSpan = (node: Node): Element | null => {
      let el: Node | null = node;
      if (el.nodeType === Node.TEXT_NODE) {
        el = el.parentElement;
      }
      if (!el || !(el instanceof Element)) return null;
      // Try closest first (works when selection is inside a word span)
      const span = el.closest('[data-word-index]');
      if (span) return span;
      // Fallback: if we're on a container element, find the first/last child word span
      return null;
    };

    let startSpan = findWordSpan(range.startContainer);
    let endSpan = findWordSpan(range.endContainer);

    // Fallback: if closest() failed (e.g., selection starts in whitespace between spans
    // on iOS Safari), find intersecting word spans by checking all spans against the range
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

    if (!container.contains(startSpan) || !container.contains(endSpan)) {
      return;
    }

    const startWord = parseInt(startSpan.getAttribute('data-word-index') || '0', 10);
    const endWord = parseInt(endSpan.getAttribute('data-word-index') || '0', 10);

    const normalizedStart = Math.min(startWord, endWord);
    const normalizedEnd = Math.max(startWord, endWord);

    // Get anchor position for popover (center-top of selection)
    const rects = range.getClientRects();
    // Fallback to getBoundingClientRect if getClientRects is empty (iOS edge case)
    const rect = rects.length > 0
      ? { first: rects[0], last: rects[rects.length - 1] }
      : { first: range.getBoundingClientRect(), last: range.getBoundingClientRect() };

    if (rect.first.width === 0 && rect.first.height === 0) return;

    const anchorX = (rect.first.left + rect.last.right) / 2;
    const anchorY = rect.first.top;

    setSelection({
      startWord: normalizedStart,
      endWord: normalizedEnd,
      text: selectedText,
      anchorRect: { x: anchorX, y: anchorY },
    });
  }, []);

  // Listen for selectionchange to support mobile text selection (long-press + handle drag)
  // Also handles desktop mouseup selection
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleSelectionChange = () => {
      // Debounce: on iOS Safari, selectionchange fires rapidly during long-press
      // and handle dragging. Use a longer debounce to wait for selection to stabilize.
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          return; // Don't clear selection state here — let the popover handle that
        }

        // Only process if the selection is within our text container
        if (!textContainerRef.current) return;
        const range = sel.getRangeAt(0);
        if (!textContainerRef.current.contains(range.commonAncestorContainer)) return;

        // On iOS, verify the selection has actual text (not just an empty range from long-press start)
        const text = sel.toString().trim();
        if (!text) return;

        processSelection();
      }, 300);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [processSelection]);

  // Close selection popover
  const handleCloseSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Handle highlight creation
  const handleCreateHighlight = useCallback((color: HighlightColor, note?: string) => {
    if (!selection) return;

    // Build the text from the selected word range
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
  }, [selection, words, addHighlight, handleCloseSelection, documentId]);

  // Handle speed read from selection - starts at selected word and continues to end
  const handleSpeedReadSelection = useCallback(() => {
    if (!selection) return;

    if (readerCtx) {
      readerCtx.startSpeedReadAt(selection.startWord);
    } else {
      navigateToDocumentSpeedRead(router, documentId, {
        returnPath: `/reader/${documentId}`,
        startWordIndex: selection.startWord,
        kind: 'text',
      });
    }
    trackEvent('text_reader_speedread_started', {
      documentId,
      startWordIndex: selection.startWord,
      source: 'selection',
    });

    handleCloseSelection();
  }, [selection, readerCtx, documentId, router, handleCloseSelection]);

  // Handle click on highlighted word
  const handleHighlightClick = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    const target = e.target as HTMLElement;
    const highlightId = target.getAttribute('data-highlight-id');
    if (!highlightId) return;

    const highlight = highlights.find((h) => h.id === highlightId);
    if (!highlight) return;

    // Prevent text selection when clicking a highlight
    e.stopPropagation();

    // Get anchor position for popover
    const rect = target.getBoundingClientRect();
    const anchorX = rect.left + rect.width / 2;
    const anchorY = rect.top;

    setActiveHighlight({
      highlight,
      anchorRect: { x: anchorX, y: anchorY },
    });
  }, [highlights]);

  // Close highlight popover
  const handleCloseHighlightPopover = useCallback(() => {
    setActiveHighlight(null);
  }, []);

  // Handle highlight color change
  const handleHighlightColorChange = useCallback((color: HighlightColor) => {
    if (activeHighlight) {
      updateHighlightColor(activeHighlight.highlight.id, color);
      trackEvent('text_reader_highlight_color_changed', {
        documentId,
        highlightId: activeHighlight.highlight.id,
        color,
      });
    }
  }, [activeHighlight, updateHighlightColor, documentId]);

  // Handle highlight note update
  const handleHighlightNoteUpdate = useCallback((note: string) => {
    if (activeHighlight) {
      updateHighlightNote(activeHighlight.highlight.id, note);
      trackEvent('text_reader_highlight_note_updated', {
        documentId,
        highlightId: activeHighlight.highlight.id,
        noteLength: note.length,
      });
    }
  }, [activeHighlight, updateHighlightNote, documentId]);

  // Handle highlight delete
  const handleHighlightDelete = useCallback(() => {
    if (activeHighlight) {
      removeHighlight(activeHighlight.highlight.id);
      trackEvent('text_reader_highlight_deleted', {
        documentId,
        highlightId: activeHighlight.highlight.id,
      });
      setActiveHighlight(null);
    }
  }, [activeHighlight, removeHighlight, documentId]);

  // Handle speed read from highlight - starts at highlight's start word and continues to end
  const handleHighlightSpeedRead = useCallback(() => {
    if (!activeHighlight) return;

    if (readerCtx) {
      readerCtx.startSpeedReadAt(activeHighlight.highlight.startWord);
    } else {
      navigateToDocumentSpeedRead(router, documentId, {
        returnPath: `/reader/${documentId}`,
        startWordIndex: activeHighlight.highlight.startWord,
        kind: 'text',
      });
    }
    trackEvent('text_reader_speedread_started', {
      documentId,
      startWordIndex: activeHighlight.highlight.startWord,
      source: 'highlight',
    });

    handleCloseHighlightPopover();
  }, [activeHighlight, readerCtx, documentId, router, handleCloseHighlightPopover]);

  // Scroll to a highlight by finding the first word span
  const scrollToHighlight = useCallback((highlight: TextHighlight) => {
    if (!textContainerRef.current) return;

    const wordSpan = textContainerRef.current.querySelector(
      `[data-word-index="${highlight.startWord}"]`
    );
    if (wordSpan) {
      wordSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Flash effect to indicate the highlight
      const highlightSpans = textContainerRef.current.querySelectorAll(
        `[data-highlight-id="${highlight.id}"]`
      );
      highlightSpans.forEach((span) => {
        span.classList.add('ring-2', 'ring-zinc-400');
        setTimeout(() => {
          span.classList.remove('ring-2', 'ring-zinc-400');
        }, 1500);
      });
    }
  }, []);

  // Scroll to a bookmark by finding the word span
  const scrollToBookmark = useCallback((bookmark: TextBookmark) => {
    if (!textContainerRef.current) return;

    const wordSpan = textContainerRef.current.querySelector(
      `[data-word-index="${bookmark.wordIndex}"]`
    );
    if (wordSpan) {
      wordSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Flash effect to indicate the bookmarked word
      wordSpan.classList.add('ring-2', 'ring-zinc-400', 'rounded');
      setTimeout(() => {
        wordSpan.classList.remove('ring-2', 'ring-zinc-400', 'rounded');
      }, 1500);
    }
  }, []);

  // Generate a snippet for a bookmark (40-60 chars centered on the word)
  const getBookmarkSnippet = useCallback((wordIndex: number): string => {
    if (words.length === 0) return '';

    // Target around 50 characters, centered on the bookmarked word
    const targetLength = 50;
    const wordsPerSide = 5; // Approximate words on each side

    const startIdx = Math.max(0, wordIndex - wordsPerSide);
    const endIdx = Math.min(words.length - 1, wordIndex + wordsPerSide);

    let snippet = words.slice(startIdx, endIdx + 1).join(' ');

    // Trim to target length if needed
    if (snippet.length > 60) {
      // Find the bookmarked word position in the snippet
      const beforeWords = words.slice(startIdx, wordIndex).join(' ');
      const targetWord = words[wordIndex];
      const afterWords = words.slice(wordIndex + 1, endIdx + 1).join(' ');

      // Build a centered snippet
      const halfTarget = Math.floor((targetLength - targetWord.length) / 2);
      const beforeSnippet = beforeWords.length > halfTarget
        ? '...' + beforeWords.slice(-halfTarget + 3)
        : beforeWords;
      const afterSnippet = afterWords.length > halfTarget
        ? afterWords.slice(0, halfTarget - 3) + '...'
        : afterWords;

      snippet = `${beforeSnippet} ${targetWord} ${afterSnippet}`.trim();
    }

    // Add ellipsis if not at the start/end
    if (startIdx > 0 && !snippet.startsWith('...')) {
      snippet = '...' + snippet;
    }
    if (endIdx < words.length - 1 && !snippet.endsWith('...')) {
      snippet = snippet + '...';
    }

    return snippet;
  }, [words]);

  // Get position string for a bookmark
  const getBookmarkPosition = useCallback((wordIndex: number): string => {
    const totalWords = words.length;
    if (totalWords === 0) return '';
    const percent = Math.round(((wordIndex + 1) / totalWords) * 100);
    return `Word ${wordIndex + 1} / ${totalWords} (${percent}%)`;
  }, [words]);

  // Filter highlights to only those with notes
  const highlightsWithNotes = useMemo(() => {
    return highlights.filter((h) => h.note && h.note.trim().length > 0);
  }, [highlights]);

  // Document title
  const documentTitle = meta?.title || 'Untitled Document';

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex items-center justify-center h-full">
          <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" aria-label="Loading text reader" />
        </div>
      </div>
    );
  }

  // Error state: document not found
  if (error === 'Document not found') {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex flex-col items-center justify-center h-full text-zinc-400">
          <svg className="w-16 h-16 mb-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg mb-2">Document not found</p>
          <p className="text-sm text-zinc-500 mb-6">This document may have been deleted.</p>
          <button
            onClick={handleNavigateHome}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  // Error state: text content missing
  if (error === 'Text content not found') {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex flex-col items-center justify-center h-full text-zinc-400">
          <svg className="w-16 h-16 mb-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-lg mb-2">Text content not found</p>
          <p className="text-sm text-zinc-500 mb-6">The content for this document is missing from storage.</p>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Delete Document
          </button>
        </div>
      </div>
    );
  }

  // Generic error state
  if (error) {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex flex-col items-center justify-center h-full text-zinc-400">
          <svg className="w-16 h-16 mb-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-lg mb-2">Failed to load document</p>
          <p className="text-sm text-zinc-500 mb-6">{error}</p>
          <button
            onClick={handleNavigateHome}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        {/* Main row */}
        <div className="h-12 flex items-center justify-between px-2 sm:px-4">
          {/* Left: Sidebar toggle, Home button, and title */}
          <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={toggleSidebar}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={handleNavigateHome}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
              aria-label="Back to library"
              title="Back to Library"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <span className="text-zinc-300 text-sm font-medium truncate" title={documentTitle}>
              {documentTitle}
            </span>
          </div>

          {/* Center: Position indicator — hidden on mobile, shown on sm+ */}
          <div className="hidden sm:flex items-center gap-2 text-zinc-500 text-sm flex-shrink-0 mx-4">
            {words.length > 0 && (
              <span aria-live="polite">
                Word {currentWordIndex + 1} / {words.length} ({Math.round(((currentWordIndex + 1) / words.length) * 100)}%)
              </span>
            )}
          </div>

          {/* Right: Speed Read, Bookmark, Theme */}
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <button
              onClick={handleSpeedRead}
              disabled={!isTopbarSpeedReadEnabled}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Speed read document"
              title="Speed read document"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
            <button
              onClick={handleBookmarkToggle}
              className={`p-2 rounded-lg transition-colors ${
                isCurrentWordBookmarked
                  ? 'text-orange-500 bg-orange-500/10'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
              aria-label={isCurrentWordBookmarked ? 'Remove bookmark' : 'Bookmark this position'}
              aria-pressed={isCurrentWordBookmarked}
              title={isCurrentWordBookmarked ? 'Remove bookmark (B)' : 'Bookmark this position (B)'}
            >
              <svg className="w-5 h-5" fill={isCurrentWordBookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile progress bar — shown on mobile only */}
        {words.length > 0 && (
          <div className="sm:hidden px-3 pb-1.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(((currentWordIndex + 1) / words.length) * 100)}%` }}
                />
              </div>
              <span className="text-zinc-500 text-xs tabular-nums flex-shrink-0" aria-live="polite">
                {Math.round(((currentWordIndex + 1) / words.length) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop */}
        <div
          className={`sm:hidden fixed inset-0 bg-black/50 z-20 transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={toggleSidebar}
        />

        {/* Sidebar — slide-over overlay on mobile, inline on desktop */}
        <div
          className={`
            h-full bg-zinc-900 border-r border-zinc-800 flex flex-col w-[280px]
            fixed sm:relative z-30 sm:z-auto top-0 left-0
            transition-transform duration-300 ease-in-out sm:transition-none
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            ${!sidebarOpen ? 'sm:hidden' : ''}
          `}
        >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
              <h2 className="text-zinc-200 text-sm font-medium truncate flex-1" title={documentTitle}>
                {documentTitle}
              </h2>
              <button
                onClick={toggleSidebar}
                className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded"
                aria-label="Close sidebar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Sidebar Tabs */}
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setActiveTab('bookmarks')}
                className={`flex-1 py-2 text-sm transition-colors ${
                  activeTab === 'bookmarks'
                    ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Bookmarks
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-2 text-sm transition-colors ${
                  activeTab === 'notes'
                    ? 'text-zinc-900 dark:text-white border-b-2 border-zinc-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Notes
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'bookmarks' && (
                bookmarks.length === 0 ? (
                  <div className="p-4 text-zinc-500 text-sm text-center">
                    No bookmarks yet.
                    <br />
                    Use the bookmark button to save your position.
                  </div>
                ) : (
                  <div className="p-2">
                    {bookmarks.map((bookmark) => (
                      <button
                        key={bookmark.id}
                        onClick={() => scrollToBookmark(bookmark)}
                        className="w-full text-left p-3 rounded-lg hover:bg-zinc-800 transition-colors mb-2"
                      >
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-300 text-sm line-clamp-2 mb-1">
                              &quot;{getBookmarkSnippet(bookmark.wordIndex)}&quot;
                            </p>
                            <p className="text-zinc-500 text-xs">
                              {getBookmarkPosition(bookmark.wordIndex)}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              )}
              {activeTab === 'notes' && (
                highlightsWithNotes.length === 0 ? (
                  <div className="p-4 text-zinc-500 text-sm text-center">
                    No notes yet.
                    <br />
                    Select text to add highlights and notes.
                  </div>
                ) : (
                  <div className="p-2">
                    {highlightsWithNotes.map((highlight) => (
                      <button
                        key={highlight.id}
                        onClick={() => scrollToHighlight(highlight)}
                        className="w-full text-left p-3 rounded-lg hover:bg-zinc-800 transition-colors mb-2"
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                            style={{ backgroundColor: HIGHLIGHT_COLORS[highlight.color].hex }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-300 text-sm line-clamp-2 mb-1">
                              &quot;{highlight.text.slice(0, 100)}{highlight.text.length > 100 ? '...' : ''}&quot;
                            </p>
                            <p className="text-zinc-500 text-xs line-clamp-2">
                              {highlight.note}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

        {/* Text Content Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-zinc-950">
          <div className="max-w-3xl mx-auto px-8 py-12">
            <div
              ref={textContainerRef}
              className="prose prose-invert prose-zinc max-w-none text-reader-content"
              style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
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
                      <p key={pIndex} className="text-zinc-300 text-base leading-relaxed mb-4">
                        {'\u00A0'}
                      </p>
                    );
                  }

                  const wordElements = paragraphWords.map((word, wIndex) => {
                    const currentIndex = globalWordIndex;
                    globalWordIndex++;

                    // Check if this word is part of a highlight
                    const highlight = getHighlightAtWord(currentIndex);
                    const bgStyle = highlight
                      ? { backgroundColor: HIGHLIGHT_COLORS[highlight.color].bg }
                      : undefined;

                    return (
                      <React.Fragment key={`${pIndex}-${wIndex}`}>
                        <span
                          data-word-index={currentIndex}
                          data-highlight-id={highlight?.id}
                          style={bgStyle}
                          className={highlight ? 'cursor-pointer rounded-sm' : undefined}
                          onClick={highlight ? handleHighlightClick : undefined}
                        >
                          {word}
                        </span>
                        {wIndex < paragraphWords.length - 1 && ' '}
                      </React.Fragment>
                    );
                  });

                  return (
                    <p key={pIndex} className="text-zinc-300 text-base leading-relaxed mb-4">
                      {wordElements}
                    </p>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Selection Popover */}
        {selection && (
          <SelectionPopover
            text={selection.text}
            page={0}
            anchorRect={selection.anchorRect}
            onCreateHighlight={handleCreateHighlight}
            onSpeedRead={handleSpeedReadSelection}
            onClose={handleCloseSelection}
          />
        )}

        {/* Highlight Popover */}
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
      </div>
    </div>
  );
}
