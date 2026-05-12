import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatChunk,
  ChatProvider,
  ChatStreamOptions,
  ChatErrorKind,
} from './provider';
import { ChatError } from './provider';
import { classifyProviderError, providerErrorMessage } from '@/lib/ai/errors';
import { ANTHROPIC_CHAT_MODEL } from '@/lib/ai/models';

export const DEFAULT_MODEL = ANTHROPIC_CHAT_MODEL;
const MAX_OUTPUT_TOKENS = 1024;
const HISTORY_TURN_CAP = 6;
// Haiku prompt-cache minimum is 2048 tokens; ~4 chars/token → 8192 char threshold.
const CACHE_MIN_CHARS = 8192;

function classifyError(err: unknown): ChatErrorKind {
  return classifyProviderError(err);
}

function errorMessage(kind: ChatErrorKind): string {
  return providerErrorMessage(
    'anthropic',
    kind,
    'Something went wrong talking to Anthropic.'
  );
}

export class BYOKProvider implements ChatProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    if (!apiKey) throw new ChatError('invalid_key', 'No API key provided');
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
  }

  async *stream(opts: ChatStreamOptions): AsyncIterable<ChatChunk> {
    const history = opts.history.slice(-HISTORY_TURN_CAP);
    const docBlock =
      opts.doc.length >= CACHE_MIN_CHARS
        ? {
            type: 'text' as const,
            text: `<document>\n${opts.doc}\n</document>`,
            cache_control: { type: 'ephemeral' as const },
          }
        : {
            type: 'text' as const,
            text: `<document>\n${opts.doc}\n</document>`,
          };

    try {
      const stream = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: opts.systemPrompt,
          messages: [
            ...history.map((t) => ({ role: t.role, content: t.content })),
            {
              role: 'user' as const,
              content: [docBlock, { type: 'text' as const, text: opts.userMessage }],
            },
          ],
          stream: true,
        },
        { signal: opts.signal }
      );

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'text', delta: event.delta.text };
        }
      }
      yield { type: 'done' };
    } catch (err) {
      const kind = classifyError(err);
      if (kind === 'aborted') {
        yield { type: 'done' };
        return;
      }
      yield { type: 'error', error: errorMessage(kind), errorKind: kind };
    }
  }
}

export async function testApiKey(apiKey: string): Promise<void> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
  } catch (err) {
    const kind = classifyError(err);
    throw new ChatError(kind, errorMessage(kind));
  }
}
