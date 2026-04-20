'use client';

import { useCallback, useMemo, useReducer } from 'react';
import type {
  GoalChunk,
  GoalPayload,
  GoalRange,
  GoalState,
  QuizQuestion,
} from '@/lib/goal-read/types';
import { buildChunks } from '@/lib/goal-read/chunking';

/**
 * Goal-session state machine. See §5 of specs/goal-based-reading.md.
 *
 * The session starts null (no active goal). `startGoal` creates a session in
 * `generating`, which flips to `primerReady` once the AI payload has been
 * committed via `commitPayload`. From there, read → quiz → (between or final).
 */

export interface ActiveGoalSession {
  range: GoalRange;
  chunks: GoalChunk[];
  summary: string;
  anchors: GoalPayload['anchors'];
  /** chunkIndex → questionId → selected choice index */
  answers: Record<number, Record<string, number>>;
  state: GoalState;
  /** Set if any chunk's payload was missing or invalid. Surface via toast. */
  partialFailure: boolean;
}

type Action =
  | {
      type: 'START_GOAL';
      range: GoalRange;
      chunks: GoalRange[];
    }
  | { type: 'COMMIT_PAYLOAD'; payload: GoalPayload }
  | { type: 'GENERATION_ERROR'; message: string }
  | { type: 'BEGIN_READING' }
  | { type: 'FINISH_CHUNK'; chunkIndex: number }
  | {
      type: 'ANSWER';
      chunkIndex: number;
      questionId: string;
      choiceIndex: number;
    }
  | { type: 'QUIZ_COMPLETE'; chunkIndex: number }
  | { type: 'ADVANCE_CHUNK'; toIndex: number }
  | { type: 'RESET_TO_IDLE' }
  | { type: 'RESTART_GOAL' }
  | { type: 'MARK_CHUNK_FAILED'; chunkIndex: number; message: string };

function reducer(
  state: ActiveGoalSession | null,
  action: Action
): ActiveGoalSession | null {
  switch (action.type) {
    case 'START_GOAL': {
      const chunks: GoalChunk[] = action.chunks.map((r, index) => ({
        index,
        range: r,
        miniPrimer: '',
        quiz: [],
      }));
      return {
        range: action.range,
        chunks,
        summary: '',
        anchors: [],
        answers: {},
        state: { kind: 'generating' },
        partialFailure: false,
      };
    }

    case 'COMMIT_PAYLOAD': {
      if (!state) return state;
      const chunks = state.chunks.map((chunk, i) => {
        const block = action.payload.chunks[i];
        if (!block) {
          return {
            ...chunk,
            generationError: 'Missing data for this chunk.',
          };
        }
        return {
          ...chunk,
          miniPrimer: block.miniPrimer,
          quiz: block.questions,
        };
      });
      const partialFailure = chunks.some((c) => c.generationError);
      return {
        ...state,
        summary: action.payload.summary,
        anchors: action.payload.anchors,
        chunks,
        partialFailure,
        state: { kind: 'primerReady' },
      };
    }

    case 'GENERATION_ERROR': {
      if (!state) return state;
      return {
        ...state,
        state: { kind: 'error', message: action.message },
      };
    }

    case 'BEGIN_READING': {
      if (!state) return state;
      if (state.state.kind !== 'primerReady') return state;
      return {
        ...state,
        state: { kind: 'reading', chunkIndex: 0 },
      };
    }

    case 'FINISH_CHUNK': {
      if (!state) return state;
      if (state.state.kind !== 'reading') return state;
      const chunk = state.chunks[action.chunkIndex];
      if (!chunk) return state;
      // If this chunk failed to generate, skip the quiz and go straight to
      // between-chunks (or final).
      if (chunk.generationError || chunk.quiz.length === 0) {
        return advanceAfterChunk(state, action.chunkIndex);
      }
      return {
        ...state,
        state: { kind: 'quiz', chunkIndex: action.chunkIndex },
      };
    }

    case 'ANSWER': {
      if (!state) return state;
      const existing = state.answers[action.chunkIndex] ?? {};
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.chunkIndex]: {
            ...existing,
            [action.questionId]: action.choiceIndex,
          },
        },
      };
    }

    case 'QUIZ_COMPLETE': {
      if (!state) return state;
      return advanceAfterChunk(state, action.chunkIndex);
    }

    case 'ADVANCE_CHUNK': {
      if (!state) return state;
      const next = state.chunks[action.toIndex];
      if (!next) return state;
      // Clear any prior answers for the chunk being re-entered
      const answers = { ...state.answers };
      delete answers[action.toIndex];
      return {
        ...state,
        answers,
        state: { kind: 'reading', chunkIndex: action.toIndex },
      };
    }

    case 'RESET_TO_IDLE':
      return null;

    case 'RESTART_GOAL': {
      if (!state) return state;
      return {
        ...state,
        answers: {},
        state: { kind: 'reading', chunkIndex: 0 },
      };
    }

    case 'MARK_CHUNK_FAILED': {
      if (!state) return state;
      const chunks = state.chunks.map((c) =>
        c.index === action.chunkIndex
          ? { ...c, generationError: action.message, quiz: [] }
          : c
      );
      return { ...state, chunks, partialFailure: true };
    }

    default:
      return state;
  }
}

