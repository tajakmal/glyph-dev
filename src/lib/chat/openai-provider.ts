import OpenAI from 'openai';
import type {
  ChatChunk,
  ChatProvider,
  ChatStreamOptions,
  ChatErrorKind,
} from './provider';
import { ChatError } from './provider';
import { classifyProviderError, providerErrorMessage } from '@/lib/ai/errors';
import { OPENAI_CHAT_MODEL } from '@/lib/ai/models';

const MAX_OUTPUT_TOKENS = 1024;
const HISTORY_TURN_CAP = 6;

function errorMessage(kind: ChatErrorKind): string {
  return providerErrorMessage(
    'openai',
    kind,
    'Something went wrong talking to OpenAI.'
  );
}

export class OpenAIChatProvider implements ChatProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = OPENAI_CHAT_MODEL) {
    if (!apiKey) throw new ChatError('invalid_key', 'No API key provided');
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
  }

  async *stream(opts: ChatStreamOptions): AsyncIterable<ChatChunk> {
    const history = opts.history.slice(-HISTORY_TURN_CAP);

    try {
      const stream = await this.client.responses.create(
        {
          model: this.model,
          instructions: `${opts.systemPrompt}\n\nKeep answers concise and directly tied to the document.`,
          input: [
            {
              role: 'user',
              content: `<document>\n${opts.doc}\n</document>`,
            },
            ...history.map((turn) => ({
              role: turn.role,
              content: turn.content,
            })),
            {
              role: 'user',
              content: opts.userMessage,
            },
          ],
          max_output_tokens: MAX_OUTPUT_TOKENS,
          reasoning: { effort: 'low' },
          text: { verbosity: 'low' },
          store: false,
          stream: true,
        },
        { signal: opts.signal }
      );

      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          yield { type: 'text', delta: event.delta };
        } else if (event.type === 'response.failed') {
          const message = event.response.error?.message;
          yield {
            type: 'error',
            error: message || errorMessage('unknown'),
            errorKind: 'unknown',
          };
          return;
        } else if (event.type === 'response.incomplete') {
          yield {
            type: 'error',
            error: 'OpenAI returned an incomplete response. Try again?',
            errorKind: 'unknown',
          };
          return;
        } else if (event.type === 'error') {
          yield {
            type: 'error',
            error: event.message || errorMessage('unknown'),
            errorKind: 'unknown',
          };
          return;
        }
      }
      yield { type: 'done' };
    } catch (err) {
      const kind = classifyProviderError(err);
      if (kind === 'aborted') {
        yield { type: 'done' };
        return;
      }
      yield { type: 'error', error: errorMessage(kind), errorKind: kind };
    }
  }
}

export async function testOpenAIApiKey(apiKey: string): Promise<void> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  try {
    await client.responses.create({
      model: OPENAI_CHAT_MODEL,
      input: 'Say OK.',
      max_output_tokens: 16,
      store: false,
      text: { verbosity: 'low' },
    });
  } catch (err) {
    const kind = classifyProviderError(err);
    throw new ChatError(kind, errorMessage(kind));
  }
}

