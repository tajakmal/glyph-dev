'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * A token derived from a plain word string, enriched with punctuation
 * metadata used by expressive pacing.
 */
export interface SpeedReadToken {
  /** The raw word string as produced by `tokenize()` (punctuation attached) */
  word: string;
  /** 0-based index into the source word array */
  index: number;
  /** True when the word ends with sentence punctuation (. ! ?) */
  endsSentence: boolean;
  /** True when the word ends with clause punctuation (, ; : — –) */
  endsClause: boolean;
  length: number;
}

export interface UseSpeedReaderOptions {
  /** Source tokenized words (from src/lib/tokenize.ts) */
  words: string[];
  /** Initial WPM (default 320) */
  wpm?: number;
  /** Enable variable pacing for punctuation / long words. Default true. */
  expressive?: boolean;
  /** Controlled current index (optional) */
  index?: number;
  /** Setter for controlled index (optional) */
  onIndexChange?: (next: number) => void;
  /** Autoplay on mount */
  autoPlay?: boolean;
  /**
   * Optional playback range. When provided, `play()` stops at `range.end`
   * (inclusive) and `progress` is computed relative to the range.
   */
  range?: { start: number; end: number };
  /** Called once when play reaches `range.end`. Fires with the end index. */
  onRangeEnd?: (endIndex: number) => void;
}

export function buildTokens(words: string[]): SpeedReadToken[] {
  const tokens: SpeedReadToken[] = new Array(words.length);
  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? '';
    const endsSentence = /[.!?]["')\]]?$/.test(w);
    const endsClause = !endsSentence && /[,;:—–]["')\]]?$/.test(w);
    tokens[i] = {
      word: w,
      index: i,
      endsSentence,
      endsClause,
      length: w.length,
    };
  }
  return tokens;
}

/**
 * Optimal Recognition Point — slightly left of centre, Spritz-style.
 */
export function orpIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 4) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

/**
 * WPM → ms per token, with expressive pacing for punctuation and long words.
 */
export function wordDuration(
  token: SpeedReadToken,
  wpm: number,
  expressive = true
): number {
  const base = 60_000 / Math.max(60, wpm);
  if (!expressive) return base;
  let mult = 1;
  if (token.length > 8) mult *= 1.15;
  if (token.length > 12) mult *= 1.2;
  if (token.endsClause) mult *= 1.4;
  if (token.endsSentence) mult *= 1.8;
  return base * mult;
}

/**
 * Format remaining time for display (s / m / h m).
 */
export function formatRemaining(words: number, wpm: number): string {
  if (words <= 0) return '0s';
  const mins = words / Math.max(60, wpm);
  if (mins < 1) return `${Math.max(1, Math.round(mins * 60))}s`;
  if (mins < 60) return `${Math.max(1, Math.round(mins))}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

export interface UseSpeedReaderResult {
  tokens: SpeedReadToken[];
  index: number;
  playing: boolean;
  progress: number;
  focalToken: SpeedReadToken | null;
  /** Previous token (ghost window left) */
  prevToken: SpeedReadToken | null;
  /** Next token (ghost window right) */
  nextToken: SpeedReadToken | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  step: (delta: number) => void;
  seek: (to: number) => void;
  reset: () => void;
  setIndex: (to: number) => void;
}

export function useSpeedReader({
  words,
  wpm = 320,
  expressive = true,
  index: controlledIndex,
  onIndexChange,
  autoPlay = false,
  range,
  onRangeEnd,
}: UseSpeedReaderOptions): UseSpeedReaderResult {
  const tokens = useMemo(() => buildTokens(words), [words]);
  const [internalIndex, setInternalIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const index = controlledIndex ?? internalIndex;

  // Effective playback bounds. When a range is provided, navigation and
  // progress are scoped to it. The default bounds span the whole document.
  const effectiveStart = range ? Math.max(0, range.start) : 0;
  const effectiveEnd = range
    ? Math.min(tokens.length - 1, range.end)
    : tokens.length - 1;

  const setIndex = useCallback(
    (next: number) => {
      const lo = effectiveStart;
      const hi = effectiveEnd;
      const clamped = Math.max(lo, Math.min(hi, next));
      if (onIndexChange) onIndexChange(clamped);
      if (controlledIndex == null) setInternalIndex(clamped);
    },
    [effectiveStart, effectiveEnd, controlledIndex, onIndexChange]
  );

  // Autoplay on mount if requested
  useEffect(() => {
    if (!autoPlay) return;
    const t = setTimeout(() => setPlaying(true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeEndFiredRef = useRef(false);
  useEffect(() => {
    rangeEndFiredRef.current = false;
  }, [range?.start, range?.end]);

  // Main tick — always advance by one word; ghost mode just affects rendering.
  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    if (index >= effectiveEnd) {
      setPlaying(false);
      if (range && !rangeEndFiredRef.current) {
        rangeEndFiredRef.current = true;
        onRangeEnd?.(effectiveEnd);
      }
      return;
    }
    const focal = tokens[index];
    const duration = focal ? wordDuration(focal, wpm, expressive) : 60_000 / wpm;
    timerRef.current = setTimeout(() => {
      setIndex(Math.min(effectiveEnd, index + 1));
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    playing,
    index,
    tokens,
    wpm,
    expressive,
    setIndex,
    effectiveEnd,
    range,
    onRangeEnd,
  ]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const step = useCallback(
    (delta: number) => setIndex(index + delta),
    [index, setIndex]
  );
  const seek = useCallback((to: number) => setIndex(to), [setIndex]);
  const reset = useCallback(() => setIndex(effectiveStart), [setIndex, effectiveStart]);

  const focalToken = tokens[index] ?? null;
  const prevToken = index > effectiveStart ? tokens[index - 1] : null;
  const nextToken = index < effectiveEnd ? tokens[index + 1] : null;
  const span = Math.max(1, effectiveEnd - effectiveStart);
  const progress = tokens.length > 0 ? Math.max(0, Math.min(1, (index - effectiveStart) / span)) : 0;

  return {
    tokens,
    index,
    playing,
    progress,
    focalToken,
    prevToken,
    nextToken,
    play,
    pause,
    toggle,
    step,
    seek,
    reset,
    setIndex,
  };
}
