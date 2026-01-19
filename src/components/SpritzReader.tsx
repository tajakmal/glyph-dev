"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SpritzReaderProps {
  /** Initial text to speed read (optional) */
  initialText?: string;
}

export function SpritzReader({ initialText }: SpritzReaderProps) {
  const [text, setText] = useState(initialText || '');
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [hasStarted, setHasStarted] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate the Optimal Recognition Point (ORP)
  const getORP = (word: string): number => {
    const len = word.length;
    if (len <= 1) return 0;
    if (len <= 5) return Math.floor(len / 2) - 1;
    if (len <= 9) return Math.floor(len / 2);
    return Math.floor(len / 2) + 1;
  };

  const parseText = (inputText: string) => {
    const parsed = inputText
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    setWords(parsed);
    setCurrentIndex(0);
    setHasStarted(false);
    setIsPlaying(false);
  };

  const handleGo = () => {
    if (text.trim()) {
      parseText(text);
      setHasStarted(true);
    }
  };

  const togglePlayPause = useCallback(() => {
    if (!hasStarted && text.trim()) {
      parseText(text);
      setHasStarted(true);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  }, [hasStarted, text, isPlaying]);

  const reset = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setHasStarted(false);
  };

  const handleHoldStart = () => {
    setIsHolding(true);
    setIsPlaying(true);
  };

  const handleHoldEnd = () => {
    setIsHolding(false);
    setIsPlaying(false);
  };

  // Auto-start if initialText is provided
  useEffect(() => {
    if (initialText && initialText.trim()) {
      parseText(initialText);
      setHasStarted(true);
    }
  }, [initialText]);

  // Extract text from PDF
  const extractPdfText = async (file: File): Promise<string> => {
    const pdfjsLib = await import('pdfjs-dist');

    // Disable worker to avoid CDN/CORS issues
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += pageText + ' ';
    }

    return fullText;
  };

  // Extract text from EPUB
  const extractEpubText = async (file: File): Promise<string> => {
    const ePub = (await import('epubjs')).default;

    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const spine = book.spine as unknown as { each: (callback: (section: { load: (book: unknown) => Promise<unknown>; document: Document }) => void) => void };

    let fullText = '';

    await new Promise<void>((resolve) => {
      const sections: Promise<void>[] = [];

      spine.each((section) => {
        sections.push(
          section.load(book.load.bind(book)).then(() => {
            const doc = section.document;
            if (doc && doc.body) {
              fullText += doc.body.textContent + ' ';
            }
          })
        );
      });

      Promise.all(sections).then(() => resolve());
    });

    return fullText;
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);

    try {
      let extractedText = '';

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        extractedText = await extractPdfText(file);
      } else if (file.type === 'application/epub+zip' || file.name.endsWith('.epub')) {
        extractedText = await extractEpubText(file);
      } else {
        // Treat as plain text
        extractedText = await file.text();
      }

      // Clean up the text
      extractedText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .trim();

      setText(extractedText);
    } catch (error) {
      console.error('Error extracting text:', error);
      alert('Failed to extract text from file. Please try another file.');
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasStarted) return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        // Only trigger on initial press, not on key repeat
        if (!e.repeat) {
          setIsHolding(true);
          setIsPlaying(true);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex(prev => Math.max(0, prev - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex(prev => Math.min(words.length - 1, prev + 1));
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        reset();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!hasStarted) return;
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
  }, [hasStarted, words.length]);

  const getWordDelay = useCallback((word: string): number => {
    const baseDelay = 60000 / wpm;
    let multiplier = 1;

    if (/[.!?]$/.test(word)) multiplier = 2.5;
    else if (/[,;:]$/.test(word)) multiplier = 1.5;

    if (word.length > 8) multiplier *= 1.2;

    return baseDelay * multiplier;
  }, [wpm]);

  useEffect(() => {
    if (isPlaying && words.length > 0 && currentIndex < words.length) {
      const delay = getWordDelay(words[currentIndex]);
      intervalRef.current = setTimeout(() => {
        setCurrentIndex(prev => {
          if (prev >= words.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isPlaying, currentIndex, words, getWordDelay]);

  const currentWord = words[currentIndex] || '';
  const orp = getORP(currentWord);

  const beforeORP = currentWord.slice(0, orp);
  const orpLetter = currentWord[orp] || '';
  const afterORP = currentWord.slice(orp + 1);

  const progress = words.length > 0 ? ((currentIndex + 1) / words.length) * 100 : 0;
  const timeRemaining = words.length > 0
    ? Math.ceil((words.length - currentIndex - 1) * (60 / wpm))
    : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 text-zinc-100 p-6 flex flex-col">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extralight tracking-widest text-zinc-200 uppercase">
          Glyph
        </h1>
        <p className="text-zinc-600 text-xs mt-2 tracking-wider">Speed reading, one word at a time</p>
      </div>

      {/* Input Area */}
      <div className={`flex-1 max-w-2xl mx-auto w-full mb-6 transition-all duration-500 ${hasStarted ? 'opacity-0 absolute pointer-events-none' : 'opacity-100'}`}>

        {/* Input Mode Toggle */}
        <div className="flex mb-4 bg-zinc-900/50 rounded-xl p-1 border border-zinc-800/50">
          <button
            onClick={() => setInputMode('text')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
              inputMode === 'text'
                ? 'bg-zinc-800 text-zinc-200'
                : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            Paste Text
          </button>
          <button
            onClick={() => setInputMode('file')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
              inputMode === 'file'
                ? 'bg-zinc-800 text-zinc-200'
                : 'text-zinc-500 hover:text-zinc-400'
            }`}
          >
            Upload File
          </button>
        </div>

        {/* Text Input */}
        {inputMode === 'text' && (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here..."
            className="w-full h-64 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-5 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700/50 resize-none font-light transition-all duration-300"
          />
        )}

        {/* File Upload */}
        {inputMode === 'file' && (
          <div className="h-64 flex flex-col">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.epub,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-1 bg-zinc-900/50 backdrop-blur-sm border-2 border-dashed border-zinc-800/50 rounded-2xl p-5 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 transition-all duration-300 flex flex-col items-center justify-center gap-4"
            >
              {isLoading ? (
                <>
                  <svg className="w-12 h-12 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="text-sm">Extracting text...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  <div className="text-center">
                    <span className="text-sm">Click to upload or drag & drop</span>
                    <p className="text-xs text-zinc-600 mt-1">PDF, EPUB, or TXT</p>
                  </div>
                </>
              )}
            </button>

            {fileName && (
              <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900/30 rounded-lg px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="truncate flex-1">{fileName}</span>
                {text && (
                  <span className="text-zinc-600 text-xs">
                    {text.split(/\s+/).length.toLocaleString()} words
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Word count for text input */}
        {inputMode === 'text' && text && (
          <div className="mt-2 text-xs text-zinc-600 text-right">
            {text.trim().split(/\s+/).filter(w => w.length > 0).length.toLocaleString()} words
          </div>
        )}

        <button
          onClick={handleGo}
          disabled={!text.trim() || isLoading}
          className="mt-4 w-full py-3.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 rounded-xl font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 shadow-lg shadow-red-900/20 disabled:shadow-none"
        >
          Ready
        </button>
      </div>

      {/* Spritz Display */}
      <div className={`flex-1 flex flex-col max-w-2xl mx-auto w-full transition-all duration-500 ${hasStarted ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`}>
        {/* Word Display Container */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-8 border border-zinc-800/50 shadow-2xl shadow-black/20">
            <div className="relative">
              <div className="absolute left-1/2 -translate-x-1/2 -top-3 w-0.5 h-3 bg-gradient-to-b from-red-500 to-transparent rounded-full"></div>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-0.5 h-3 bg-gradient-to-t from-red-500 to-transparent rounded-full"></div>

              <div className="h-24 flex items-center justify-center font-mono text-5xl relative">
                <div className="absolute left-1/2 -translate-x-1/2 h-full w-px bg-gradient-to-b from-transparent via-zinc-800 to-transparent"></div>

                <div className="flex items-baseline">
                  <span
                    className="text-zinc-500 text-right transition-all duration-75"
                    style={{ minWidth: '140px', display: 'flex', justifyContent: 'flex-end' }}
                  >
                    {beforeORP}
                  </span>
                  <span
                    className="text-red-500 font-bold w-8 text-center transition-all duration-75"
                    style={{
                      textShadow: isPlaying ? '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.3)' : '0 0 10px rgba(239, 68, 68, 0.3)'
                    }}
                  >
                    {orpLetter}
                  </span>
                  <span
                    className="text-zinc-500 text-left transition-all duration-75"
                    style={{ minWidth: '140px' }}
                  >
                    {afterORP}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrubber */}
        <div className="mt-8">
          <input
            type="range"
            min="0"
            max={Math.max(0, words.length - 1)}
            value={currentIndex}
            onChange={(e) => {
              setCurrentIndex(Number(e.target.value));
            }}
            className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer transition-all duration-300"
            style={{
              background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${progress}%, #27272a ${progress}%, #27272a 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-2 font-light">
            <span className="tabular-nums">{currentIndex + 1} / {words.length.toLocaleString()} words</span>
            <span className="tabular-nums">{formatTime(timeRemaining)} remaining</span>
          </div>

          {/* Context preview */}
          <div className="mt-4 bg-zinc-900/30 backdrop-blur-sm rounded-xl p-4 border border-zinc-800/30">
            <p className="text-sm text-zinc-500 text-center leading-relaxed font-light">
              <span className="text-zinc-700 transition-colors duration-150">
                {words.slice(Math.max(0, currentIndex - 5), currentIndex).join(' ')}
              </span>
              {currentIndex > 0 && ' '}
              <span className="text-red-400/90 font-normal">{words[currentIndex]}</span>
              {currentIndex < words.length - 1 && ' '}
              <span className="text-zinc-700 transition-colors duration-150">
                {words.slice(currentIndex + 1, currentIndex + 6).join(' ')}
              </span>
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 space-y-4">
          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95"
              title="Reset (R)"
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
                  : 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 shadow-red-900/30'
              }`}
              title="Play/Pause"
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

            <button
              onClick={() => {
                setHasStarted(false);
                setIsPlaying(false);
                setCurrentIndex(0);
              }}
              className="p-3 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95"
              title="New Text"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </button>
          </div>

          {/* WPM Slider */}
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-800/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-500 text-sm font-light">Speed</span>
              <span className="text-red-400 font-mono font-semibold tabular-nums">{wpm} WPM</span>
            </div>
            <input
              type="range"
              min="100"
              max="800"
              step="25"
              value={wpm}
              onChange={(e) => setWpm(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-2">
              <span>100</span>
              <span>800</span>
            </div>
          </div>

          {/* Hold to Play Button */}
          <button
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            className={`w-full py-4 rounded-xl font-medium transition-all duration-200 select-none touch-none transform active:scale-[0.98] ${
              isHolding
                ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-lg shadow-red-900/30'
                : 'bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50'
            }`}
          >
            <span className={`transition-colors duration-200 ${isHolding ? 'text-white' : 'text-zinc-400'}`}>
              {isHolding ? 'Playing...' : 'Hold to Play'}
            </span>
          </button>

          {/* Keyboard hints */}
          <div className="flex justify-center gap-4 text-xs text-zinc-600 pt-2">
            <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">Space</kbd> hold to play</span>
            <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">←</kbd> <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">→</kbd> navigate</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Default export for backwards compatibility
export default SpritzReader;
