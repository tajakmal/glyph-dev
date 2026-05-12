'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getChatProvider,
  getMissingApiKeyMessage,
  CHAT_SYSTEM_PROMPT,
} from '@/lib/chat';
import type { ChatTurn } from '@/lib/chat';

export interface DisplayTurn {
  role: 'user' | 'assistant';
  content: string;
  quote?: string;
  streaming?: boolean;
  errored?: boolean;
}

interface ChatSession {
  turns: DisplayTurn[];
}

const sessions = new Map<string, ChatSession>();

function getSession(documentId: string): ChatSession {
  let session = sessions.get(documentId);
  if (!session) {
    session = { turns: [] };
    sessions.set(documentId, session);
  }
  return session;
}

function formatUserContent(quote: string | undefined, question: string): string {
  if (!quote) return question;
  return `From the text:\n> ${quote.trim().replace(/\n+/g, ' ')}\n\n${question}`;
}

export function useChat(documentId: string, docText: string | null) {
  const [turns, setTurns] = useState<DisplayTurn[]>(() => getSession(documentId).turns);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setTurns(getSession(documentId).turns);
    setError(null);
  }, [documentId]);

  const commitTurns = useCallback(
    (updater: (prev: DisplayTurn[]) => DisplayTurn[]) => {
      setTurns((prev) => {
        const next = updater(prev);
        sessions.set(documentId, { turns: next });
        return next;
      });
    },
    [documentId]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(
    async (question: string, quote?: string) => {
      if (!docText) {
        setError('Document not ready.');
        return;
      }
      const provider = getChatProvider();
      if (!provider) {
        setError(getMissingApiKeyMessage());
        return;
      }
      setError(null);

      const userTurn: DisplayTurn = {
        role: 'user',
        content: question,
        quote: quote?.trim() || undefined,
      };
      const assistantTurn: DisplayTurn = {
        role: 'assistant',
        content: '',
        streaming: true,
      };

      commitTurns((prev) => [...prev, userTurn, assistantTurn]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // Build API history from committed display turns (excluding the new ones).
      const session = getSession(documentId);
      const priorDisplay = session.turns.slice(0, session.turns.length - 2);
      const apiHistory: ChatTurn[] = priorDisplay
        .filter((t) => !t.errored)
        .map((t) => ({
          role: t.role,
          content:
            t.role === 'user' ? formatUserContent(t.quote, t.content) : t.content,
        }));

      const userMessage = formatUserContent(userTurn.quote, userTurn.content);

      try {
        const iter = provider.stream({
          systemPrompt: CHAT_SYSTEM_PROMPT,
          doc: docText,
          history: apiHistory,
          userMessage,
          signal: controller.signal,
        });

        for await (const chunk of iter) {
          if (chunk.type === 'text' && chunk.delta) {
            const delta = chunk.delta;
            commitTurns((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, content: last.content + delta };
              }
              return next;
            });
          } else if (chunk.type === 'error') {
            commitTurns((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === 'assistant') {
                next[next.length - 1] = {
                  ...last,
                  content: chunk.error || 'Error',
                  streaming: false,
                  errored: true,
                };
              }
              return next;
            });
            setError(chunk.error || 'Error');
            break;
          } else if (chunk.type === 'done') {
            break;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
      } finally {
        commitTurns((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant' && last.streaming) {
            next[next.length - 1] = { ...last, streaming: false };
          }
          return next;
        });
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [commitTurns, docText, documentId]
  );

  const reset = useCallback(() => {
    abort();
    commitTurns(() => []);
    setError(null);
  }, [abort, commitTurns]);

  return { turns, streaming, error, send, reset, abort };
}
