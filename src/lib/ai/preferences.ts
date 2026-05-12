import type { AiProviderId } from '@/types';
import { getPreferences, setPreferences } from '@/lib/storage';

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

export const AI_PROVIDER_IDS = ['anthropic', 'openai'] as const satisfies readonly AiProviderId[];

export function normalizeAiProviderId(provider: unknown): AiProviderId {
  return provider === 'openai' ? 'openai' : 'anthropic';
}

export function getAiProviderId(): AiProviderId {
  return normalizeAiProviderId(getPreferences().aiProvider);
}

export function setAiProviderId(provider: AiProviderId): void {
  const prefs = getPreferences();
  setPreferences({
    ...prefs,
    aiProvider: provider,
  });
}

export function getProviderApiKey(provider: AiProviderId = getAiProviderId()): string | null {
  const prefs = getPreferences();
  const key =
    provider === 'anthropic' ? prefs.anthropicApiKey : prefs.openaiApiKey;
  const trimmed = key?.trim();
  return trimmed ? trimmed : null;
}

export function setProviderApiKey(
  provider: AiProviderId,
  apiKey: string | null
): void {
  const prefs = getPreferences();
  const trimmed = apiKey?.trim();
  setPreferences({
    ...prefs,
    [provider === 'anthropic' ? 'anthropicApiKey' : 'openaiApiKey']:
      trimmed || undefined,
  });
}

export function hasActiveProviderApiKey(): boolean {
  return !!getProviderApiKey(getAiProviderId());
}

export function getMissingApiKeyMessage(provider: AiProviderId = getAiProviderId()): string {
  return `Add an ${AI_PROVIDER_LABELS[provider]} API key in Settings.`;
}

