/**
 * Archived session types — persisted to localStorage so the user can revisit
 * primers, summaries, and quizzes from past reading sessions.
 *
 * Two kinds:
 *  - `goal`   — a completed goal-based reading session (pre-read primer +
 *               per-chunk quizzes).
 *  - `free`   — a free-read session that was subsequently followed up with
 *               an on-demand summary + quiz.
 *
 * All word indices are in the canonical tokenized frame (see `src/lib/tokenize.ts`)
 * so they remain stable as long as the source text is unchanged.
 */

export type ArchivedSessionKind = 'goal' | 'free';

export interface ArchivedWordRange {
  startWord: number;
  endWord: number;
}

export interface ArchivedAnchor {
  text: string;
}

export interface ArchivedQuestion {
  id: string;
  question: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /** Source span of the supporting text, clamped to the session range. */
  source: ArchivedWordRange;
  /** Optional explanation of the correct answer. */
  explanation?: string;
  /** The user's chosen index (0..3), or null if they skipped/didn't answer. */
  chosenIndex: number | null;
}

export interface ArchivedChunk {
  index: number;
  range: ArchivedWordRange;
  miniPrimer: string;
  questions: ArchivedQuestion[];
}

interface ArchivedSessionBase {
  /** UUID v4 */
  id: string;
  /** Foreign key to DocumentMeta.id */
  documentId: string;
  /** Document title at the time of archiving (for display even if doc is deleted). */
  documentTitle: string;
  /** Unix timestamp (ms) of when the session was saved. */
  createdAt: number;
  /** Span of the source text that was read. */
  range: ArchivedWordRange;
  /** WPM the reader was using when the session was saved. */
  wpm: number;
  /** Prose summary shown in the primer / post-read screen. */
  summary: string;
  /** Open-ended attention-anchor questions. */
  anchors: ArchivedAnchor[];
  /** Per-chunk quiz data (free-read sessions always have a single chunk). */
  chunks: ArchivedChunk[];
  /** Aggregate score across all answered questions. */
  totalCorrect: number;
  totalQuestions: number;
}

export interface ArchivedGoalSession extends ArchivedSessionBase {
  kind: 'goal';
}

export interface ArchivedFreeSession extends ArchivedSessionBase {
  kind: 'free';
  /** Duration of the free read in ms, for display in the archive. */
  readDurationMs?: number;
  /** Average WPM achieved during the actual read (as opposed to the target). */
  readAvgWpm?: number;
}

export type ArchivedSession = ArchivedGoalSession | ArchivedFreeSession;
