import { getPreferences, setPreferences } from '@/lib/storage';
import { BYOKProvider } from './byok-provider';
import type { ChatProvider } from './provider';

export const CHAT_SYSTEM_PROMPT =
  'You are a reading companion helping a reader understand a specific document. Quote or reference the document when useful. Be concise and direct.';

export function getApiKey(): string | null {
  const prefs = getPreferences();
  const key = prefs.anthropicApiKey?.trim();
  return key ? key : null;
}

export function setApiKey(apiKey: string | null): void {
  const prefs = getPreferences();
  const trimmed = apiKey?.trim();
  setPreferences({
    ...prefs,
    anthropicApiKey: trimmed || undefined,
  });
}

export function getChatProvider(): ChatProvider | null {
  const key = getApiKey();
  if (!key) return null;
  return new BYOKProvider(key);
}

export type { ChatProvider, ChatTurn, ChatChunk, ChatErrorKind } from './provider';
export { ChatError } from './provider';
export { testApiKey } from './byok-provider';
