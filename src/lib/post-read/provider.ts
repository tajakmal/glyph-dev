import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import type { ChatErrorKind } from '@/lib/chat/provider';
import { classifyProviderError, providerErrorMessage } from '@/lib/ai/errors';
import {
  getAiProviderId,
  getMissingApiKeyMessage,
  getProviderApiKey,
} from '@/lib/ai/preferences';
import {
  ANTHROPIC_POST_READ_MODEL,
  OPENAI_POST_READ_MODEL,
} from '@/lib/ai/models';
import type { AiProviderId } from '@/types';
import {
  POST_READ_SYSTEM_PROMPT,
  POST_READ_TOOL_NAME,
  POST_READ_TOOL_SCHEMA,
  buildPostReadUserMessage,
} from './prompt';
import {
  type PostReadPayload,
  type PostReadQuestion,
  type PostReadRange,
} from './types';
import { getTextForWordRange } from '@/lib/tokenize';

const MAX_OUTPUT_TOKENS = 3072;
const SUMMARY_MAX_OUTPUT_TOKENS = 1200;
const TEMPERATURE = 0.4;

export type PostReadGenerationEvent =
  | { type: 'summary_delta'; delta: string }
  | { type: 'payload'; payload: PostReadPayload }
  | { type: 'done' }
  | { type: 'error'; error: string; errorKind: ChatErrorKind };

export interface PostReadGenerationOptions {
  apiKey?: string;
  provider?: AiProviderId;
  words: string[];
  range: PostReadRange;
  signal?: AbortSignal;
}

type ResolvedPostReadGenerationOptions = Omit<
  PostReadGenerationOptions,
  'apiKey' | 'provider'
> & {
  apiKey: string;
  provider: AiProviderId;
};

/**
 * Stream a post-session recap + quiz. The recap is emitted as
 * `summary_delta` events followed by a single `payload` event with the
 * parsed, validated structured data.
 */
export async function* streamPostReadGeneration(
  opts: PostReadGenerationOptions
): AsyncGenerator<PostReadGenerationEvent, void, void> {
  const provider = opts.provider ?? getAiProviderId();
  const apiKey = opts.apiKey?.trim() || getProviderApiKey(provider);

  if (!apiKey) {
    yield {
      type: 'error',
      error: getMissingApiKeyMessage(provider),
      errorKind: 'invalid_key',
    };
    return;
  }
  if (opts.range.endWord < opts.range.startWord) {
    yield {
      type: 'error',
      error: 'Passage range is empty.',
      errorKind: 'unknown',
    };
    return;
  }

  if (provider === 'openai') {
    yield* streamOpenAIPostReadGeneration({ ...opts, apiKey, provider });
    return;
  }

  yield* streamAnthropicPostReadGeneration({ ...opts, apiKey, provider });
}

async function* streamAnthropicPostReadGeneration(
  opts: ResolvedPostReadGenerationOptions
): AsyncGenerator<PostReadGenerationEvent, void, void> {
  const { apiKey, words, range, signal } = opts;

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
        model: ANTHROPIC_POST_READ_MODEL,
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

    const payload = parseAndValidatePostReadPayload(toolJsonAcc, range);
    if (payload.type === 'error') {
      yield payload;
      return;
    }

    yield { type: 'payload', payload: payload.payload };
    yield { type: 'done' };
  } catch (err) {
    const kind = classifyProviderError(err);
    if (kind === 'aborted') {
      yield { type: 'done' };
      return;
    }
    yield {
      type: 'error',
      error: errorMessage('anthropic', kind),
      errorKind: kind,
    };
  }
}

