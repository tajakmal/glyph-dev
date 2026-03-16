'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useReaderContext } from '@/contexts/ReaderContext';

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
  } = useReaderContext();

  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [isHolding, setIsHolding] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // --- Playback ---

  const wordDelay = useCallback((word: string) => getWordDelay(word, wpm), [wpm]);

  useEffect(() => {
    if (isPlaying && words.length > 0 && currentWordIndex < words.length) {
      const delay = wordDelay(words[currentWordIndex]);
      intervalRef.current = setTimeout(() => {
        const nextIndex = currentWordIndex + 1;
        if (nextIndex >= words.length) {
          setIsPlaying(false);
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

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          setIsHolding(true);
          setIsPlaying(true);
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
        setIsPlaying(false);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        setIsPlaying(false);
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
        setIsPlaying(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentWordIndex, words.length, setCurrentWordIndex, setViewMode]);

  // --- Hold to play handlers ---

  const handleHoldStart = () => {
    setIsHolding(true);
    setIsPlaying(true);
  };

  const handleHoldEnd = () => {
    setIsHolding(false);
    setIsPlaying(false);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const reset = () => {
    setCurrentWordIndex(0);
    setIsPlaying(false);
  };

  // --- Navigation handlers ---

  const handleShowInDocument = () => {
    setIsPlaying(false);
    jumpToWordInPDF(currentWordIndex);
  };

  const handleBackToPDF = () => {
    setIsPlaying(false);
    // For PDFs: scroll to the correct page and highlight the word
    // For text: just switch view mode (TextReader handles its own scroll)
    if (documentKind === 'pdf') {
      jumpToWordInPDF(currentWordIndex);
    } else {
      setViewMode('pdf');
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

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

      {/* RSVP Display — scrollable content area above the mobile hold zone */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 sm:p-6 overflow-y-auto min-h-0 pb-0 sm:pb-6">
        {/* Word Display Container */}
        <div className="flex items-center justify-center py-4 sm:py-8 sm:flex-1 sm:min-h-[120px] shrink-0">
          <div className="w-full bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 sm:p-8 border border-zinc-800/50 shadow-2xl shadow-black/20">
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
        </div>

        {/* Scrubber */}
        <div className="mt-4 sm:mt-8">
          <input
            type="range"
            min="0"
            max={Math.max(0, words.length - 1)}
            value={currentWordIndex}
            onChange={(e) => setCurrentWordIndex(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer transition-all duration-300"
            style={{
              background: `linear-gradient(to right, #a1a1aa 0%, #a1a1aa ${progress}%, #27272a ${progress}%, #27272a 100%)`
            }}
            aria-label="Reading progress"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-2 font-light">
            <span className="tabular-nums">{currentWordIndex + 1} / {words.length.toLocaleString()} words</span>
            <span className="tabular-nums">{formatTime(timeRemaining)} remaining</span>
          </div>

          {/* Context preview */}
          <div className="mt-3 sm:mt-4 bg-zinc-900/30 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-zinc-800/30">
            <p className="text-xs sm:text-sm text-zinc-500 text-center leading-relaxed font-light">
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

        {/* Desktop Controls */}
        <div className="mt-4 sm:mt-8 space-y-4 shrink-0">
          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95"
              title="Reset (R)"
              aria-label="Reset to start"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>

            <button
              onClick={togglePlayPause}
              className={`p-5 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg ${
                isPlaying
                  ? 'bg-zinc-700 hover:bg-zinc-600 shadow-black/30'
                  : 'bg-white hover:bg-zinc-100 text-zinc-900 shadow-black/20'
              }`}
              title="Play/Pause"
              aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>

            {/* Show in Document (inline) */}
            {documentKind === 'pdf' && (
              <button
                onClick={handleShowInDocument}
                className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95"
                title="Show in Document"
                aria-label="Show current word in document"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </button>
            )}
          </div>

          {/* WPM Slider */}
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-800/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-500 text-sm font-light">Speed</span>
              <span className="text-zinc-400 font-mono font-semibold tabular-nums">{wpm} WPM</span>
            </div>
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

          {/* Desktop: Hold to Play + keyboard hints (hidden on mobile) */}
          <div className="hidden sm:block">
            <button
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onMouseLeave={handleHoldEnd}
              className={`w-full py-4 rounded-xl font-medium transition-all duration-200 select-none transform active:scale-[0.98] ${
                isHolding
                  ? 'bg-zinc-700 shadow-lg shadow-black/20'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50'
              }`}
              aria-label="Hold to play"
            >
              <span className={`transition-colors duration-200 ${isHolding ? 'text-white' : 'text-zinc-400'}`}>
                {isHolding ? 'Playing...' : 'Hold to Play'}
              </span>
            </button>

            <div className="flex justify-center gap-4 text-xs text-zinc-600 pt-3">
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">Space</kbd> hold to play</span>
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">←</kbd> <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">→</kbd> navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">Esc</kbd> back to doc</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Fixed bottom hold-to-play thumb zone */}
      <div className="sm:hidden flex-shrink-0 px-4 pb-[env(safe-area-inset-bottom,12px)] pt-2 border-t border-zinc-800/50 bg-zinc-950">
        <button
          onTouchStart={handleHoldStart}
          onTouchEnd={handleHoldEnd}
          onTouchCancel={handleHoldEnd}
          className={`w-full py-6 rounded-2xl font-medium transition-all duration-150 select-none touch-none ${
            isHolding
              ? 'bg-orange-500/20 border-2 border-orange-400/50 shadow-lg shadow-orange-500/10'
              : 'bg-zinc-800/80 border-2 border-zinc-700/50 active:bg-zinc-700'
          }`}
          aria-label="Hold to play"
        >
          <div className="flex flex-col items-center gap-1">
            {isHolding ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
                <span className="text-orange-400 text-sm font-medium">Release to pause</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span className="text-zinc-400 text-sm">Hold to read</span>
              </>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
