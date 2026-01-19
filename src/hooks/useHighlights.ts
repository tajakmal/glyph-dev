'use client';

import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Highlight, HighlightColor } from '@/types';
import { VALIDATION } from '@/types';
import {
  getHighlights,
  setHighlights,
  getHighlightsForDocument,
} from '@/lib/storage';

interface UseHighlightsOptions {
  documentId: string;
}

interface UseHighlightsReturn {
  /** Highlights for this document */
  highlights: Highlight[];
  /** Highlights grouped by page */
  highlightsByPage: Map<number, Highlight[]>;
  /** Add a highlight */
  addHighlight: (highlight: Omit<Highlight, 'id' | 'createdAt'>) => Highlight;
  /** Remove a highlight */
  removeHighlight: (id: string) => void;
  /** Update highlight note */
  updateHighlightNote: (id: string, note: string) => void;
  /** Update highlight color */
  updateHighlightColor: (id: string, color: HighlightColor) => void;
  /** Get highlights for a specific page */
  getHighlightsForPage: (page: number) => Highlight[];
}

// Helper to get highlights for a document
function getDocumentHighlights(documentId: string): Highlight[] {
  return getHighlightsForDocument(documentId);
}

export function useHighlights({ documentId }: UseHighlightsOptions): UseHighlightsReturn {
  // Use lazy initializer to load highlights synchronously on first render
  const [highlights, setLocalHighlights] = useState<Highlight[]>(() =>
    getDocumentHighlights(documentId)
  );

  // Re-sync when documentId changes
  const currentDocId = useMemo(() => documentId, [documentId]);
  const [lastDocId, setLastDocId] = useState(documentId);

  if (currentDocId !== lastDocId) {
    setLastDocId(currentDocId);
    setLocalHighlights(getDocumentHighlights(currentDocId));
  }

  // Compute highlights by page
  const highlightsByPage = useMemo(() => {
    const map = new Map<number, Highlight[]>();
    highlights.forEach(h => {
      if (!map.has(h.page)) {
        map.set(h.page, []);
      }
      map.get(h.page)!.push(h);
    });
    return map;
  }, [highlights]);

  const addHighlight = useCallback((
    data: Omit<Highlight, 'id' | 'createdAt'>
  ): Highlight => {
    const highlight: Highlight = {
      ...data,
      id: uuidv4(),
      createdAt: Date.now(),
    };

    // Update localStorage
    const allHighlights = getHighlights();
    allHighlights.push(highlight);
    setHighlights(allHighlights);

    // Update local state
    setLocalHighlights(prev => [...prev, highlight]);

    return highlight;
  }, []);

  const removeHighlight = useCallback((id: string) => {
    // Update localStorage
    const allHighlights = getHighlights();
    setHighlights(allHighlights.filter(h => h.id !== id));

    // Update local state
    setLocalHighlights(prev => prev.filter(h => h.id !== id));
  }, []);

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
  }, []);

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
  }, []);

  const getHighlightsForPage = useCallback((page: number): Highlight[] => {
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
