'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiKey } from '@/lib/chat';
import { streamGoalGeneration } from '@/lib/goal-read/provider';
import type {
  GoalPayload,
  GoalRange,
} from '@/lib/goal-read/types';

export interface UseGoalGenerationState {
  /** True while the network request is open. */
  streaming: boolean;
  /** Summary prose, built up from streamed text deltas. */
  summaryText: string;
  /** Final structured payload (with the summary hydrated). Null until tool call resolves. */
  payload: GoalPayload | null;
  /** User-facing error message, or null. */
  error: string | null;
}

export interface UseGoalGenerationActions {
  /** Start or restart a generation. Cancels any in-flight request first. */
  start: (opts: { words: string[]; range: GoalRange; chunks: GoalRange[] }) => void;
  /** Abort the active request and clear state. */
  reset: () => void;
  /** Abort the active request (keeps state intact). */
  abort: () => void;
}

export function useGoalGeneration(): UseGoalGenerationState & UseGoalGenerationActions {
  const [streaming, setStreaming] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [payload, setPayload] = useState<GoalPayload | null>(null);
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

  const start = useCallback<UseGoalGenerationActions['start']>(
    ({ words, range, chunks }) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        setError('Add your Anthropic API key in Settings.');
        return;
      }
      if (chunks.length === 0 || range.endWord < range.startWord) {
        setError('The goal range is empty.');
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
          const iter = streamGoalGeneration({
            apiKey,
            words,
            range,
            chunks,
            signal: controller.signal,
          });

          for await (const event of iter) {
            if (event.type === 'summary_delta') {
              summaryBufferRef.current += event.delta;
              setSummaryText(summaryBufferRef.current);
            } else if (event.type === 'payload') {
              const finalPayload: GoalPayload = {
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
          if (
            err instanceof DOMException &&
            err.name === 'AbortError'
          ) {
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

  // Abort on unmount
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
