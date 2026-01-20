'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentMeta, HighlightColor, TextHighlight } from '@/types';
import { HIGHLIGHT_COLORS } from '@/types';
import { getDocument, getText, updateLastOpened, deleteDocumentComplete } from '@/lib/storage';
import { tokenize } from '@/lib/tokenize';
import { SelectionPopover, HighlightPopover } from '@/components/pdf/PDFHighlightPopover';
import { useTextHighlights } from '@/hooks/useTextHighlights';

interface TextReaderProps {
  documentId: string;
}

type SidebarTab = 'bookmarks' | 'notes';

export function TextReader({ documentId }: TextReaderProps) {
  const router = useRouter();
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('glyph:sidebar-open');
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [activeTab, setActiveTab] = useState<SidebarTab>('bookmarks');
  const [isBookmarked, setIsBookmarked] = useState(false);

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

  // Selection state
  const textContainerRef = useRef<HTMLDivElement>(null);
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
    // Placeholder - will be implemented in a later task
  }, []);

  const handleBookmarkToggle = useCallback(() => {
    // Placeholder - will be implemented in a later task
    setIsBookmarked(prev => !prev);
  }, []);

  // Keyboard shortcut for sidebar toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !textContainerRef.current) {
      return;
    }

    const range = sel.getRangeAt(0);
    const selectedText = sel.toString().trim();
    if (!selectedText) {
      return;
    }

    // Find start and end word indices from the selection
    const container = textContainerRef.current;

    // Get start word index
    let startNode = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) {
      startNode = startNode.parentElement as Node;
    }
    const startSpan = (startNode as Element).closest?.('[data-word-index]');

    // Get end word index
    let endNode = range.endContainer;
    if (endNode.nodeType === Node.TEXT_NODE) {
      endNode = endNode.parentElement as Node;
    }
    const endSpan = (endNode as Element).closest?.('[data-word-index]');

    if (!startSpan || !endSpan || !container.contains(startSpan) || !container.contains(endSpan)) {
      return;
    }

    const startWord = parseInt(startSpan.getAttribute('data-word-index') || '0', 10);
    const endWord = parseInt(endSpan.getAttribute('data-word-index') || '0', 10);

    // Normalize ordering
    const normalizedStart = Math.min(startWord, endWord);
    const normalizedEnd = Math.max(startWord, endWord);

    // Get anchor position for popover (center-top of selection)
    const rects = range.getClientRects();
    if (rects.length === 0) return;
    const firstRect = rects[0];
    const lastRect = rects[rects.length - 1];
    const anchorX = (firstRect.left + lastRect.right) / 2;
    const anchorY = firstRect.top;

    setSelection({
      startWord: normalizedStart,
      endWord: normalizedEnd,
      text: selectedText,
      anchorRect: { x: anchorX, y: anchorY },
    });
  }, []);

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

    handleCloseSelection();
  }, [selection, words, addHighlight, handleCloseSelection]);

  // Handle speed read from selection (placeholder)
  const handleSpeedReadSelection = useCallback(() => {
    // Will be implemented in a later task
    console.log('Speed read from:', selection);
    handleCloseSelection();
  }, [selection, handleCloseSelection]);

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
    }
  }, [activeHighlight, updateHighlightColor]);

  // Handle highlight note update
  const handleHighlightNoteUpdate = useCallback((note: string) => {
    if (activeHighlight) {
      updateHighlightNote(activeHighlight.highlight.id, note);
    }
  }, [activeHighlight, updateHighlightNote]);

  // Handle highlight delete
  const handleHighlightDelete = useCallback(() => {
    if (activeHighlight) {
      removeHighlight(activeHighlight.highlight.id);
      setActiveHighlight(null);
    }
  }, [activeHighlight, removeHighlight]);

  // Handle speed read from highlight (placeholder)
  const handleHighlightSpeedRead = useCallback(() => {
    // Will be implemented in a later task
    console.log('Speed read highlight:', activeHighlight?.highlight);
    handleCloseHighlightPopover();
  }, [activeHighlight, handleCloseHighlightPopover]);

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
        span.classList.add('ring-2', 'ring-red-500');
        setTimeout(() => {
          span.classList.remove('ring-2', 'ring-red-500');
        }, 1500);
      });
    }
  }, []);

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
          <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
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
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
        {/* Left: Sidebar toggle, Home button, and title */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={handleNavigateHome}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Back to library"
            title="Back to Library"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <span className="text-zinc-300 text-sm font-medium truncate max-w-[300px]" title={documentTitle}>
            {documentTitle}
          </span>
        </div>

        {/* Center: Position indicator placeholder */}
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          {/* Position indicator will be added in a later task */}
        </div>

        {/* Right: Speed Read, Bookmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSpeedRead}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
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
              isBookmarked
                ? 'text-red-500 bg-red-500/10'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this position'}
            aria-pressed={isBookmarked}
          >
            <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-[280px] h-full bg-zinc-900 border-r border-zinc-800 flex flex-col">
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
                    ? 'text-red-500 border-b-2 border-red-500'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Bookmarks
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-2 text-sm transition-colors ${
                  activeTab === 'notes'
                    ? 'text-red-500 border-b-2 border-red-500'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Notes
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'bookmarks' && (
                <div className="p-4 text-zinc-500 text-sm text-center">
                  No bookmarks yet.
                  <br />
                  Use the bookmark button to save your position.
                </div>
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
        )}

        {/* Text Content Area */}
        <div className="flex-1 overflow-auto bg-zinc-950">
          <div className="max-w-3xl mx-auto px-8 py-12">
            <div
              ref={textContainerRef}
              className="prose prose-invert prose-zinc max-w-none text-reader-content"
              onMouseUp={handleMouseUp}
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
