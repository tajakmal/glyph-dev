'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useReaderContext } from '@/contexts/ReaderContext';
import { useTextBookmarks } from '@/hooks/useTextBookmarks';
import {
  useSpeedReader,
  formatRemaining,
} from '@/hooks/useSpeedReader';
import { getPreferences } from '@/lib/storage';
import { ORPWord } from './ORPWord';
import { ContextStrip } from './ContextStrip';
import { DocMiniMap } from './DocMiniMap';

const HOLD_THRESHOLD = 200; // ms
const DOUBLE_TAP_WINDOW = 300; // ms
const MIN_SESSION_WORDS = 50;
const MIN_SESSION_MS = 5_000;

export function SpeedReadPanel() {
  const router = useRouter();
  const {
    words,
    currentWordIndex,
    setCurrentWordIndex,
    isTextReady,
    documentMeta,
    documentKind,
    documentId,
    jumpToWordInPDF,
    setViewMode,
    speedReadWpm,
    setSpeedReadWpm,
  } = useReaderContext();

  const {
    addBookmark,
    isWordBookmarked,
    toggleBookmark,
  } = useTextBookmarks({ documentId });

  type ReadMode = 'single' | 'ghost';
  // Read preferences once on mount so Settings defaults propagate to new sessions
  const [readMode, setReadMode] = useState<ReadMode>(
    () => getPreferences().speedReadMode
  );
  const [expressive, setExpressive] = useState(
    () => getPreferences().expressivePacing
  );
  const [autoPauseOnInterrupt] = useState(
    () => getPreferences().autoPauseOnInterrupt
  );
  const [showScrub, setShowScrub] = useState(false);

  const engine = useSpeedReader({
    words,
    wpm: speedReadWpm,
    expressive,
    index: currentWordIndex,
    onIndexChange: setCurrentWordIndex,
  });

  // Session tracking for the Return screen. The ref is seeded in a mount
  // effect so Date.now() isn't called during render (React 19 purity rule).
  const sessionStartIndexRef = useRef(currentWordIndex);
  const sessionStartedAtRef = useRef<number | null>(null);
  useEffect(() => {
    sessionStartedAtRef.current = Date.now();
  }, []);
  const lastActionRef = useRef<'none' | 'close' | 'end'>('none');

  const isBookmarked = useMemo(
    () => isWordBookmarked(currentWordIndex),
    [isWordBookmarked, currentWordIndex]
  );

  const handleBookmarkToggle = useCallback(() => {
    if (isBookmarked) {
      toggleBookmark(currentWordIndex);
    } else {
      const word = words[currentWordIndex] || '';
      addBookmark(currentWordIndex, word + '...');
    }
  }, [isBookmarked, toggleBookmark, currentWordIndex, words, addBookmark]);

  // Hand off to the Return screen if the session was substantive.
  const emitSessionReceipt = useCallback(
    (reason: 'close' | 'end'): boolean => {
      const endIndex = engine.index;
      const startIndex = sessionStartIndexRef.current;
      const wordsRead = Math.max(0, endIndex - startIndex);
      const startedAt = sessionStartedAtRef.current ?? Date.now();
      const duration = Date.now() - startedAt;
      if (wordsRead < MIN_SESSION_WORDS || duration < MIN_SESSION_MS) {
        return false;
      }
      const avgWpm = duration > 0 ? Math.round((wordsRead / duration) * 60_000) : speedReadWpm;
      try {
        sessionStorage.setItem(
          'glyph:speedread-session-receipt',
          JSON.stringify({
            documentId,
            startIndex,
            endIndex,
            startedAt,
            endedAt: Date.now(),
            avgWpm,
            wpm: speedReadWpm,
            mode: readMode,
            reason,
          })
        );
      } catch {
        return false;
      }
      return true;
    },
    [engine.index, documentId, speedReadWpm, readMode]
  );

  const exitToReader = useCallback(() => {
    engine.pause();
    lastActionRef.current = 'close';
    const showReceipt = emitSessionReceipt('close');
    if (showReceipt) {
      router.push(`/reader/${documentId}/return`);
      return;
    }
    if (documentKind === 'pdf') {
      jumpToWordInPDF(currentWordIndex);
    } else {
      setViewMode('pdf');
    }
  }, [
    engine,
    emitSessionReceipt,
    router,
    documentId,
    documentKind,
    jumpToWordInPDF,
    currentWordIndex,
    setViewMode,
  ]);

  // End of document → receipt
  useEffect(() => {
    if (!engine.playing && engine.index >= words.length - 1 && words.length > 0 && lastActionRef.current === 'none') {
      lastActionRef.current = 'end';
      const showReceipt = emitSessionReceipt('end');
      if (showReceipt) {
        router.push(`/reader/${documentId}/return`);
      }
    }
  }, [engine.playing, engine.index, words.length, emitSessionReceipt, router, documentId]);

  // Dual-press: hold for temporary play, double-tap for autoplay toggle
  const isPressedRef = useRef(false);
  const isHoldRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = useCallback(() => {
    isPressedRef.current = true;
    isHoldRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      if (isPressedRef.current) {
        isHoldRef.current = true;
        engine.play();
      }
    }, HOLD_THRESHOLD);
  }, [engine]);

  const endPress = useCallback(() => {
    isPressedRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldRef.current) {
      isHoldRef.current = false;
      engine.pause();
      return;
    }
    // Tap: toggle play/pause with debounce to detect double-tap → ensure autoplay
    if (engine.playing) {
      engine.pause();
      return;
    }
    tapCountRef.current += 1;
    if (tapCountRef.current === 1) {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, DOUBLE_TAP_WINDOW);
    } else {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapCountRef.current = 0;
      engine.play();
    }
  }, [engine]);

  const cancelPress = useCallback(() => {
    isPressedRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldRef.current) {
      isHoldRef.current = false;
      engine.pause();
    }
  }, [engine]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  // Auto-pause when the tab loses focus (respects user preference)
  useEffect(() => {
    if (!autoPauseOnInterrupt) return;
    const handleVisibility = () => {
      if (document.hidden) engine.pause();
    };
    const handleBlur = () => engine.pause();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [engine, autoPauseOnInterrupt]);

  // Keyboard shortcuts: Space hold, arrows, R reset, Esc close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) engine.play();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        engine.step(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        engine.step(1);
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        engine.reset();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        exitToReader();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        engine.pause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [engine, exitToReader]);

  // Loading state
  if (!isTextReady || words.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          background: 'var(--bg)',
          color: 'var(--ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          className="spinner"
          style={{
            width: 28,
            height: 28,
            border: '2px solid var(--rule-strong)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
          }}
        />
        <div className="micro-label">Preparing text…</div>
      </div>
    );
  }

  const focal = engine.focalToken;
  const prev = engine.prevToken;
  const next = engine.nextToken;
  const pct = Math.round(engine.progress * 100);
  const remaining = Math.max(0, words.length - engine.index - 1);
  const timeLeft = formatRemaining(remaining, speedReadWpm);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg)',
        color: 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top bar */}
      <div style={{ padding: 'max(env(safe-area-inset-top), 20px) 20px 0' }}>
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={exitToReader}
            className="micro-label"
            aria-label="Close speed-read"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: 0,
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M8 2L3 6l5 4"
                stroke="var(--ink)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            close
          </button>
          <div
            className="micro-label"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: engine.playing ? 'var(--accent)' : 'var(--muted)',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: engine.playing ? 'var(--accent)' : 'var(--muted)',
                animation: engine.playing ? 'pulse 1s infinite' : 'none',
              }}
            />
            {engine.playing ? 'reading' : 'paused'}
          </div>
          <div className="micro-label">{speedReadWpm} wpm</div>
        </div>

        {/* Title + position */}
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={documentMeta?.title}
            >
              {documentMeta?.title ?? 'Untitled'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {documentMeta?.kind === 'pdf'
                ? `${documentMeta?.pageCount ?? 0} pages`
                : `${words.length.toLocaleString()} words`}
            </div>
          </div>
          <div
            className="micro-label"
            style={{ letterSpacing: '0.1em', whiteSpace: 'nowrap' }}
          >
            {pct}% · {timeLeft}
          </div>
        </div>

        {/* Minimap */}
        <div style={{ marginTop: 16 }}>
          <DocMiniMap
            index={engine.index}
            total={words.length}
            height={2}
          />
        </div>
      </div>

      {/* Word display area */}
      <div
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerCancel={cancelPress}
        onPointerLeave={() => {
          if (isPressedRef.current) cancelPress();
        }}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '0 20px',
          touchAction: 'manipulation',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {/* Crosshair ticks */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              top: -36,
              transform: 'translateX(-50%)',
              width: 1,
              height: 20,
              background: 'var(--accent)',
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              bottom: -36,
              transform: 'translateX(-50%)',
              width: 1,
              height: 20,
              background: 'var(--accent)',
            }}
          />
          <div
            style={{
              minHeight: 76,
              display: 'flex',
              alignItems: 'baseline',
              gap: 18,
              justifyContent: 'center',
            }}
            aria-live="polite"
            aria-atomic="true"
          >
            {readMode === 'ghost' && prev && (
              <span
                aria-hidden="true"
                style={{
                  fontSize: 26,
                  fontWeight: 400,
                  color: 'var(--ink)',
                  opacity: 0.22,
                  letterSpacing: '-0.01em',
                  fontFamily: 'var(--font-sans), system-ui, sans-serif',
                }}
              >
                {prev.word}
              </span>
            )}
            <ORPWord word={focal?.word || ''} size={56} weight={500} />
            {readMode === 'ghost' && next && (
              <span
                aria-hidden="true"
                style={{
                  fontSize: 26,
                  fontWeight: 400,
                  color: 'var(--ink)',
                  opacity: 0.22,
                  letterSpacing: '-0.01em',
                  fontFamily: 'var(--font-sans), system-ui, sans-serif',
                }}
              >
                {next.word}
              </span>
            )}
          </div>
        </div>

        {/* Punctuation beat */}
        <div
          aria-hidden="true"
          style={{
            marginTop: 40,
            height: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {focal?.endsSentence && (
            <span
              className="micro-label micro-label--accent"
              style={{ letterSpacing: '0.3em' }}
            >
              · · ·
            </span>
          )}
          {focal?.endsClause && !focal?.endsSentence && (
            <span
              className="micro-label"
              style={{
                color: 'var(--accent)',
                opacity: 0.7,
                letterSpacing: '0.3em',
              }}
            >
              · ·
            </span>
          )}
        </div>

        {/* Context strip */}
        <div style={{ marginTop: 24, width: '100%' }}>
          <ContextStrip
            words={words}
            index={engine.index}
            before={5}
            after={5}
          />
        </div>
      </div>

      {/* Bottom controls */}
      <div
        style={{
          padding:
            '0 20px calc(32px + env(safe-area-inset-bottom))',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {showScrub && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ position: 'relative', height: 32 }}>
              <div style={{ position: 'absolute', inset: '14px 0 auto 0' }}>
                <DocMiniMap
                  index={engine.index}
                  total={words.length}
                  height={4}
                />
              </div>
              <input
                aria-label="Scrub through document"
                type="range"
                min={0}
                max={Math.max(0, words.length - 1)}
                value={engine.index}
                onChange={(e) => engine.seek(+e.target.value)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  opacity: 0.01,
                  cursor: 'pointer',
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 10,
                  left: `${engine.progress * 100}%`,
                  transform: 'translate(-50%, 0)',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  boxShadow: '0 0 0 4px var(--accent-20)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => engine.step(-15)}
            style={sqBtnStyle}
            aria-label="Back 15 words"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M13 1L5 7l8 6M5 1v12"
                stroke="var(--ink)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            onClick={engine.toggle}
            aria-label={engine.playing ? 'Pause' : 'Play'}
            style={{
              flex: 1,
              height: 56,
              background: engine.playing ? 'var(--ink)' : 'var(--accent)',
              color: engine.playing ? 'var(--bg)' : '#fff',
              border: 0,
              borderRadius: 28,
              cursor: 'pointer',
              fontSize: 12,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              fontWeight: 700,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'background 180ms ease, color 180ms ease',
            }}
          >
            {engine.playing ? (
              <>
                <span
                  aria-hidden="true"
                  style={{ display: 'inline-flex', gap: 3 }}
                >
                  <span
                    style={{
                      width: 3,
                      height: 12,
                      background: 'var(--bg)',
                      borderRadius: 1,
                    }}
                  />
                  <span
                    style={{
                      width: 3,
                      height: 12,
                      background: 'var(--bg)',
                      borderRadius: 1,
                    }}
                  />
                </span>
                pause
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="14"
                  viewBox="0 0 12 14"
                  aria-hidden="true"
                >
                  <path d="M1 1l10 6-10 6V1z" fill="#fff" />
                </svg>
                read
              </>
            )}
          </button>

          <button
            onClick={() => engine.step(15)}
            style={sqBtnStyle}
            aria-label="Forward 15 words"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M1 1l8 6-8 6M9 1v12"
                stroke="var(--ink)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <div className="micro-label" style={{ marginBottom: 6 }}>
              wpm
            </div>
            <input
              className="glyph-range"
              type="range"
              min={120}
              max={650}
              step={10}
              value={speedReadWpm}
              onChange={(e) => setSpeedReadWpm(+e.target.value)}
              style={{ width: '100%' }}
              aria-label="Words per minute"
            />
          </div>
          <div>
            <div className="micro-label" style={{ marginBottom: 6 }}>
              mode
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {(
                [
                  { key: 'single' as const, label: '1', title: 'Single word' },
                  { key: 'ghost' as const, label: '3', title: 'Ghost: prev + focal + next' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setReadMode(opt.key)}
                  aria-pressed={readMode === opt.key}
                  aria-label={opt.title}
                  title={opt.title}
                  style={{
                    width: 38,
                    height: 26,
                    borderRadius: 6,
                    background: readMode === opt.key ? 'var(--accent)' : 'transparent',
                    color: readMode === opt.key ? '#fff' : 'var(--ink)',
                    border: `1px solid ${readMode === opt.key ? 'var(--accent)' : 'var(--rule)'}`,
                    cursor: 'pointer',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono), monospace',
                    padding: 0,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {opt.key === 'single' ? 'ONE' : 'GHOST'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowScrub((v) => !v)}
            aria-label="Toggle scrub bar"
            aria-pressed={showScrub}
            title="Scrub"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: showScrub ? 'var(--rule)' : 'transparent',
              border: '1px solid var(--rule)',
              color: 'var(--ink)',
              cursor: 'pointer',
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <circle cx="4" cy="7" r="2" fill="var(--ink)" />
              <circle cx="10" cy="7" r="2" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
              <path d="M1 7h12" stroke="var(--ink)" strokeWidth="0.8" />
            </svg>
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <button
            onClick={() => setExpressive((v) => !v)}
            aria-pressed={expressive}
            className="micro-label"
            style={{
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: expressive ? 'var(--accent)' : 'var(--muted)',
              padding: 0,
            }}
          >
            {expressive ? '✦ expressive pacing' : '✧ expressive pacing'}
          </button>
          <button
            onClick={handleBookmarkToggle}
            className="micro-label"
            aria-pressed={isBookmarked}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this word'}
            style={{
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: isBookmarked ? 'var(--accent)' : 'var(--muted)',
              padding: 0,
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <svg width="11" height="13" viewBox="0 0 11 13" aria-hidden="true">
              <path
                d="M1 1h9v11l-4.5-2.5L1 12V1z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill={isBookmarked ? 'currentColor' : 'none'}
                strokeLinejoin="round"
              />
            </svg>
            bookmark
          </button>
        </div>
      </div>
    </div>
  );
}

const sqBtnStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  background: 'transparent',
  border: '1px solid var(--rule)',
  color: 'var(--ink)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
  padding: 0,
};
