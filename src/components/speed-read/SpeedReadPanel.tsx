'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useReaderContext } from '@/contexts/ReaderContext';
import { useTextBookmarks } from '@/hooks/useTextBookmarks';

// =============================================================================
// ORP Calculation (shared with SpritzReader)
// =============================================================================

function getORP(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return Math.floor(len / 2) - 1;
  if (len <= 9) return Math.floor(len / 2);
  return Math.floor(len / 2) + 1;
}

function getWordDelay(word: string, wpm: number): number {
  const baseDelay = 60000 / wpm;
  let multiplier = 1;

  if (/[.!?]$/.test(word)) multiplier = 2.5;
  else if (/[,;:]$/.test(word)) multiplier = 1.5;

  if (word.length > 8) multiplier *= 1.2;

  return baseDelay * multiplier;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

const WPM_PRESETS = [200, 300, 400, 500, 600];
const HOLD_THRESHOLD = 200;
const DOUBLE_TAP_WINDOW = 300;

// =============================================================================
// SpeedReadPanel Component
// =============================================================================

export function SpeedReadPanel() {
  const router = useRouter();
  const {
    words,
    currentWordIndex,
    setCurrentWordIndex,
    isTextReady,
    documentMeta,
    jumpToWordInPDF,
    setViewMode,
    documentKind,
    documentId,
  } = useReaderContext();

  // Bookmarks
  const {
    addBookmark,
    isWordBookmarked,
    toggleBookmark,
  } = useTextBookmarks({ documentId });

  const isCurrentWordBookmarked = useMemo(
    () => isWordBookmarked(currentWordIndex),
    [isWordBookmarked, currentWordIndex]
  );

  const handleBookmarkToggle = useCallback(() => {
    if (isCurrentWordBookmarked) {
      toggleBookmark(currentWordIndex);
    } else {
      const word = words[currentWordIndex] || '';
      const label = word + '...';
      addBookmark(currentWordIndex, label);
    }
  }, [isCurrentWordBookmarked, toggleBookmark, addBookmark, currentWordIndex, words]);

  const [wpm, setWpm] = useState(300);
  const [isHolding, setIsHolding] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const isPlaying = isHolding || isAutoPlaying;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Dual-purpose button refs
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tapCountRef = useRef(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPressedRef = useRef(false);
  const isHoldRef = useRef(false);

  // --- Playback ---

  const wordDelay = useCallback((word: string) => getWordDelay(word, wpm), [wpm]);

  useEffect(() => {
    if (isPlaying && words.length > 0 && currentWordIndex < words.length) {
      const delay = wordDelay(words[currentWordIndex]);
      intervalRef.current = setTimeout(() => {
        const nextIndex = currentWordIndex + 1;
        if (nextIndex >= words.length) {
          setIsAutoPlaying(false);
          setIsHolding(false);
        } else {
          setCurrentWordIndex(nextIndex);
        }
      }, delay);
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isPlaying, currentWordIndex, words, wordDelay, setCurrentWordIndex]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          setIsAutoPlaying(false);
          setIsHolding(true);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentWordIndex(Math.max(0, currentWordIndex - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentWordIndex(Math.min(words.length - 1, currentWordIndex + 1));
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        setCurrentWordIndex(0);
        setIsAutoPlaying(false);
        setIsHolding(false);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        setIsAutoPlaying(false);
        setIsHolding(false);
        if (documentKind === 'pdf') {
          jumpToWordInPDF(currentWordIndex);
        } else {
          setViewMode('pdf');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsHolding(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentWordIndex, words.length, setCurrentWordIndex, setViewMode, jumpToWordInPDF, documentKind]);

  // --- Dual-purpose press handlers (hold + double-tap) ---

  const handlePressStart = useCallback(() => {
    isPressedRef.current = true;
    isHoldRef.current = false;

    holdTimerRef.current = setTimeout(() => {
      if (isPressedRef.current) {
        isHoldRef.current = true;
        setIsAutoPlaying(false);
        setIsHolding(true);
      }
    }, HOLD_THRESHOLD);
  }, []);

  const handlePressEnd = useCallback(() => {
    isPressedRef.current = false;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isHoldRef.current) {
      isHoldRef.current = false;
      setIsHolding(false);
      return;
    }

    // Was a tap (released before HOLD_THRESHOLD)
    // If auto-playing, single tap pauses immediately
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      tapCountRef.current = 0;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      return;
    }

    // Not auto-playing: detect double-tap to start auto-play
    tapCountRef.current += 1;

    if (tapCountRef.current === 1) {
      tapTimerRef.current = setTimeout(() => {
        // Single tap — do nothing
        tapCountRef.current = 0;
      }, DOUBLE_TAP_WINDOW);
    } else if (tapCountRef.current >= 2) {
      // Double tap — start auto-play
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      tapCountRef.current = 0;
      setIsAutoPlaying(true);
    }
  }, []);

  const handlePressCancel = useCallback(() => {
    isPressedRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldRef.current) {
      isHoldRef.current = false;
      setIsHolding(false);
    }
  }, []);

  // --- Navigation handlers ---

  const handleShowInDocument = () => {
    setIsAutoPlaying(false);
    setIsHolding(false);
    jumpToWordInPDF(currentWordIndex);
  };

  const handleBackToPDF = () => {
    setIsAutoPlaying(false);
    setIsHolding(false);
    if (documentKind === 'pdf') {
      jumpToWordInPDF(currentWordIndex);
    } else {
      setViewMode('pdf');
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

  // --- Hold button label/state ---

  const holdButtonLabel = isHolding
    ? 'Release to pause'
    : isAutoPlaying
      ? 'Tap to pause'
      : 'Hold to read';

  const holdButtonActive = isHolding || isAutoPlaying;

  // --- Render ---

  if (!isTextReady || words.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
          <p className="text-zinc-400">Preparing text...</p>
        </div>
      </div>
    );
  }

  const currentWord = words[currentWordIndex] || '';
  const orp = getORP(currentWord);
  const beforeORP = currentWord.slice(0, orp);
  const orpLetter = currentWord[orp] || '';
  const afterORP = currentWord.slice(orp + 1);

  const progress = words.length > 0 ? ((currentWordIndex + 1) / words.length) * 100 : 0;
  const timeRemaining = words.length > 0
    ? Math.ceil((words.length - currentWordIndex - 1) * (60 / wpm))
    : 0;

  return (
    <div ref={panelRef} className="h-full flex flex-col bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {/* Home button */}
          <button
            onClick={handleGoHome}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Back to Library"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          {/* Back to document button */}
          <button
            onClick={handleBackToPDF}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm hidden sm:inline">Back to Reader</span>
          </button>

          {documentMeta && (
            <span className="text-zinc-500 text-sm truncate max-w-[150px] sm:max-w-[300px]">
              {documentMeta.title}
            </span>
          )}
        </div>

        {/* Show in Document button */}
        {documentKind === 'pdf' && (
          <button
            onClick={handleShowInDocument}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Show current word in document"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">Show in Document</span>
          </button>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pt-3 pb-6 sm:px-6 sm:pt-4 sm:pb-3 overflow-y-auto min-h-0">

        {/* Speed Control — locked at top */}
        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-zinc-800/50 shrink-0 mb-2 sm:mb-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Speed</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-mono font-bold text-zinc-100 tabular-nums">{wpm}</span>
              <span className="text-sm text-zinc-500 font-light">WPM</span>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex justify-center gap-2 mb-2">
            {WPM_PRESETS.map(preset => (
              <button
                key={preset}
                onClick={() => setWpm(preset)}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono font-medium transition-all duration-150 ${
                  wpm === preset
                    ? 'bg-orange-400/20 text-orange-400 border border-orange-400/30'
                    : 'bg-zinc-800/80 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 border border-transparent'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Fine-tune slider */}
          <input
            type="range"
            min="100"
            max="800"
            step="25"
            value={wpm}
            onChange={(e) => setWpm(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-zinc-400"
            aria-label="Words per minute speed"
          />
          <div className="flex justify-between text-xs text-zinc-600 mt-2">
            <span>100</span>
            <span>800</span>
          </div>
        </div>

        {/* Word Display Card + Context */}
        <div className="flex flex-col items-center justify-center mt-3 sm:mt-0 sm:flex-1 sm:min-h-0 shrink-0">
          <div className="w-full bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 sm:p-8 border border-orange-400/30 shadow-2xl shadow-black/20">
            <div className="relative">
              <div className="absolute left-1/2 -translate-x-1/2 -top-3 w-0.5 h-3 bg-gradient-to-b from-orange-400 to-transparent rounded-full"></div>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-0.5 h-3 bg-gradient-to-t from-orange-400 to-transparent rounded-full"></div>

              <div className="h-16 sm:h-24 flex items-center justify-center font-mono text-3xl sm:text-5xl relative">
                <div className="absolute left-1/2 -translate-x-1/2 h-full w-px bg-gradient-to-b from-transparent via-zinc-800 to-transparent"></div>

                <div className="flex items-baseline">
                  <span
                    className="text-zinc-500 text-right transition-all duration-75"
                    style={{ minWidth: '100px', display: 'flex', justifyContent: 'flex-end' }}
                  >
                    {beforeORP}
                  </span>
                  <span
                    className="text-orange-400 font-bold w-6 sm:w-8 text-center transition-all duration-75"
                    style={{
                      textShadow: isPlaying
                        ? '0 0 20px rgba(251, 146, 60, 0.5), 0 0 40px rgba(251, 146, 60, 0.3)'
                        : '0 0 10px rgba(251, 146, 60, 0.3)'
                    }}
                  >
                    {orpLetter}
                  </span>
                  <span
                    className="text-zinc-500 text-left transition-all duration-75"
                    style={{ minWidth: '100px' }}
                  >
                    {afterORP}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Context preview — directly under word card */}
          <div className="w-full mt-2 sm:mt-3 bg-zinc-900/30 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-zinc-800/30">
            <p className="text-xs sm:text-sm text-zinc-500 text-center leading-relaxed font-light h-[3.25em] overflow-hidden">
              <span className="text-zinc-700 transition-colors duration-150">
                {words.slice(Math.max(0, currentWordIndex - 5), currentWordIndex).join(' ')}
              </span>
              {currentWordIndex > 0 && ' '}
              <span className="text-orange-400/90 font-normal">{words[currentWordIndex]}</span>
              {currentWordIndex < words.length - 1 && ' '}
              <span className="text-zinc-700 transition-colors duration-150">
                {words.slice(currentWordIndex + 1, currentWordIndex + 6).join(' ')}
              </span>
            </p>
          </div>
        </div>

        {/* Scrubber */}
        <div className="shrink-0">
          <input
            type="range"
            min="0"
            max={Math.max(0, words.length - 1)}
            value={currentWordIndex}
            onChange={(e) => setCurrentWordIndex(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer transition-all duration-300 accent-orange-400"
            style={{
              background: `linear-gradient(to right, #fb923c 0%, #fb923c ${progress}%, #27272a ${progress}%, #27272a 100%)`
            }}
            aria-label="Reading progress"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1.5 font-light">
            <span className="tabular-nums">{currentWordIndex + 1} / {words.length.toLocaleString()} words</span>
            <span className="tabular-nums">{formatTime(timeRemaining)} remaining</span>
          </div>
        </div>

        {/* Navigation Controls: < bookmark > */}
        <div className="mt-2 sm:mt-4 space-y-2 sm:space-y-3 shrink-0">
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            {/* Previous word */}
            <button
              onClick={() => setCurrentWordIndex(Math.max(0, currentWordIndex - 1))}
              className="p-2.5 sm:p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95"
              title="Previous word (←)"
              aria-label="Previous word"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Bookmark button */}
            <button
              onClick={handleBookmarkToggle}
              className={`p-2.5 sm:p-3 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                isCurrentWordBookmarked
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400'
              }`}
              title={isCurrentWordBookmarked ? 'Remove bookmark' : 'Bookmark this word'}
              aria-label={isCurrentWordBookmarked ? 'Remove bookmark' : 'Bookmark this word'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill={isCurrentWordBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>

            {/* Next word */}
            <button
              onClick={() => setCurrentWordIndex(Math.min(words.length - 1, currentWordIndex + 1))}
              className="p-2.5 sm:p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95"
              title="Next word (→)"
              aria-label="Next word"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Mobile: Hold to Read (inline, flows with content) */}
          <div className="sm:hidden">
            <button
              onTouchStart={handlePressStart}
              onTouchEnd={handlePressEnd}
              onTouchCancel={handlePressCancel}
              className={`w-full py-3 rounded-2xl font-medium transition-all duration-150 select-none touch-none ${
                isHolding
                  ? 'bg-orange-500/20 border-2 border-orange-400/50 shadow-lg shadow-orange-500/10'
                  : isAutoPlaying
                    ? 'bg-orange-500/10 border-2 border-orange-400/30 ring-2 ring-orange-400/20'
                    : 'bg-zinc-800/80 border-2 border-zinc-700/50 active:bg-zinc-700'
              }`}
              aria-label="Hold to play or double-tap to toggle"
            >
              <div className="flex flex-col items-center gap-1">
                {holdButtonActive ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1"/>
                      <rect x="14" y="4" width="4" height="16" rx="1"/>
                    </svg>
                    <span className="text-orange-400 text-sm font-medium">{holdButtonLabel}</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    <span className="text-zinc-400 text-sm">{holdButtonLabel}</span>
                    <span className="text-zinc-600 text-xs">Double-tap to auto-play</span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Desktop: Hold to Read + keyboard hints (hidden on mobile) */}
          <div className="hidden sm:block">
            <button
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressCancel}
              className={`w-full py-4 rounded-xl font-medium transition-all duration-200 select-none transform active:scale-[0.98] ${
                isHolding
                  ? 'bg-orange-500/20 border border-orange-400/50 shadow-lg shadow-orange-500/10'
                  : isAutoPlaying
                    ? 'bg-orange-500/10 border border-orange-400/30 ring-2 ring-orange-400/20'
                    : 'bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50'
              }`}
              aria-label="Hold to play or double-tap to toggle"
            >
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-2">
                  {holdButtonActive ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1"/>
                      <rect x="14" y="4" width="4" height="16" rx="1"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  )}
                  <span className={`transition-colors duration-200 ${holdButtonActive ? 'text-orange-400' : 'text-zinc-400'}`}>
                    {holdButtonLabel}
                  </span>
                </div>
                {!holdButtonActive && (
                  <span className="text-zinc-600 text-xs">Double-click to auto-play</span>
                )}
              </div>
            </button>

            <div className="flex justify-center gap-4 text-xs text-zinc-600 pt-3">
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">Space</kbd> hold to play</span>
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">←</kbd> <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">→</kbd> navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">Esc</kbd> back to doc</span>
            </div>
          </div>
        </div>

      </div>

      {/* Mobile: Safe area bottom padding */}
      <div className="sm:hidden pb-[env(safe-area-inset-bottom,16px)]"></div>
    </div>
  );
}
