'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Bookmark, TextBookmark } from '@/types';
import { VALIDATION } from '@/types';
import {
  getBookmarks,
  setBookmarks,
  getBookmarksForDocument,
} from '@/lib/storage';
import { getSyncQueue } from '@/lib/sync/queue';
import { getFeatureFlag } from '@/lib/feature-flags';

interface UseTextBookmarksOptions {
  documentId: string;
}

interface UseTextBookmarksReturn {
  /** Text bookmarks for this document */
  bookmarks: TextBookmark[];
  /** Add a text bookmark at a word index (optionally with a range and label) */
  addBookmark: (wordIndex: number, label?: string, endWordIndex?: number) => TextBookmark;
  /** Remove a bookmark */
  removeBookmark: (id: string) => void;
  /** Update a bookmark label */
  updateBookmark: (id: string, label: string) => void;
  /** Check if a word index is bookmarked */
  isWordBookmarked: (wordIndex: number) => boolean;
  /** Get bookmark for a specific word index */
  getBookmarkForWord: (wordIndex: number) => TextBookmark | undefined;
  /** Toggle bookmark at a word index */
  toggleBookmark: (wordIndex: number) => void;
}

// Custom event name for cross-instance sync
const BOOKMARKS_CHANGED_EVENT = 'glyph:bookmarks-changed';

function notifyBookmarksChanged(documentId: string) {
  window.dispatchEvent(new CustomEvent(BOOKMARKS_CHANGED_EVENT, { detail: { documentId } }));
}

// Type guard for text bookmarks
function isTextBookmark(bookmark: Bookmark): bookmark is TextBookmark {
  return bookmark.kind === 'text';
}

// Get sorted text bookmarks for a document
function getSortedTextBookmarksForDocument(documentId: string): TextBookmark[] {
  const docs = getBookmarksForDocument(documentId).filter(isTextBookmark);
  return docs.sort((a, b) => a.wordIndex - b.wordIndex);
}

export function useTextBookmarks({ documentId }: UseTextBookmarksOptions): UseTextBookmarksReturn {
  // Use lazy initializer to load bookmarks synchronously on first render
  const [bookmarks, setLocalBookmarks] = useState<TextBookmark[]>(() =>
    getSortedTextBookmarksForDocument(documentId)
  );

  // Re-sync when documentId changes
  const currentDocId = useMemo(() => documentId, [documentId]);
  const [lastDocId, setLastDocId] = useState(documentId);

  const enqueueSync = useCallback((id: string, payload: unknown) => {
    const queue = getSyncQueue();
    queue.enqueue({
      id,
      type: 'UPSERT_BOOKMARK',
      documentId,
      payload,
    });
    if (getFeatureFlag('sync_enabled')) {
      void queue.flush();
    }
  }, [documentId]);

  if (currentDocId !== lastDocId) {
    setLastDocId(currentDocId);
    setLocalBookmarks(getSortedTextBookmarksForDocument(currentDocId));
  }

  // Listen for changes from other hook instances (e.g. SpeedReadPanel ↔ TextReader)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.documentId === documentId) {
        setLocalBookmarks(getSortedTextBookmarksForDocument(documentId));
      }
    };
    window.addEventListener(BOOKMARKS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(BOOKMARKS_CHANGED_EVENT, handler);
  }, [documentId]);

  const addBookmark = useCallback((wordIndex: number, label?: string, endWordIndex?: number): TextBookmark => {
    // Check if already bookmarked at this word
    const existing = bookmarks.find(b => b.wordIndex === wordIndex);
    if (existing) return existing;

    // Validate label length
    const safeLabel = label?.slice(0, VALIDATION.MAX_LABEL_LENGTH);

    const bookmark: TextBookmark = {
      id: uuidv4(),
      documentId,
      kind: 'text',
      wordIndex,
      endWordIndex,
      label: safeLabel,
      createdAt: Date.now(),
    };

    // Update localStorage
    const allBookmarks = getBookmarks();
    allBookmarks.push(bookmark);
    setBookmarks(allBookmarks);

    // Update local state
    setLocalBookmarks(prev => {
      const updated = [...prev, bookmark];
      return updated.sort((a, b) => a.wordIndex - b.wordIndex);
    });
    enqueueSync(`bookmark-upsert:${bookmark.id}:${Date.now()}`, bookmark);
    notifyBookmarksChanged(documentId);

    return bookmark;
  }, [documentId, bookmarks, enqueueSync]);

  const removeBookmark = useCallback((id: string) => {
    // Update localStorage
    const allBookmarks = getBookmarks();
    setBookmarks(allBookmarks.filter(b => b.id !== id));

    // Update local state
    setLocalBookmarks(prev => prev.filter(b => b.id !== id));
    enqueueSync(`bookmark-upsert:${id}:${Date.now()}`, { id, deleted: true });
    notifyBookmarksChanged(documentId);
  }, [documentId, enqueueSync]);

  const updateBookmark = useCallback((id: string, label: string) => {
    // Validate label length
    const safeLabel = label.slice(0, VALIDATION.MAX_LABEL_LENGTH);

    // Update localStorage
    const allBookmarks = getBookmarks();
    const index = allBookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      allBookmarks[index].label = safeLabel;
      setBookmarks(allBookmarks);
    }

    // Update local state
    setLocalBookmarks(prev =>
      prev.map(b => (b.id === id ? { ...b, label: safeLabel } : b))
    );
    enqueueSync(`bookmark-upsert:${id}:${Date.now()}`, { id, label: safeLabel });
    notifyBookmarksChanged(documentId);
  }, [documentId, enqueueSync]);

  const isWordBookmarked = useCallback((wordIndex: number): boolean => {
    return bookmarks.some(b => b.wordIndex === wordIndex);
  }, [bookmarks]);

  const getBookmarkForWord = useCallback((wordIndex: number): TextBookmark | undefined => {
    return bookmarks.find(b => b.wordIndex === wordIndex);
  }, [bookmarks]);

  const toggleBookmark = useCallback((wordIndex: number) => {
    const existing = getBookmarkForWord(wordIndex);
    if (existing) {
      removeBookmark(existing.id);
    } else {
      addBookmark(wordIndex);
    }
  }, [getBookmarkForWord, removeBookmark, addBookmark]);

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark,
    isWordBookmarked,
    getBookmarkForWord,
    toggleBookmark,
  };
}
