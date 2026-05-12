import { ANTHROPIC_GOAL_MODEL } from '@/lib/ai/models';

/**
 * Shared types for the goal-based reading feature.
 *
 * All word indices are global indices produced by `src/lib/tokenize.ts`.
 * See `specs/goal-based-reading.md` for the full feature design.
 */

export interface GoalRange {
  /** 0-based, inclusive */
  startWord: number;
  /** 0-based, inclusive */
  endWord: number;
}

export interface AttentionAnchor {
  /** Open-ended primer question — NOT multiple choice */
  text: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /** Source range in the original document, in global word indices */
  source: GoalRange;
  /** Optional short explanation of why the answer is correct */
  explanation?: string;
}

export interface GoalChunk {
  index: number;
  range: GoalRange;
  miniPrimer: string;
  quiz: QuizQuestion[];
  generationError?: string;
}

export interface GoalPayload {
  /** Full-goal summary shown in the Primer modal. Length is model-decided. */
  summary: string;
  /** Open-ended attention anchors. Count is model-decided. */
  anchors: AttentionAnchor[];
  /** Per-chunk mini-primer + quiz. Length equals chunk count. */
  chunks: Array<{
    miniPrimer: string;
    questions: QuizQuestion[];
  }>;
}

export type GoalState =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'primerReady' }
  | { kind: 'reading'; chunkIndex: number }
  | { kind: 'quiz'; chunkIndex: number }
  | { kind: 'betweenChunks'; chunkIndex: number }
  | { kind: 'finalSummary' }
  | { kind: 'error'; message: string };

export interface GoalSession {
  range: GoalRange;
  chunks: GoalChunk[];
  summary: string;
  anchors: AttentionAnchor[];
  /** User answers: chunkIndex → questionId → chosen choice index (0..3) */
  answers: Record<number, Record<string, number>>;
  state: GoalState;
}

/** Soft cap — larger goals are rejected at the chooser. */
export const MAX_GOAL_WORDS = 5000;

/** Selections shorter than this auto-route to plain speed-read. */
export const MIN_FOCUS_WORDS = 100;

/** Chunking constants (kept here so UI copy can reference them). */
export const CHUNK_TRIGGER_MIN = 10;
export const CHUNK_TARGET_MIN = 5;
export const MIN_CHUNK_WORDS = 200;

/** Anthropic model used for goal-based reading calls. */
export const GOAL_MODEL = ANTHROPIC_GOAL_MODEL;

/** Preset chip options (minutes) for "Next N minutes" goals. */
export const NEXT_MIN_PRESETS = [3, 5, 10, 15] as const;
export const DEFAULT_NEXT_MIN = 5;