function advanceAfterChunk(
  state: ActiveGoalSession,
  chunkIndex: number
): ActiveGoalSession {
  const isLast = chunkIndex === state.chunks.length - 1;
  if (isLast) {
    return { ...state, state: { kind: 'finalSummary' } };
  }
  return {
    ...state,
    state: { kind: 'betweenChunks', chunkIndex },
  };
}

export interface UseGoalSessionResult {
  session: ActiveGoalSession | null;
  currentChunk: GoalChunk | null;
  totalQuestions: number;
  totalCorrect: number;
  /** Map of chunkIndex → { correct, total } for the final summary & between-chunk screens. */
  chunkScores: Record<number, { correct: number; total: number }>;

  startGoal: (opts: {
    range: GoalRange;
    words: string[];
    wpm: number;
  }) => GoalRange[];
  commitPayload: (payload: GoalPayload) => void;
  setGenerationError: (message: string) => void;
  beginReading: () => void;
  finishChunk: (chunkIndex: number) => void;
  answer: (chunkIndex: number, question: QuizQuestion, choiceIndex: number) => void;
  completeQuiz: (chunkIndex: number) => void;
  continueToNextChunk: () => void;
  rereadChunk: (chunkIndex: number) => void;
  restartGoal: () => void;
  exitGoal: () => void;
  markChunkFailed: (chunkIndex: number, message: string) => void;
}

export function useGoalSession(): UseGoalSessionResult {
  const [session, dispatch] = useReducer(reducer, null);

  const startGoal = useCallback<UseGoalSessionResult['startGoal']>(
    ({ range, words, wpm }) => {
      const chunks = buildChunks(words, range, wpm);
      dispatch({ type: 'START_GOAL', range, chunks });
      return chunks;
    },
    []
  );

  const commitPayload = useCallback<UseGoalSessionResult['commitPayload']>(
    (payload) => dispatch({ type: 'COMMIT_PAYLOAD', payload }),
    []
  );

  const setGenerationError = useCallback(
    (message: string) => dispatch({ type: 'GENERATION_ERROR', message }),
    []
  );

  const beginReading = useCallback(
    () => dispatch({ type: 'BEGIN_READING' }),
    []
  );

  const finishChunk = useCallback(
    (chunkIndex: number) => dispatch({ type: 'FINISH_CHUNK', chunkIndex }),
    []
  );

  const answer = useCallback<UseGoalSessionResult['answer']>(
    (chunkIndex, question, choiceIndex) =>
      dispatch({
        type: 'ANSWER',
        chunkIndex,
        questionId: question.id,
        choiceIndex,
      }),
    []
  );

  const completeQuiz = useCallback(
    (chunkIndex: number) => dispatch({ type: 'QUIZ_COMPLETE', chunkIndex }),
    []
  );

  const continueToNextChunk = useCallback(() => {
    if (!session) return;
    if (session.state.kind !== 'betweenChunks') return;
    dispatch({
      type: 'ADVANCE_CHUNK',
      toIndex: session.state.chunkIndex + 1,
    });
  }, [session]);

  const rereadChunk = useCallback(
    (chunkIndex: number) =>
      dispatch({ type: 'ADVANCE_CHUNK', toIndex: chunkIndex }),
    []
  );

  const restartGoal = useCallback(
    () => dispatch({ type: 'RESTART_GOAL' }),
    []
  );

  const exitGoal = useCallback(() => dispatch({ type: 'RESET_TO_IDLE' }), []);

  const markChunkFailed = useCallback<UseGoalSessionResult['markChunkFailed']>(
    (chunkIndex, message) =>
      dispatch({ type: 'MARK_CHUNK_FAILED', chunkIndex, message }),
    []
  );

  const currentChunk = useMemo(() => {
    if (!session) return null;
    const s = session.state;
    if (s.kind === 'reading' || s.kind === 'quiz' || s.kind === 'betweenChunks') {
      return session.chunks[s.chunkIndex] ?? null;
    }
    return null;
  }, [session]);

  const chunkScores = useMemo(() => {
    const scores: Record<number, { correct: number; total: number }> = {};
    if (!session) return scores;
    for (const chunk of session.chunks) {
      const total = chunk.quiz.length;
      if (total === 0) continue;
      const answers = session.answers[chunk.index] ?? {};
      let correct = 0;
      for (const q of chunk.quiz) {
        const choice = answers[q.id];
        if (typeof choice === 'number' && choice === q.correctIndex) correct++;
      }
      scores[chunk.index] = { correct, total };
    }
    return scores;
  }, [session]);

  const { totalQuestions, totalCorrect } = useMemo(() => {
    let q = 0;
    let c = 0;
    for (const key of Object.keys(chunkScores)) {
      const s = chunkScores[Number(key)];
      q += s.total;
      c += s.correct;
    }
    return { totalQuestions: q, totalCorrect: c };
  }, [chunkScores]);

  return {
    session,
    currentChunk,
    totalQuestions,
    totalCorrect,
    chunkScores,
    startGoal,
    commitPayload,
    setGenerationError,
    beginReading,
    finishChunk,
    answer,
    completeQuiz,
    continueToNextChunk,
    rereadChunk,
    restartGoal,
    exitGoal,
    markChunkFailed,
  };
}
