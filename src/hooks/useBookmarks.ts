'use client';

import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Bookmark, PDFBookmark } from '@/types';
import { VALIDATION } from '@/types';
import {
  getBookmarks,
  setBookmarks,
  getBookmarksForDocument,
} from '@/lib/storage';
import { getSyncQueue } from '@/lib/sync/queue';
import { getFeatureFlag } from '@/lib/feature-flags';

interface UseBookmarksOptions {
  documentId: string;
}

interface UseBookmarksReturn {
  /** Bookmarks for this document */
  bookmarks: PDFBookmark[];
  /** Add a bookmark */
  addBookmark: (page: number, label?: string) => PDFBookmark;
  /** Remove a bookmark */
  removeBookmark: (id: string) => void;
  /** Update a bookmark label */
  updateBookmark: (id: string, label: string) => void;
  /** Check if a page is bookmarked */
  isPageBookmarked: (page: number) => boolean;
  /** Get bookmark for a specific page */
  getBookmarkForPage: (page: number) => PDFBookmark | undefined;
  /** Toggle bookmark on a page */
  toggleBookmark: (page: number) => void;
}

// Helper to get sorted bookmarks for a document
function isPDFBookmark(bookmark: Bookmark): bookmark is PDFBookmark {
  const kind = (bookmark as { kind?: string }).kind;
  const page = (bookmark as { page?: unknown }).page;
  return (kind === 'pdf' || kind == null) && typeof page === 'number';
}

function getSortedBookmarksForDocument(documentId: string): PDFBookmark[] {
  const docs = getBookmarksForDocument(documentId).filter(isPDFBookmark);
  return docs.sort((a, b) => a.page - b.page);
}

export function useBookmarks({ documentId }: UseBookmarksOptions): UseBookmarksReturn {
  // Use lazy initializer to load bookmarks synchronously on first render
  const [bookmarks, setLocalBookmarks] = useState<PDFBookmark[]>(() =>
    getSortedBookmarksForDocument(documentId)
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
    setLocalBookmarks(getSortedBookmarksForDocument(currentDocId));
  }

  const addBookmark = useCallback((page: number, label?: string): PDFBookmark => {
    // Check if already bookmarked
    const existing = bookmarks.find(b => b.page === page);
    if (existing) return existing;

    // Validate label length
    const safeLabel = label?.slice(0, VALIDATION.MAX_LABEL_LENGTH);

    const bookmark: PDFBookmark = {
      id: uuidv4(),
      documentId,
      kind: 'pdf',
      page,
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
      return updated.sort((a, b) => a.page - b.page);
    });
    enqueueSync(`bookmark-upsert:${bookmark.id}:${Date.now()}`, bookmark);

    return bookmark;
  }, [documentId, bookmarks, enqueueSync]);

  const removeBookmark = useCallback((id: string) => {
    // Update localStorage
    const allBookmarks = getBookmarks();
    setBookmarks(allBookmarks.filter(b => b.id !== id));

    // Update local state
    setLocalBookmarks(prev => prev.filter(b => b.id !== id));
    enqueueSync(`bookmark-upsert:${id}:${Date.now()}`, { id, deleted: true });
  }, [enqueueSync]);

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
  }, [enqueueSync]);

  const isPageBookmarked = useCallback((page: number): boolean => {
    return bookmarks.some(b => b.page === page);
  }, [bookmarks]);

  const getBookmarkForPage = useCallback((page: number): PDFBookmark | undefined => {
    return bookmarks.find(b => b.page === page);
  }, [bookmarks]);

  const toggleBookmark = useCallback((page: number) => {
    const existing = getBookmarkForPage(page);
    if (existing) {
      removeBookmark(existing.id);
    } else {
      addBookmark(page);
    }
  }, [getBookmarkForPage, removeBookmark, addBookmark]);

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark,
    isPageBookmarked,
    getBookmarkForPage,
    toggleBookmark,
  };
}
