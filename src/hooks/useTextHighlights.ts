'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Highlight, HighlightColor, TextHighlight } from '@/types';
import { VALIDATION } from '@/types';
import {
  getHighlights,
  setHighlights,
  getHighlightsForDocument,
} from '@/lib/storage';
import { getSyncQueue } from '@/lib/sync/queue';
import { getFeatureFlag } from '@/lib/feature-flags';

interface UseTextHighlightsOptions {
  documentId: string;
  /** Word array for the document, used to rebuild text when merging highlights */
  words?: string[];
}

interface UseTextHighlightsReturn {
  /** Text highlights for this document */
  highlights: TextHighlight[];
  /** Add a text highlight (handles merging with overlapping highlights) */
  addHighlight: (data: {
    startWord: number;
    endWord: number;
    text: string;
    color: HighlightColor;
    note?: string;
  }) => TextHighlight;
  /** Remove a highlight */
  removeHighlight: (id: string) => void;
  /** Update highlight note */
  updateHighlightNote: (id: string, note: string) => void;
  /** Update highlight color */
  updateHighlightColor: (id: string, color: HighlightColor) => void;
  /** Get highlight at a specific word index */
  getHighlightAtWord: (wordIndex: number) => TextHighlight | null;
}

const HIGHLIGHTS_CHANGED_EVENT = 'glyph:highlights-changed';

function notifyHighlightsChanged(documentId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(HIGHLIGHTS_CHANGED_EVENT, { detail: { documentId } })
  );
}

// Type guard for text highlights
function isTextHighlight(highlight: Highlight): highlight is TextHighlight {
  return highlight.kind === 'text';
}

// Get text highlights for a document
function getDocumentTextHighlights(documentId: string): TextHighlight[] {
  return getHighlightsForDocument(documentId).filter(isTextHighlight);
}

/**
 * Check if two word ranges overlap or are adjacent.
 * Ranges are inclusive: [startWord, endWord]
 */
function rangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  // Ranges overlap if one starts before or at the other's end
  // We consider adjacent ranges (end + 1 === start) as overlapping for merging
  return start1 <= end2 + 1 && start2 <= end1 + 1;
}

/**
 * Merge overlapping highlights according to PRD rules:
 * - New range = union of overlapping ranges
 * - Color = newly selected color
 * - Notes:
 *   - If new highlight has a note, use it
 *   - Else if exactly one overlapping highlight has a note, keep that note
 *   - Else if multiple overlapping highlights have notes, concatenate with blank line
 *     and truncate to MAX_NOTE_LENGTH
 */
function mergeHighlights(
  newHighlight: {
    startWord: number;
    endWord: number;
    text: string;
    color: HighlightColor;
    note?: string;
  },
  existingHighlights: TextHighlight[],
  documentId: string,
  words: string[]
): { merged: TextHighlight; toRemove: string[] } {
  // Find all overlapping highlights
  const overlapping = existingHighlights.filter((h) =>
    rangesOverlap(newHighlight.startWord, newHighlight.endWord, h.startWord, h.endWord)
  );

  if (overlapping.length === 0) {
    // No overlaps, create new highlight
    const highlight: TextHighlight = {
      id: uuidv4(),
      documentId,
      kind: 'text',
      startWord: newHighlight.startWord,
      endWord: newHighlight.endWord,
      text: newHighlight.text,
      color: newHighlight.color,
      note: newHighlight.note,
      createdAt: Date.now(),
    };
    return { merged: highlight, toRemove: [] };
  }

  // Calculate merged range (union of all overlapping ranges + new range)
  let minStart = newHighlight.startWord;
  let maxEnd = newHighlight.endWord;
  for (const h of overlapping) {
    minStart = Math.min(minStart, h.startWord);
    maxEnd = Math.max(maxEnd, h.endWord);
  }

  // Build merged text from word array if available, otherwise concatenate
  let mergedText: string;
  if (words.length > 0) {
    mergedText = words.slice(minStart, maxEnd + 1).join(' ');
  } else {
    // Fallback: use the new highlight's text (range might be smaller than merged)
    mergedText = newHighlight.text;
  }

  // Determine merged note
  let mergedNote: string | undefined;
  if (newHighlight.note) {
    // New highlight has a note, use it
    mergedNote = newHighlight.note;
  } else {
    // Collect notes from overlapping highlights
    const existingNotes = overlapping
      .map((h) => h.note)
      .filter((n): n is string => !!n);

    if (existingNotes.length === 1) {
      mergedNote = existingNotes[0];
    } else if (existingNotes.length > 1) {
      mergedNote = existingNotes.join('\n\n').slice(0, VALIDATION.MAX_NOTE_LENGTH);
    }
  }

  const merged: TextHighlight = {
    id: uuidv4(),
    documentId,
    kind: 'text',
    startWord: minStart,
    endWord: maxEnd,
    text: mergedText,
    color: newHighlight.color,
    note: mergedNote,
    createdAt: Date.now(),
  };

  return {
    merged,
    toRemove: overlapping.map((h) => h.id),
  };
}

