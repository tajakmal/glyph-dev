import { ANTHROPIC_POST_READ_MODEL } from '@/lib/ai/models';

/**
 * Shared types for the post-session quiz feature — triggered after a plain
 * speed-read finishes. The user was reading freely (no pre-read primer), and
 * now asks to be quizzed on what they just read. We produce:
 *   1) a recap summary of the passage (streamed prose),
 *   2) a set of comprehension questions tied to specific source ranges.
 *
 * This is intentionally single-chunk — unlike goal-based reading, we don't
 * need per-chunk primers.
 */

export interface PostReadRange {
  startWord: number;
  endWord: number;
}

export interface PostReadQuestion {
  id: string;
  question: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /** Source range in the passage (global word indices). */
  source: PostReadRange;
  explanation?: string;
}

export interface PostReadPayload {
  /** Prose recap of what the reader just covered. Length is model-decided. */
  summary: string;
  /** Key follow-up questions framed for reflection (open-ended prompts). */
  keyQuestions: string[];
  /** ABCD comprehension quiz. */
  quiz: PostReadQuestion[];
}

/** Anthropic model used for post-read calls — kept identical to goal-read for cache. */
export const POST_READ_MODEL = ANTHROPIC_POST_READ_MODEL;

/** Minimum words a session needs before we bother offering a quiz. */
export const MIN_POST_READ_WORDS = 80;
