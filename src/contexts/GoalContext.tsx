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
import { v4 as uuidv4 } from 'uuid';
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
import { saveArchivedSession } from '@/lib/archive';
import type { ArchivedGoalSession } from '@/types/archive';

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

  /** Archive id for the current (or just-finished) session, if any. */
  archiveId: string | null;

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
    resetToGenerating,
    beginReading: beginReadingSession,
    finishChunk,
    answer,
    completeQuiz,
    continueToNextChunk: continueToNextChunkSession,
    rereadChunk: rereadChunkSession,
    restartGoal: restartGoalSession,
    exitGoal,
    markChunkFailed: _markChunkFailed,
  } = useGoalSession();

  void _markChunkFailed; // reserved for a future per-chunk regeneration path

  const generation = useGoalGeneration();
  const [primerOpen, setPrimerOpen] = useState(false);
  const [showSource, setShowSource] = useState<ShowSourceState | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const scrollToRangeRef = useRef<ScrollToWordRangeFn | null>(null);

  // A single archive-entry id for the current goal session. Seeded on
  // START_GOAL and cleared on exit/error, so the entry is written once and
  // then updated in place as the user answers more questions.
  // Mirrored into state so consumers (e.g. FinalSummaryScreen) can link to it.
  const archiveIdRef = useRef<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);

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

  // Persist the goal session into the archive so primers + quizzes remain
  // revisitable after the session ends. Seeds an entry on first reading
  // state and updates it in place as the user progresses.
  const documentId = reader.documentId;
  const documentTitle = reader.documentMeta?.title ?? 'Untitled';
  const readerWpm = reader.speedReadWpm;
  useEffect(() => {
    if (!session) return;
    const kind = session.state.kind;
    const archivable =
      kind === 'reading' ||
      kind === 'quiz' ||
      kind === 'betweenChunks' ||
      kind === 'finalSummary';
    if (!archivable) return;
    if (!documentId) return;

    if (!archiveIdRef.current) {
      archiveIdRef.current = uuidv4();
      setArchiveId(archiveIdRef.current);
    }
    const entry: ArchivedGoalSession = {
      kind: 'goal',
      id: archiveIdRef.current,
      documentId,
      documentTitle,
      createdAt: Date.now(),
      range: session.range,
      wpm: readerWpm,
      summary: session.summary,
      anchors: session.anchors.map((a) => ({ text: a.text })),
      chunks: session.chunks.map((c) => ({
        index: c.index,
        range: c.range,
        miniPrimer: c.miniPrimer,
        questions: c.quiz.map((q) => ({
          id: q.id,
          question: q.question,
          choices: q.choices,
          correctIndex: q.correctIndex,
          source: q.source,
          explanation: q.explanation,
          chosenIndex: (() => {
            const choice = session.answers[c.index]?.[q.id];
            return typeof choice === 'number' ? choice : null;
          })(),
        })),
      })),
      // Derived in save(), but kept here so the in-memory shape is coherent.
      totalQuestions: 0,
      totalCorrect: 0,
    };
    entry.totalQuestions = entry.chunks.reduce(
      (n, c) => n + c.questions.length,
      0
    );
    entry.totalCorrect = entry.chunks.reduce(
      (n, c) =>
        n +
        c.questions.reduce(
          (m, q) => m + (q.chosenIndex === q.correctIndex ? 1 : 0),
          0
        ),
      0
    );
    try {
      saveArchivedSession(entry);
    } catch {
      // Non-fatal — archiving is best-effort.
    }
  }, [session, documentId, documentTitle, readerWpm]);

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
    // Move session out of 'error' so the commit-payload effect fires again
    // once the retry produces a payload.
    resetToGenerating();
    generation.start({ words: reader.words, range: session.range, chunks });
  }, [session, reader.words, generation, resetToGenerating]);

  const cancelGeneration = useCallback(() => {
    generation.abort();
    exitGoal();
    generation.reset();
    setPrimerOpen(false);
    archiveIdRef.current = null;
    setArchiveId(null);
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
    archiveIdRef.current = null;
    setArchiveId(null);
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

  // Chunk transitions set the RSVP engine index to the chunk's start word
  // exactly once — at the moment of transition. An effect-driven reset would
  // re-fire on every render because ReaderContext's value isn't memoized.
  const continueToNextChunk = useCallback(() => {
    if (!session) return;
    if (session.state.kind !== 'betweenChunks') return;
    const nextIdx = session.state.chunkIndex + 1;
    const next = session.chunks[nextIdx];
    if (next) reader.setCurrentWordIndex(next.range.startWord);
    continueToNextChunkSession();
  }, [session, reader, continueToNextChunkSession]);

  const rereadChunk = useCallback(
    (chunkIndex: number) => {
      const chunk = session?.chunks[chunkIndex];
      if (chunk) reader.setCurrentWordIndex(chunk.range.startWord);
      rereadChunkSession(chunkIndex);
    },
    [session, reader, rereadChunkSession]
  );

  const restartGoal = useCallback(() => {
    const first = session?.chunks[0];
    if (first) reader.setCurrentWordIndex(first.range.startWord);
    restartGoalSession();
  }, [session, reader, restartGoalSession]);

  const handleFinalDone = useCallback(() => {
    if (!session) return;
    const endWord = session.range.endWord;
    exitGoal();
    generation.reset();
    reader.setViewMode('pdf');
    reader.setCurrentWordIndex(endWord);
    archiveIdRef.current = null;
    setArchiveId(null);
  }, [session, exitGoal, generation, reader]);

  const handleFullExit = useCallback(() => {
    exitGoal();
    generation.reset();
    setPrimerOpen(false);
    setShowSource(null);
    // If we were mid-read / mid-quiz, bring the underlying reader back into
    // view. Without this, the user lands on a speed-read panel with no goal
    // and has to press Close to exit.
    reader.setViewMode('pdf');
    archiveIdRef.current = null;
    setArchiveId(null);
  }, [exitGoal, generation, reader]);

  const revealSource = useCallback<GoalContextValue['revealSource']>(
    (chunkIndex, question) => {
      setShowSource({ chunkIndex, question });
    },
    []
  );

  const backToQuiz = useCallback(() => {
    setShowSource(null);
  }, []);

  const registerScrollToWordRange = useCallback(
    (fn: ScrollToWordRangeFn | null) => {
      scrollToRangeRef.current = fn;
    },
    []
  );

  // Stable references for the primer-modal open/close actions so the context
  // value object doesn't invalidate every render.
  const openPrimer = useCallback(() => setPrimerOpen(true), []);
  const closePrimer = useCallback(() => setPrimerOpen(false), []);

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
      openPrimer,
      closePrimer,

      showSource,
      revealSource,
      backToQuiz,

      activeQuestionIndex,
      setActiveQuestionIndex,

      archiveId,

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
      openPrimer,
      closePrimer,
      showSource,
      revealSource,
      backToQuiz,
      activeQuestionIndex,
      archiveId,
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
