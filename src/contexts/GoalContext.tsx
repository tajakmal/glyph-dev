'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReaderContext } from '@/contexts/ReaderContext';
import { useGoalGeneration } from '@/hooks/useGoalGeneration';
import {
  useGoalSession,
  type ActiveGoalSession,
} from '@/hooks/useGoalSession';
import type {
  GoalChunk,
  GoalPayload,
  GoalRange,
  QuizQuestion,
} from '@/lib/goal-read/types';

/**
 * Show-source overlay state — when the user taps "Show source" on a quiz
 * question, the QuizModal hides, the underlying reader scrolls+highlights
 * the answer's source range, and a "Back to quiz" pill is shown.
 */
interface ShowSourceState {
  chunkIndex: number;
  question: QuizQuestion;
}

/**
 * Callback the underlying reader registers so the goal flow can drive
 * scroll + temporary highlight when showing a quiz source.
 */
export type ScrollToWordRangeFn = (range: GoalRange) => void;

interface GoalContextValue {
  // Session state
  session: ActiveGoalSession | null;
  currentChunk: GoalChunk | null;
  chunkScores: Record<number, { correct: number; total: number }>;
  totalQuestions: number;
  totalCorrect: number;

  // Generation state
  streaming: boolean;
  summaryText: string;
  payload: GoalPayload | null;
  generationError: string | null;

  // Primer modal
  primerOpen: boolean;
  openPrimer: () => void;
  closePrimer: () => void;

  // Show source
  showSource: ShowSourceState | null;
  revealSource: (chunkIndex: number, question: QuizQuestion) => void;
  backToQuiz: () => void;

  /** Active question index inside the current chunk's quiz (0-based). */
  activeQuestionIndex: number;
  setActiveQuestionIndex: (i: number) => void;

  // Actions
  startFocusGoal: (range: GoalRange) => void;
  retryGeneration: () => void;
  cancelGeneration: () => void;
  /** Abort generation and fall back to plain speed-read at the goal's start. */
  fallbackToPlainSpeedRead: () => void;
  beginReading: () => void;
  finishChunk: (chunkIndex: number) => void;
  answer: (chunkIndex: number, question: QuizQuestion, choiceIndex: number) => void;
  completeQuiz: (chunkIndex: number) => void;
  continueToNextChunk: () => void;
  rereadChunk: (chunkIndex: number) => void;
  restartGoal: () => void;
  exitGoal: () => void;

  // Wiring from the underlying reader (text or PDF)
  registerScrollToWordRange: (fn: ScrollToWordRangeFn | null) => void;
}

const GoalContext = createContext<GoalContextValue | null>(null);

export function useGoalContext(): GoalContextValue {
  const ctx = useContext(GoalContext);
  if (!ctx) {
    throw new Error('useGoalContext must be used within a GoalProvider');
  }
  return ctx;
}

interface GoalProviderProps {
  children: React.ReactNode;
}

