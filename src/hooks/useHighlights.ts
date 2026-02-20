'use client';

import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Highlight, HighlightColor, PDFHighlight } from '@/types';
import { VALIDATION } from '@/types';
import {
  getHighlights,
  setHighlights,
  getHighlightsForDocument,
} from '@/lib/storage';
import { getSyncQueue } from '@/lib/sync/queue';
import { getFeatureFlag } from '@/lib/feature-flags';

interface UseHighlightsOptions {
  documentId: string;
}

interface UseHighlightsReturn {
  /** Highlights for this document */
  highlights: PDFHighlight[];
  /** Highlights grouped by page */
  highlightsByPage: Map<number, PDFHighlight[]>;
  /** Add a highlight */
  addHighlight: (highlight: Omit<PDFHighlight, 'id' | 'createdAt' | 'kind'>) => PDFHighlight;
  /** Remove a highlight */
  removeHighlight: (id: string) => void;
  /** Update highlight note */
  updateHighlightNote: (id: string, note: string) => void;
  /** Update highlight color */
  updateHighlightColor: (id: string, color: HighlightColor) => void;
  /** Get highlights for a specific page */
  getHighlightsForPage: (page: number) => PDFHighlight[];
}

// Helper to get highlights for a document
function isPDFHighlight(highlight: Highlight): highlight is PDFHighlight {
  const kind = (highlight as { kind?: string }).kind;
  const page = (highlight as { page?: unknown }).page;
  return (kind === 'pdf' || kind == null) && typeof page === 'number';
}

function getDocumentHighlights(documentId: string): PDFHighlight[] {
  return getHighlightsForDocument(documentId).filter(isPDFHighlight);
}

export function useHighlights({ documentId }: UseHighlightsOptions): UseHighlightsReturn {
  // Use lazy initializer to load highlights synchronously on first render
  const [highlights, setLocalHighlights] = useState<PDFHighlight[]>(() =>
    getDocumentHighlights(documentId)
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
    setLocalHighlights(getDocumentHighlights(currentDocId));
  }

  // Compute highlights by page
  const highlightsByPage = useMemo(() => {
    const map = new Map<number, PDFHighlight[]>();
    highlights.forEach(h => {
      if (!map.has(h.page)) {
        map.set(h.page, []);
      }
      map.get(h.page)!.push(h);
    });
    return map;
  }, [highlights]);

  const addHighlight = useCallback((
    data: Omit<PDFHighlight, 'id' | 'createdAt' | 'kind'>
  ): PDFHighlight => {
    const highlight: PDFHighlight = {
      ...data,
      kind: 'pdf',
      id: uuidv4(),
      createdAt: Date.now(),
    };

    // Update localStorage
    const allHighlights = getHighlights();
    allHighlights.push(highlight);
    setHighlights(allHighlights);

    // Update local state
    setLocalHighlights(prev => [...prev, highlight]);
    enqueueSync({
      id: `highlight-upsert:${highlight.id}:${Date.now()}`,
      type: 'UPSERT_HIGHLIGHT',
      payload: highlight,
    });

    return highlight;
  }, [enqueueSync]);

  const removeHighlight = useCallback((id: string) => {
    // Update localStorage
    const allHighlights = getHighlights();
    setHighlights(allHighlights.filter(h => h.id !== id));

    // Update local state
    setLocalHighlights(prev => prev.filter(h => h.id !== id));
    enqueueSync({
      id: `highlight-delete:${id}:${Date.now()}`,
      type: 'DELETE_HIGHLIGHT',
      payload: { id },
    });
  }, [enqueueSync]);

  const updateHighlightNote = useCallback((id: string, note: string) => {
    // Validate note length
    const safeNote = note.slice(0, VALIDATION.MAX_NOTE_LENGTH);

    // Update localStorage
    const allHighlights = getHighlights();
    const index = allHighlights.findIndex(h => h.id === id);
    if (index !== -1) {
      allHighlights[index].note = safeNote;
      allHighlights[index].updatedAt = Date.now();
      setHighlights(allHighlights);
    }

    // Update local state
    setLocalHighlights(prev =>
      prev.map(h => (h.id === id ? { ...h, note: safeNote, updatedAt: Date.now() } : h))
    );
    enqueueSync({
      id: `highlight-upsert:${id}:${Date.now()}`,
      type: 'UPSERT_HIGHLIGHT',
      payload: { id, note: safeNote },
    });
  }, [enqueueSync]);

  const updateHighlightColor = useCallback((id: string, color: HighlightColor) => {
    // Update localStorage
    const allHighlights = getHighlights();
    const index = allHighlights.findIndex(h => h.id === id);
    if (index !== -1) {
      allHighlights[index].color = color;
      allHighlights[index].updatedAt = Date.now();
      setHighlights(allHighlights);
    }

    // Update local state
    setLocalHighlights(prev =>
      prev.map(h => (h.id === id ? { ...h, color, updatedAt: Date.now() } : h))
    );
    enqueueSync({
      id: `highlight-upsert:${id}:${Date.now()}`,
      type: 'UPSERT_HIGHLIGHT',
      payload: { id, color },
    });
  }, [enqueueSync]);

  const getHighlightsForPage = useCallback((page: number): PDFHighlight[] => {
    return highlights.filter(h => h.page === page);
  }, [highlights]);

  return {
    highlights,
    highlightsByPage,
    addHighlight,
    removeHighlight,
    updateHighlightNote,
    updateHighlightColor,
    getHighlightsForPage,
  };
}
