---
task: IndexedDB Storage Layer
priority: 2
depends_on: ["001-typescript-types"]
---

# Task: IndexedDB Storage Layer

Create the IndexedDB wrapper for storing PDF binary data and localStorage utilities for metadata.

## Overview

This task creates the storage layer for the application. PDF binary data (ArrayBuffer) is stored in IndexedDB to handle large files efficiently. Document metadata, bookmarks, and highlights are stored in localStorage as JSON. The storage module provides a clean async API for all operations.

## Context

- IndexedDB for large binary data (PDF files)
- localStorage for JSON metadata (documents, bookmarks, highlights)
- All operations should be async/promise-based
- Use the constants from types (STORAGE_KEYS, INDEXEDDB_CONFIG)
- Handle storage quota errors gracefully

## Requirements

### IndexedDB Operations

**File:** `src/lib/storage.ts`

```typescript
import { INDEXEDDB_CONFIG, STORAGE_KEYS } from '@/types';

// IndexedDB instance (singleton)
let db: IDBDatabase | null = null;

/**
 * Initialize or get the IndexedDB database
 */
export async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      INDEXEDDB_CONFIG.DB_NAME,
      INDEXEDDB_CONFIG.DB_VERSION
    );

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object store for PDFs
      if (!database.objectStoreNames.contains(INDEXEDDB_CONFIG.STORE_PDFS)) {
        database.createObjectStore(INDEXEDDB_CONFIG.STORE_PDFS);
      }
    };
  });
}

/**
 * Store a PDF in IndexedDB
 */
export async function storePDF(documentId: string, data: ArrayBuffer): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INDEXEDDB_CONFIG.STORE_PDFS, 'readwrite');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_PDFS);
    const request = store.put(data, documentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get a PDF from IndexedDB
 */
export async function getPDF(documentId: string): Promise<ArrayBuffer | null> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INDEXEDDB_CONFIG.STORE_PDFS, 'readonly');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_PDFS);
    const request = store.get(documentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Delete a PDF from IndexedDB
 */
export async function deletePDF(documentId: string): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INDEXEDDB_CONFIG.STORE_PDFS, 'readwrite');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_PDFS);
    const request = store.delete(documentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Check if storage quota is available
 */
export async function checkStorageQuota(): Promise<{
  used: number;
  available: number;
  percentUsed: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 0;
    return {
      used,
      available: quota - used,
      percentUsed: quota > 0 ? (used / quota) * 100 : 0,
    };
  }
  return { used: 0, available: 0, percentUsed: 0 };
}
```

### localStorage Utilities

Add to `src/lib/storage.ts`:

```typescript
import type { DocumentMeta, Bookmark, Highlight, UserPreferences } from '@/types';

/**
 * Generic localStorage getter with type safety
 */
export function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Generic localStorage setter
 */
export function setToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Handle quota exceeded
    console.error('localStorage quota exceeded:', e);
  }
}

/**
 * Remove item from localStorage
 */
export function removeFromStorage(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

// Document metadata operations
export function getDocuments(): DocumentMeta[] {
  return getFromStorage<DocumentMeta[]>(STORAGE_KEYS.DOCUMENTS, []);
}

export function setDocuments(documents: DocumentMeta[]): void {
  setToStorage(STORAGE_KEYS.DOCUMENTS, documents);
}

// Bookmark operations
export function getBookmarks(): Bookmark[] {
  return getFromStorage<Bookmark[]>(STORAGE_KEYS.BOOKMARKS, []);
}

export function setBookmarks(bookmarks: Bookmark[]): void {
  setToStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
}

export function getBookmarksForDocument(documentId: string): Bookmark[] {
  return getBookmarks().filter(b => b.documentId === documentId);
}

// Highlight operations
export function getHighlights(): Highlight[] {
  return getFromStorage<Highlight[]>(STORAGE_KEYS.HIGHLIGHTS, []);
}

export function setHighlights(highlights: Highlight[]): void {
  setToStorage(STORAGE_KEYS.HIGHLIGHTS, highlights);
}

export function getHighlightsForDocument(documentId: string): Highlight[] {
  return getHighlights().filter(h => h.documentId === documentId);
}

// User preferences
export function getPreferences(): UserPreferences {
  return getFromStorage<UserPreferences>(STORAGE_KEYS.PREFERENCES, {
    defaultZoom: 1,
    defaultSidebarOpen: true,
    showPageNumbers: true,
    defaultWpm: 300,
  });
}

export function setPreferences(preferences: UserPreferences): void {
  setToStorage(STORAGE_KEYS.PREFERENCES, preferences);
}
```

### Composite Operations

Add to `src/lib/storage.ts`:

```typescript
/**
 * Delete a document and all associated data
 */
export async function deleteDocumentComplete(documentId: string): Promise<void> {
  // Delete PDF from IndexedDB
  await deletePDF(documentId);

  // Remove from documents list
  const documents = getDocuments();
  setDocuments(documents.filter(d => d.id !== documentId));

  // Remove associated bookmarks
  const bookmarks = getBookmarks();
  setBookmarks(bookmarks.filter(b => b.documentId !== documentId));

  // Remove associated highlights
  const highlights = getHighlights();
  setHighlights(highlights.filter(h => h.documentId !== documentId));
}

/**
 * Update document's last opened timestamp
 */
export function updateLastOpened(documentId: string): void {
  const documents = getDocuments();
  const index = documents.findIndex(d => d.id === documentId);

  if (index !== -1) {
    documents[index].lastOpenedAt = Date.now();
    setDocuments(documents);
  }
}

/**
 * Update document's last read page
 */
export function updateLastReadPage(documentId: string, page: number): void {
  const documents = getDocuments();
  const index = documents.findIndex(d => d.id === documentId);

  if (index !== -1) {
    documents[index].lastReadPage = page;
    setDocuments(documents);
  }
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/storage.ts` | Create | Complete storage layer with IndexedDB and localStorage |

## Success Criteria

1. [x] `src/lib/storage.ts` exists
2. [x] getDB() initializes IndexedDB with correct name and version
3. [x] storePDF() stores ArrayBuffer in IndexedDB
4. [x] getPDF() retrieves ArrayBuffer from IndexedDB
5. [x] deletePDF() removes data from IndexedDB
6. [x] checkStorageQuota() returns storage estimates
7. [x] getFromStorage/setToStorage work with generic types
8. [x] getDocuments/setDocuments work correctly
9. [x] getBookmarks/setBookmarks work correctly
10. [x] getHighlights/setHighlights work correctly
11. [x] getPreferences/setPreferences work with defaults
12. [x] deleteDocumentComplete removes PDF and all associated data
13. [x] updateLastOpened updates timestamp correctly
14. [x] updateLastReadPage updates page correctly
15. [x] `npm run type-check` passes
16. [x] `npm run lint` passes

---

## Ralph Instructions

When working on this task:

1. Read `.ralph/guardrails.md` for signs to follow
2. Read `.ralph/progress.md` to see what's been done
3. Work on the next unchecked criterion (marked [ ])
4. After completing a criterion, change [ ] to [x] in this file
5. Update `.ralph/progress.md` with your progress
6. Commit your changes frequently with descriptive messages
7. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
8. If stuck 3+ times on same issue, output: `<ralph>GUTTER</ralph>`
