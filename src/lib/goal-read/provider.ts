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
  ANTHROPIC_GOAL_MODEL,
  OPENAI_GOAL_MODEL,
} from '@/lib/ai/models';
import type { AiProviderId } from '@/types';
import {
  GOAL_SYSTEM_PROMPT,
  GOAL_TOOL_NAME,
  GOAL_TOOL_SCHEMA,
  buildGoalUserMessage,
} from './prompt';
import {
  type GoalPayload,
  type GoalRange,
  type QuizQuestion,
} from './types';
import { getTextForWordRange } from '@/lib/tokenize';

const MAX_OUTPUT_TOKENS = 4096;
const SUMMARY_MAX_OUTPUT_TOKENS = 1400;
const TEMPERATURE = 0.4;

export type GoalGenerationEvent =
  | { type: 'summary_delta'; delta: string }
  | { type: 'payload'; payload: GoalPayload }
  | { type: 'done' }
  | { type: 'error'; error: string; errorKind: ChatErrorKind };

export interface GoalGenerationOptions {
  apiKey?: string;
  provider?: AiProviderId;
  words: string[];
  range: GoalRange;
  chunks: GoalRange[];
  signal?: AbortSignal;
}

type ResolvedGoalGenerationOptions = Omit<
  GoalGenerationOptions,
  'apiKey' | 'provider'
> & {
  apiKey: string;
  provider: AiProviderId;
};

/**
 * Run a goal-based generation. Streams the summary as `summary_delta` events,
 * then emits a single validated `payload` event.
 */
export async function* streamGoalGeneration(
  opts: GoalGenerationOptions
): AsyncGenerator<GoalGenerationEvent, void, void> {
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

  if (provider === 'openai') {
    yield* streamOpenAIGoalGeneration({ ...opts, apiKey, provider });
    return;
  }

  yield* streamAnthropicGoalGeneration({ ...opts, apiKey, provider });
}

async function* streamAnthropicGoalGeneration(
  opts: ResolvedGoalGenerationOptions
): AsyncGenerator<GoalGenerationEvent, void, void> {
  const { apiKey, words, range, chunks, signal } = opts;

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
        model: ANTHROPIC_GOAL_MODEL,
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

    const payload = parseAndValidateGoalPayload(toolJsonAcc, chunks, range);
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

async function* streamOpenAIGoalGeneration(
  opts: ResolvedGoalGenerationOptions
): AsyncGenerator<GoalGenerationEvent, void, void> {
  const { apiKey, words, range, chunks, signal } = opts;

  const passageText = getTextForWordRange(
    words.join(' '),
    range.startWord,
    range.endWord
  );
  const userMessage = buildGoalUserMessage({ range, passageText, chunks });
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  try {
    const summaryStream = await client.responses.create(
      {
        model: OPENAI_GOAL_MODEL,
        instructions: buildOpenAISummaryInstructions(
          GOAL_SYSTEM_PROMPT,
          GOAL_TOOL_NAME
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
          error: 'OpenAI returned an incomplete primer. Try again?',
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
        model: OPENAI_GOAL_MODEL,
        instructions: buildOpenAIStructuredInstructions(
          GOAL_SYSTEM_PROMPT,
          GOAL_TOOL_NAME
        ),
        input: userMessage,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: 'medium' },
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'glyph_goal_payload',
            strict: true,
            schema: buildGoalPayloadJsonSchema(chunks.length),
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

    const payload = parseAndValidateGoalPayload(
      structuredResponse.output_text,
      chunks,
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

function parseAndValidateGoalPayload(
  jsonText: string,
  chunks: GoalRange[],
  range: GoalRange
):
  | { type: 'payload'; payload: GoalPayload }
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

  const payload = validateToolOutput(parsed, chunks, range);
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
  chunks: GoalRange[],
  goalRange: GoalRange
): GoalPayload | null {
  if (!isPlainObject(raw)) return null;
  const anchors = raw.anchors;
  const chunkBlocks = raw.chunks;
  if (!Array.isArray(anchors) || !Array.isArray(chunkBlocks)) return null;
  if (chunkBlocks.length !== chunks.length) return null;

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
        !Number.isInteger(endWord) ||
        startWord < chunkRange.startWord ||
        endWord > chunkRange.endWord ||
        startWord < goalRange.startWord ||
        endWord > goalRange.endWord ||
        endWord < startWord
      ) {
        continue;
      }

      questions.push({
        id: uuidv4(),
        question,
        choices: normalizedChoices as [string, string, string, string],
        correctIndex: correctIndex as 0 | 1 | 2 | 3,
        source: { startWord, endWord },
        explanation,
      });
    }

    if (questions.length === 0) return null;
    cleanedChunks.push({ miniPrimer, questions });
  }

  return {
    summary: '',
    anchors: cleanedAnchors,
    chunks: cleanedChunks,
  };
}

function buildOpenAISummaryInstructions(
  systemPrompt: string,
  toolName: string
): string {
  return `${systemPrompt}

For this OpenAI streaming call, do not call ${toolName} and do not output JSON. Output only the first prose summary described in the output sequence.`;
}

function buildOpenAIStructuredInstructions(
  systemPrompt: string,
  toolName: string
): string {
  return `${systemPrompt}

For this OpenAI structured-output call, return only the JSON object that would have been passed to ${toolName}. Do not include the prose summary, headings, markdown, or commentary.`;
}

function buildGoalPayloadJsonSchema(chunkCount: number): Record<string, unknown> {
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
      anchors: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { text: { type: 'string' } },
          required: ['text'],
        },
      },
      chunks: {
        type: 'array',
        minItems: chunkCount,
        maxItems: chunkCount,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            miniPrimer: { type: 'string' },
            questions: {
              type: 'array',
              minItems: 1,
              items: questionSchema,
            },
          },
          required: ['miniPrimer', 'questions'],
        },
      },
    },
    required: ['anchors', 'chunks'],
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
      ? "Couldn't generate a primer with OpenAI. Try again?"
      : "Couldn't generate a primer. Try again?"
  );
}
