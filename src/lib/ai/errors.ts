import { ChatError, type ChatErrorKind } from '@/lib/chat/provider';
import type { AiProviderId } from '@/types';
import { AI_PROVIDER_LABELS } from './preferences';

type ProviderErrorShape = {
  status?: number;
  name?: string;
  message?: string;
};

export function classifyProviderError(err: unknown): ChatErrorKind {
  if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
  if (err instanceof ChatError) return err.kind;

  const anyErr = err as ProviderErrorShape;
  if (anyErr?.status === 401 || anyErr?.status === 403) return 'invalid_key';
  if (anyErr?.status === 429) return 'rate_limit';
  if (
    anyErr?.name === 'APIConnectionError' ||
    anyErr?.name === 'APIConnectionTimeoutError' ||
    anyErr?.name === 'APIUserAbortError' ||
    anyErr?.message?.includes('fetch') ||
    anyErr?.message?.includes('Failed to fetch') ||
    anyErr?.message?.includes('NetworkError')
  ) {
    return anyErr?.name === 'APIUserAbortError' ? 'aborted' : 'network';
  }
  return 'unknown';
}

export function providerErrorMessage(
  provider: AiProviderId,
  kind: ChatErrorKind,
  fallback: string
): string {
  const label = AI_PROVIDER_LABELS[provider];
  switch (kind) {
    case 'invalid_key':
      return `Your ${label} API key was rejected. Check it in Settings.`;
    case 'rate_limit':
      return `Rate limited by ${label}. Wait a moment and try again.`;
    case 'network':
      return `Network error reaching ${label}.`;
    case 'aborted':
      return 'Request aborted.';
    default:
      return fallback;
  }
}