async function* streamOpenAIPostReadGeneration(
  opts: ResolvedPostReadGenerationOptions
): AsyncGenerator<PostReadGenerationEvent, void, void> {
  const { apiKey, words, range, signal } = opts;

  const passageText = getTextForWordRange(
    words.join(' '),
    range.startWord,
    range.endWord
  );
  const userMessage = buildPostReadUserMessage({ range, passageText });
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  try {
    const summaryStream = await client.responses.create(
      {
        model: OPENAI_POST_READ_MODEL,
        instructions: buildOpenAISummaryInstructions(
          POST_READ_SYSTEM_PROMPT,
          POST_READ_TOOL_NAME
        ),
        input: userMessage,
        max_output_tokens: SUMMARY_MAX_OUTPUT_TOKENS,
        reasoning: { effort: 'medium' },
        text: { verbosity: 'medium' },
        store: false,
        stream: true,
      },
      { signal }
    );

    for await (const event of summaryStream) {
      if (event.type === 'response.output_text.delta') {
        yield { type: 'summary_delta', delta: event.delta };
      } else if (event.type === 'response.failed') {
        yield {
          type: 'error',
          error:
            event.response.error?.message ||
            errorMessage('openai', 'unknown'),
          errorKind: 'unknown',
        };
        return;
      } else if (event.type === 'response.incomplete') {
        yield {
          type: 'error',
          error: 'OpenAI returned an incomplete recap. Try again?',
          errorKind: 'unknown',
        };
        return;
      } else if (event.type === 'error') {
        yield {
          type: 'error',
          error: event.message || errorMessage('openai', 'unknown'),
          errorKind: 'unknown',
        };
        return;
      }
    }

    if (signal?.aborted) {
      yield { type: 'done' };
      return;
    }

    const structuredResponse = await client.responses.create(
      {
        model: OPENAI_POST_READ_MODEL,
        instructions: buildOpenAIStructuredInstructions(
          POST_READ_SYSTEM_PROMPT,
          POST_READ_TOOL_NAME
        ),
        input: userMessage,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: 'medium' },
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'glyph_post_read_payload',
            strict: true,
            schema: buildPostReadPayloadJsonSchema(),
          },
        },
        store: false,
      },
      { signal }
    );

    if (signal?.aborted) {
      yield { type: 'done' };
      return;
    }

    const payload = parseAndValidatePostReadPayload(
      structuredResponse.output_text,
      range
    );
    if (payload.type === 'error') {
      yield payload;
      return;
    }

    yield { type: 'payload', payload: payload.payload };
    yield { type: 'done' };
  } catch (err) {
    const kind = classifyProviderError(err);
    if (kind === 'aborted') {
      yield { type: 'done' };
      return;
    }
    yield {
      type: 'error',
      error: errorMessage('openai', kind),
      errorKind: kind,
    };
  }
}

function parseAndValidatePostReadPayload(
  jsonText: string,
  range: PostReadRange
):
  | { type: 'payload'; payload: PostReadPayload }
  | { type: 'error'; error: string; errorKind: ChatErrorKind } {
  if (!jsonText.trim()) {
    return {
      type: 'error',
      error: 'Model did not return the expected structured payload.',
      errorKind: 'unknown',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      type: 'error',
      error: 'Model returned malformed JSON for the quiz data.',
      errorKind: 'unknown',
    };
  }

  const payload = validateToolOutput(parsed, range);
  if (!payload) {
    return {
      type: 'error',
      error: 'Model returned an invalid quiz structure.',
      errorKind: 'unknown',
    };
  }

  return { type: 'payload', payload };
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
      !Number.isInteger(endWord) ||
      startWord < range.startWord ||
      endWord > range.endWord ||
      endWord < startWord
    ) {
      continue;
    }

    cleanedQuiz.push({
      id: uuidv4(),
      question,
      choices: normalizedChoices as [string, string, string, string],
      correctIndex: correctIndex as 0 | 1 | 2 | 3,
      source: { startWord, endWord },
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

function buildOpenAISummaryInstructions(
  systemPrompt: string,
  toolName: string
): string {
  return `${systemPrompt}

For this OpenAI streaming call, do not call ${toolName} and do not output JSON. Output only the first prose recap described in the output sequence.`;
}

function buildOpenAIStructuredInstructions(
  systemPrompt: string,
  toolName: string
): string {
  return `${systemPrompt}

For this OpenAI structured-output call, return only the JSON object that would have been passed to ${toolName}. Do not include the prose recap, headings, markdown, or commentary.`;
}

function buildPostReadPayloadJsonSchema(): Record<string, unknown> {
  const questionSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      question: { type: 'string' },
      choices: {
        type: 'array',
        items: { type: 'string' },
        minItems: 4,
        maxItems: 4,
      },
      correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
      sourceStartWord: { type: 'integer', minimum: 0 },
      sourceEndWord: { type: 'integer', minimum: 0 },
      explanation: { type: 'string' },
    },
    required: [
      'question',
      'choices',
      'correctIndex',
      'sourceStartWord',
      'sourceEndWord',
      'explanation',
    ],
  };

  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      keyQuestions: {
        type: 'array',
        items: { type: 'string' },
      },
      quiz: {
        type: 'array',
        minItems: 1,
        items: questionSchema,
      },
    },
    required: ['keyQuestions', 'quiz'],
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function errorMessage(provider: AiProviderId, kind: ChatErrorKind): string {
  return providerErrorMessage(
    provider,
    kind,
    provider === 'openai'
      ? "Couldn't generate a quiz with OpenAI. Try again?"
      : "Couldn't generate a quiz. Try again?"
  );
}
