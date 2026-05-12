import { BYOKProvider } from './byok-provider';
import { OpenAIChatProvider, testOpenAIApiKey } from './openai-provider';
import type { ChatProvider } from './provider';
import type { AiProviderId } from '@/types';
import {
  getAiProviderId,
  getProviderApiKey,
  setProviderApiKey,
} from '@/lib/ai/preferences';
import { testApiKey as testAnthropicApiKey } from './byok-provider';

export const CHAT_SYSTEM_PROMPT =
  'You are a reading companion helping a reader understand a specific document. Quote or reference the document when useful. Be concise and direct.';

export function getApiKey(): string | null {
  return getProviderApiKey();
}

export function setApiKey(apiKey: string | null): void {
  setProviderApiKey(getAiProviderId(), apiKey);
}

export function getChatProvider(): ChatProvider | null {
  const provider = getAiProviderId();
  const key = getProviderApiKey(provider);
  if (!key) return null;
  return provider === 'openai' ? new OpenAIChatProvider(key) : new BYOKProvider(key);
}

export async function testProviderApiKey(
  provider: AiProviderId,
  apiKey: string
): Promise<void> {
  if (provider === 'openai') {
    await testOpenAIApiKey(apiKey);
  } else {
    await testAnthropicApiKey(apiKey);
  }
}

export type { ChatProvider, ChatTurn, ChatChunk, ChatErrorKind } from './provider';
export { ChatError } from './provider';
export { testApiKey } from './byok-provider';
export {
  AI_PROVIDER_IDS,
  AI_PROVIDER_LABELS,
  getAiProviderId,
  getProviderApiKey,
  setAiProviderId,
  setProviderApiKey,
  hasActiveProviderApiKey,
  getMissingApiKeyMessage,
} from '@/lib/ai/preferences';
