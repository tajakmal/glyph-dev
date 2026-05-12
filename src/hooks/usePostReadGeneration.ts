'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAiProviderId,
  getMissingApiKeyMessage,
  getProviderApiKey,
} from '@/lib/chat';
import { streamPostReadGeneration } from '@/lib/post-read/provider';
import type {
  PostReadPayload,
  PostReadRange,
} from '@/lib/post-read/types';

export interface UsePostReadGenerationState {
  streaming: boolean;
  summaryText: string;
  payload: PostReadPayload | null;
  error: string | null;
}

export interface UsePostReadGenerationActions {
  start: (opts: { words: string[]; range: PostReadRange }) => void;
  reset: () => void;
  abort: () => void;
}

export function usePostReadGeneration(): UsePostReadGenerationState &
  UsePostReadGenerationActions {
  const [streaming, setStreaming] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [payload, setPayload] = useState<PostReadPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const summaryBufferRef = useRef('');

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abort();
    summaryBufferRef.current = '';
    setSummaryText('');
    setPayload(null);
    setError(null);
    setStreaming(false);
  }, [abort]);

  const start = useCallback<UsePostReadGenerationActions['start']>(
    ({ words, range }) => {
      const provider = getAiProviderId();
      const apiKey = getProviderApiKey(provider);
      if (!apiKey) {
        setError(getMissingApiKeyMessage(provider));
        return;
      }
      if (range.endWord < range.startWord) {
        setError('Nothing to quiz on — the read range is empty.');
        return;
      }

      abort();
      summaryBufferRef.current = '';
      setSummaryText('');
      setPayload(null);
      setError(null);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      (async () => {
        try {
          const iter = streamPostReadGeneration({
            provider,
            apiKey,
            words,
            range,
            signal: controller.signal,
          });

          for await (const event of iter) {
            if (event.type === 'summary_delta') {
              summaryBufferRef.current += event.delta;
              setSummaryText(summaryBufferRef.current);
            } else if (event.type === 'payload') {
              const finalPayload: PostReadPayload = {
                ...event.payload,
                summary: summaryBufferRef.current.trim(),
              };
              setPayload(finalPayload);
            } else if (event.type === 'error') {
              setError(event.error);
              break;
            } else if (event.type === 'done') {
              break;
            }
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            // Silent — caller aborted.
          } else {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        } finally {
          setStreaming(false);
          if (abortRef.current === controller) {
            abortRef.current = null;
          }
        }
      })();
    },
    [abort]
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    streaming,
    summaryText,
    payload,
    error,
    start,
    reset,
    abort,
  };
}
