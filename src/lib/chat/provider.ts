export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatStreamOptions {
  systemPrompt: string;
  doc: string;
  history: ChatTurn[];
  userMessage: string;
  signal?: AbortSignal;
}

export interface ChatChunk {
  type: 'text' | 'done' | 'error';
  delta?: string;
  error?: string;
  errorKind?: ChatErrorKind;
}

export type ChatErrorKind =
  | 'invalid_key'
  | 'rate_limit'
  | 'network'
  | 'aborted'
  | 'unknown';

export interface ChatProvider {
  stream(opts: ChatStreamOptions): AsyncIterable<ChatChunk>;
}

export class ChatError extends Error {
  kind: ChatErrorKind;
  constructor(kind: ChatErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'ChatError';
  }
}
