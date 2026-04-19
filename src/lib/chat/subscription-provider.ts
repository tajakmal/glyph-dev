import type { ChatChunk, ChatProvider, ChatStreamOptions } from './provider';

/**
 * Placeholder for the future local/desktop build where chat runs against the
 * user's Claude subscription via the Claude Agent SDK (OAuth). Not wired into
 * the web build — exists so the provider contract stays stable and callsites
 * don't change when the local build lands.
 */
export class SubscriptionProvider implements ChatProvider {
  stream(opts: ChatStreamOptions): AsyncIterable<ChatChunk> {
    void opts;
    throw new Error('Subscription provider not implemented in web build');
  }
}