export function GoalProvider({ children }: GoalProviderProps) {
  const reader = useReaderContext();
  const {
    session,
    currentChunk,
    chunkScores,
    totalQuestions,
    totalCorrect,
    startGoal,
    commitPayload,
    setGenerationError,
    beginReading: beginReadingSession,
    finishChunk,
    answer,
    completeQuiz,
    continueToNextChunk,
    rereadChunk,
    restartGoal,
    exitGoal,
    markChunkFailed: _markChunkFailed,
  } = useGoalSession();

  void _markChunkFailed; // reserved for a future per-chunk regeneration path

  const generation = useGoalGeneration();
  const [primerOpen, setPrimerOpen] = useState(false);
  const [showSource, setShowSource] = useState<ShowSourceState | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const scrollToRangeRef = useRef<ScrollToWordRangeFn | null>(null);

  // Reset the active question index whenever the active chunk changes
  // (storing-prev-render pattern — safer than an effect per React 19 lint).
  const currentChunkIdx =
    session?.state.kind === 'quiz' || session?.state.kind === 'reading'
      ? session.state.chunkIndex
      : null;
  const [lastChunkIdx, setLastChunkIdx] = useState<number | null>(null);
  if (currentChunkIdx !== lastChunkIdx) {
    setLastChunkIdx(currentChunkIdx);
    setActiveQuestionIndex(0);
  }

  // Commit payload to session once generation produces one.
  useEffect(() => {
    if (generation.payload && session && session.state.kind === 'generating') {
      commitPayload(generation.payload);
    }
  }, [generation.payload, session, commitPayload]);

  // Propagate generation errors to session state.
  useEffect(() => {
    if (
      generation.error &&
      session &&
      (session.state.kind === 'generating' || session.state.kind === 'primerReady')
    ) {
      setGenerationError(generation.error);
    }
  }, [generation.error, session, setGenerationError]);

  const startFocusGoal = useCallback<GoalContextValue['startFocusGoal']>(
    (range) => {
      const chunks = startGoal({
        range,
        words: reader.words,
        wpm: reader.speedReadWpm,
      });
      generation.reset();
      generation.start({ words: reader.words, range, chunks });
      setPrimerOpen(true);
      setShowSource(null);
    },
    [startGoal, reader.words, reader.speedReadWpm, generation]
  );

  const retryGeneration = useCallback(() => {
    if (!session) return;
    const chunks = session.chunks.map((c) => c.range);
    generation.reset();
    generation.start({ words: reader.words, range: session.range, chunks });
  }, [session, reader.words, generation]);

  const cancelGeneration = useCallback(() => {
    generation.abort();
    exitGoal();
    generation.reset();
    setPrimerOpen(false);
  }, [generation, exitGoal]);

  const fallbackToPlainSpeedRead = useCallback(() => {
    if (!session) return;
    const startWord = session.range.startWord;
    generation.abort();
    generation.reset();
    exitGoal();
    setPrimerOpen(false);
    reader.setCurrentWordIndex(startWord);
    reader.setViewMode('speed-read');
  }, [session, generation, exitGoal, reader]);

  const beginReading = useCallback(() => {
    if (!session) return;
    const first = session.chunks[0];
    if (!first) return;
    reader.setCurrentWordIndex(first.range.startWord);
    beginReadingSession();
    setPrimerOpen(false);
    reader.setViewMode('speed-read');
  }, [session, reader, beginReadingSession]);

  // Each chunk transition should place the RSVP engine at the chunk's start
  useEffect(() => {
    if (!session) return;
    if (session.state.kind === 'reading') {
      const chunk = session.chunks[session.state.chunkIndex];
      if (chunk) {
        reader.setCurrentWordIndex(chunk.range.startWord);
      }
    }
  }, [session, reader]);

  const handleFinalDone = useCallback(() => {
    if (!session) return;
    const endWord = session.range.endWord;
    exitGoal();
    generation.reset();
    reader.setViewMode('pdf');
    reader.setCurrentWordIndex(endWord);
  }, [session, exitGoal, generation, reader]);

  const handleFullExit = useCallback(() => {
    exitGoal();
    generation.reset();
    setPrimerOpen(false);
    setShowSource(null);
  }, [exitGoal, generation]);

  const revealSource = useCallback<GoalContextValue['revealSource']>(
    (chunkIndex, question) => {
      setShowSource({ chunkIndex, question });
      reader.setViewMode('pdf');
      // Let the viewer mount/focus before scrolling.
      requestAnimationFrame(() => {
        scrollToRangeRef.current?.(question.source);
      });
    },
    [reader]
  );

  const backToQuiz = useCallback(() => {
    setShowSource(null);
    reader.setViewMode('speed-read');
  }, [reader]);

  const registerScrollToWordRange = useCallback(
    (fn: ScrollToWordRangeFn | null) => {
      scrollToRangeRef.current = fn;
    },
    []
  );

  // Finalize: when user hits Done on the final summary → exit cleanly.
  const exitGoalWrapper = useCallback(() => {
    if (session && session.state.kind === 'finalSummary') {
      handleFinalDone();
    } else {
      handleFullExit();
    }
  }, [session, handleFinalDone, handleFullExit]);

  const value: GoalContextValue = useMemo(
    () => ({
      session,
      currentChunk,
      chunkScores,
      totalQuestions,
      totalCorrect,

      streaming: generation.streaming,
      summaryText: generation.summaryText,
      payload: generation.payload,
      generationError: generation.error,

      primerOpen,
      openPrimer: () => setPrimerOpen(true),
      closePrimer: () => setPrimerOpen(false),

      showSource,
      revealSource,
      backToQuiz,

      activeQuestionIndex,
      setActiveQuestionIndex,

      startFocusGoal,
      retryGeneration,
      cancelGeneration,
      fallbackToPlainSpeedRead,
      beginReading,
      finishChunk,
      answer,
      completeQuiz,
      continueToNextChunk,
      rereadChunk,
      restartGoal,
      exitGoal: exitGoalWrapper,

      registerScrollToWordRange,
    }),
    [
      session,
      currentChunk,
      chunkScores,
      totalQuestions,
      totalCorrect,
      generation.streaming,
      generation.summaryText,
      generation.payload,
      generation.error,
      primerOpen,
      showSource,
      revealSource,
      backToQuiz,
      activeQuestionIndex,
      startFocusGoal,
      retryGeneration,
      cancelGeneration,
      fallbackToPlainSpeedRead,
      beginReading,
      finishChunk,
      answer,
      completeQuiz,
      continueToNextChunk,
      rereadChunk,
      restartGoal,
      exitGoalWrapper,
      registerScrollToWordRange,
    ]
  );

  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>;
}
