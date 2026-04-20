import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { ChatError, type ChatErrorKind } from '@/lib/chat/provider';
import {
  GOAL_SYSTEM_PROMPT,
  GOAL_TOOL_NAME,
  GOAL_TOOL_SCHEMA,
  buildGoalUserMessage,
} from './prompt';
import {
  GOAL_MODEL,
  type GoalPayload,
  type GoalRange,
  type QuizQuestion,
} from './types';
import { getTextForWordRange } from '@/lib/tokenize';

const MAX_OUTPUT_TOKENS = 4096;
const TEMPERATURE = 0.4;

export type GoalGenerationEvent =
  | { type: 'summary_delta'; delta: string }
  | { type: 'payload'; payload: GoalPayload }
  | { type: 'done' }
  | { type: 'error'; error: string; errorKind: ChatErrorKind };

export interface GoalGenerationOptions {
  apiKey: string;
  words: string[];
  range: GoalRange;
  chunks: GoalRange[];
  signal?: AbortSignal;
}

/**
 * Run a goal-based generation. Streams the summary as `summary_delta` events,
 * then emits a single `payload` event once the tool call lands.
 *
 * Validates the tool-call input against the schema before yielding; any
 * invalid shape turns into an `error` event with errorKind 'unknown'.
 */
export async function* streamGoalGeneration(
  opts: GoalGenerationOptions
): AsyncGenerator<GoalGenerationEvent, void, void> {
  const { apiKey, words, range, chunks, signal } = opts;
  if (!apiKey) {
    yield {
      type: 'error',
      error: 'Missing Anthropic API key.',
      errorKind: 'invalid_key',
    };
    return;
  }

  const passageText = getTextForWordRange(
    words.join(' '),
    range.startWord,
    range.endWord
  );

  const userMessage = buildGoalUserMessage({
    range,
    passageText,
    chunks,
  });

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  let toolJsonAcc = '';
  let toolBlockStarted = false;

  try {
    const stream = await client.messages.create(
      {
        model: GOAL_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
        system: [
          {
            type: 'text',
            text: GOAL_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [GOAL_TOOL_SCHEMA],
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: userMessage }],
          },
        ],
        stream: true,
      },
      { signal }
    );

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block;
        if (block.type === 'tool_use' && block.name === GOAL_TOOL_NAME) {
          toolBlockStarted = true;
          toolJsonAcc = '';
        }
      } else if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta') {
          yield { type: 'summary_delta', delta: delta.text };
        } else if (delta.type === 'input_json_delta' && toolBlockStarted) {
          toolJsonAcc += delta.partial_json;
        }
      }
    }

    if (!toolBlockStarted || !toolJsonAcc.trim()) {
      yield {
        type: 'error',
        error: 'Model did not return the expected structured payload.',
        errorKind: 'unknown',
      };
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(toolJsonAcc);
    } catch {
      yield {
        type: 'error',
        error: 'Model returned malformed JSON for the quiz data.',
        errorKind: 'unknown',
      };
      return;
    }

    const payload = validateToolOutput(parsed, chunks, range);
    if (!payload) {
      yield {
        type: 'error',
        error: 'Model returned an invalid quiz structure.',
        errorKind: 'unknown',
      };
      return;
    }

    // Summary is populated upstream from streamed deltas; leave blank here.
    yield { type: 'payload', payload };
    yield { type: 'done' };
  } catch (err) {
    const kind = classifyError(err);
    if (kind === 'aborted') {
      yield { type: 'done' };
      return;
    }
    yield {
      type: 'error',
      error: errorMessage(kind),
      errorKind: kind,
    };
  }
}

function validateToolOutput(
  raw: unknown,
  chunks: GoalRange[],
  goalRange: GoalRange
): GoalPayload | null {
  if (!isPlainObject(raw)) return null;
  const anchors = raw.anchors;
  const chunkBlocks = raw.chunks;
  if (!Array.isArray(anchors) || !Array.isArray(chunkBlocks)) return null;

  const cleanedAnchors: GoalPayload['anchors'] = [];
  for (const a of anchors) {
    if (isPlainObject(a) && typeof a.text === 'string' && a.text.trim()) {
      cleanedAnchors.push({ text: a.text.trim() });
    }
  }

  const cleanedChunks: GoalPayload['chunks'] = [];
  for (let i = 0; i < chunkBlocks.length; i++) {
    const block = chunkBlocks[i];
    const chunkRange = chunks[i];
    if (!isPlainObject(block) || !chunkRange) return null;

    const miniPrimer =
      typeof block.miniPrimer === 'string' ? block.miniPrimer.trim() : '';
    const rawQuestions = block.questions;
    if (!miniPrimer || !Array.isArray(rawQuestions)) return null;

    const questions: QuizQuestion[] = [];
    for (const q of rawQuestions) {
      if (!isPlainObject(q)) continue;
      const question = typeof q.question === 'string' ? q.question.trim() : '';
      const choices = q.choices;
      const correctIndex = q.correctIndex;
      const startWord = q.sourceStartWord;
      const endWord = q.sourceEndWord;
      const explanation =
        typeof q.explanation === 'string' ? q.explanation.trim() : undefined;

      if (!question) continue;
      if (!Array.isArray(choices) || choices.length !== 4) continue;
      const normalizedChoices = choices.map((c) =>
        typeof c === 'string' ? c.trim() : ''
      );
      if (normalizedChoices.some((c) => !c)) continue;

      if (
        typeof correctIndex !== 'number' ||
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex > 3
      ) {
        continue;
      }
      if (
        typeof startWord !== 'number' ||
        typeof endWord !== 'number' ||
        !Number.isInteger(startWord) ||
        !Number.isInteger(endWord)
      ) {
        continue;
      }

      // Clamp source to goal range (spec §13: clamp, don't discard).
      const clampedStart = clamp(startWord, goalRange.startWord, goalRange.endWord);
      const clampedEnd = clamp(endWord, clampedStart, goalRange.endWord);

      questions.push({
        id: uuidv4(),
        question,
        choices: normalizedChoices as [string, string, string, string],
        correctIndex: correctIndex as 0 | 1 | 2 | 3,
        source: { startWord: clampedStart, endWord: clampedEnd },
        explanation,
      });
    }

    if (questions.length === 0) return null;
    cleanedChunks.push({ miniPrimer, questions });
  }

  if (cleanedChunks.length !== chunks.length) return null;

  return {
    summary: '',
    anchors: cleanedAnchors,
    chunks: cleanedChunks,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function classifyError(err: unknown): ChatErrorKind {
  if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
  if (err instanceof ChatError) return err.kind;
  const anyErr = err as { status?: number; name?: string; message?: string };
  if (anyErr?.status === 401 || anyErr?.status === 403) return 'invalid_key';
  if (anyErr?.status === 429) return 'rate_limit';
  if (
    anyErr?.name === 'APIConnectionError' ||
    (anyErr?.message && anyErr.message.includes('fetch'))
  ) {
    return 'network';
  }
  return 'unknown';
}

function errorMessage(kind: ChatErrorKind): string {
  switch (kind) {
    case 'invalid_key':
      return 'Your Anthropic API key was rejected. Check it in Settings.';
    case 'rate_limit':
      return 'Rate limited by Anthropic. Wait a moment and try again.';
    case 'network':
      return 'Network error reaching Anthropic.';
    case 'aborted':
      return 'Request aborted.';
    default:
      return 'Couldn\'t generate a primer. Try again?';
  }
}