export function useTextHighlights({
  documentId,
  words = [],
}: UseTextHighlightsOptions): UseTextHighlightsReturn {
  // Use lazy initializer to load highlights synchronously on first render
  const [highlights, setLocalHighlights] = useState<TextHighlight[]>(() =>
    getDocumentTextHighlights(documentId)
  );

  // Re-sync when documentId changes
  const currentDocId = useMemo(() => documentId, [documentId]);
  const [lastDocId, setLastDocId] = useState(documentId);

  const enqueueSync = useCallback((op: {
    id: string;
    type: 'UPSERT_HIGHLIGHT' | 'DELETE_HIGHLIGHT';
    payload: unknown;
  }) => {
    const queue = getSyncQueue();
    queue.enqueue({
      id: op.id,
      type: op.type,
      documentId,
      payload: op.payload,
    });
    if (getFeatureFlag('sync_enabled')) {
      void queue.flush();
    }
  }, [documentId]);

  if (currentDocId !== lastDocId) {
    setLastDocId(currentDocId);
    setLocalHighlights(getDocumentTextHighlights(currentDocId));
  }

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.documentId === documentId) {
        setLocalHighlights(getDocumentTextHighlights(documentId));
      }
    };
    window.addEventListener(HIGHLIGHTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(HIGHLIGHTS_CHANGED_EVENT, handler);
  }, [documentId]);

  const addHighlight = useCallback(
    (data: {
      startWord: number;
      endWord: number;
      text: string;
      color: HighlightColor;
      note?: string;
    }): TextHighlight => {
      // Get current highlights for merging
      const currentHighlights = getDocumentTextHighlights(documentId);

      // Merge with any overlapping highlights
      const { merged, toRemove } = mergeHighlights(
        data,
        currentHighlights,
        documentId,
        words
      );

      // Update localStorage
      const allHighlights = getHighlights();
      const filteredHighlights = allHighlights.filter(
        (h) => !toRemove.includes(h.id)
      );
      filteredHighlights.push(merged);
      setHighlights(filteredHighlights);

      // Update local state
      setLocalHighlights((prev) => {
        const filtered = prev.filter((h) => !toRemove.includes(h.id));
        return [...filtered, merged];
      });
      enqueueSync({
        id: `highlight-upsert:${merged.id}:${Date.now()}`,
        type: 'UPSERT_HIGHLIGHT',
        payload: merged,
      });
      notifyHighlightsChanged(documentId);

      return merged;
    },
    [documentId, words, enqueueSync]
  );

  const removeHighlight = useCallback((id: string) => {
    // Update localStorage
    const allHighlights = getHighlights();
    setHighlights(allHighlights.filter((h) => h.id !== id));

    // Update local state
    setLocalHighlights((prev) => prev.filter((h) => h.id !== id));
    enqueueSync({
      id: `highlight-delete:${id}:${Date.now()}`,
      type: 'DELETE_HIGHLIGHT',
      payload: { id },
    });
    notifyHighlightsChanged(documentId);
  }, [documentId, enqueueSync]);

  const updateHighlightNote = useCallback((id: string, note: string) => {
    // Validate note length
    const safeNote = note.slice(0, VALIDATION.MAX_NOTE_LENGTH);

    // Update localStorage
    const allHighlights = getHighlights();
    const index = allHighlights.findIndex((h) => h.id === id);
    if (index !== -1) {
      allHighlights[index].note = safeNote;
      allHighlights[index].updatedAt = Date.now();
      setHighlights(allHighlights);
    }

    // Update local state
    setLocalHighlights((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, note: safeNote, updatedAt: Date.now() } : h
      )
    );
    enqueueSync({
      id: `highlight-upsert:${id}:${Date.now()}`,
      type: 'UPSERT_HIGHLIGHT',
      payload: { id, note: safeNote },
    });
    notifyHighlightsChanged(documentId);
  }, [documentId, enqueueSync]);

  const updateHighlightColor = useCallback((id: string, color: HighlightColor) => {
    // Update localStorage
    const allHighlights = getHighlights();
    const index = allHighlights.findIndex((h) => h.id === id);
    if (index !== -1) {
      allHighlights[index].color = color;
      allHighlights[index].updatedAt = Date.now();
      setHighlights(allHighlights);
    }

    // Update local state
    setLocalHighlights((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, color, updatedAt: Date.now() } : h
      )
    );
    enqueueSync({
      id: `highlight-upsert:${id}:${Date.now()}`,
      type: 'UPSERT_HIGHLIGHT',
      payload: { id, color },
    });
    notifyHighlightsChanged(documentId);
  }, [documentId, enqueueSync]);

  const getHighlightAtWord = useCallback(
    (wordIndex: number): TextHighlight | null => {
      return (
        highlights.find(
          (h) => wordIndex >= h.startWord && wordIndex <= h.endWord
        ) || null
      );
    },
    [highlights]
  );

  return {
    highlights,
    addHighlight,
    removeHighlight,
    updateHighlightNote,
    updateHighlightColor,
    getHighlightAtWord,
  };
}
