import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { ChatError, type ChatErrorKind } from '@/lib/chat/provider';
import {
  POST_READ_SYSTEM_PROMPT,
  POST_READ_TOOL_NAME,
  POST_READ_TOOL_SCHEMA,
  buildPostReadUserMessage,
} from './prompt';
import {
  POST_READ_MODEL,
  type PostReadPayload,
  type PostReadQuestion,
  type PostReadRange,
} from './types';
import { getTextForWordRange } from '@/lib/tokenize';

const MAX_OUTPUT_TOKENS = 3072;
const TEMPERATURE = 0.4;

export type PostReadGenerationEvent =
  | { type: 'summary_delta'; delta: string }
  | { type: 'payload'; payload: PostReadPayload }
  | { type: 'done' }
  | { type: 'error'; error: string; errorKind: ChatErrorKind };

export interface PostReadGenerationOptions {
  apiKey: string;
  words: string[];
  range: PostReadRange;
  signal?: AbortSignal;
}

/**
 * Stream a post-session recap + quiz. The recap is emitted as
 * `summary_delta` events followed by a single `payload` event with the
 * parsed, validated structured data.
 */
export async function* streamPostReadGeneration(
  opts: PostReadGenerationOptions
): AsyncGenerator<PostReadGenerationEvent, void, void> {
  const { apiKey, words, range, signal } = opts;
  if (!apiKey) {
    yield {
      type: 'error',
      error: 'Missing Anthropic API key.',
      errorKind: 'invalid_key',
    };
    return;
  }
  if (range.endWord < range.startWord) {
    yield {
      type: 'error',
      error: 'Passage range is empty.',
      errorKind: 'unknown',
    };
    return;
  }

  const passageText = getTextForWordRange(
    words.join(' '),
    range.startWord,
    range.endWord
  );

  const userMessage = buildPostReadUserMessage({ range, passageText });

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  let toolJsonAcc = '';
  let toolBlockStarted = false;

  try {
    const stream = await client.messages.create(
      {
        model: POST_READ_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
        system: [
          {
            type: 'text',
            text: POST_READ_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [POST_READ_TOOL_SCHEMA],
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
        if (block.type === 'tool_use' && block.name === POST_READ_TOOL_NAME) {
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

    const payload = validateToolOutput(parsed, range);
    if (!payload) {
      yield {
        type: 'error',
        error: 'Model returned an invalid quiz structure.',
        errorKind: 'unknown',
      };
      return;
    }

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
  range: PostReadRange
): PostReadPayload | null {
  if (!isPlainObject(raw)) return null;
  const keyQuestions = raw.keyQuestions;
  const quizItems = raw.quiz;
  if (!Array.isArray(keyQuestions) || !Array.isArray(quizItems)) return null;

  const cleanedKey: string[] = [];
  for (const k of keyQuestions) {
    if (typeof k === 'string' && k.trim()) cleanedKey.push(k.trim());
  }

  const cleanedQuiz: PostReadQuestion[] = [];
  for (const q of quizItems) {
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

    const clampedStart = clamp(startWord, range.startWord, range.endWord);
    const clampedEnd = clamp(endWord, clampedStart, range.endWord);

    cleanedQuiz.push({
      id: uuidv4(),
      question,
      choices: normalizedChoices as [string, string, string, string],
      correctIndex: correctIndex as 0 | 1 | 2 | 3,
      source: { startWord: clampedStart, endWord: clampedEnd },
      explanation,
    });
  }

  if (cleanedQuiz.length === 0) return null;

  return {
    summary: '',
    keyQuestions: cleanedKey,
    quiz: cleanedQuiz,
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
      return "Couldn't generate a quiz. Try again?";
  }
}
