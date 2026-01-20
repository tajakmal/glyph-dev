'use client';

import {
  INDEXEDDB_CONFIG,
  STORAGE_KEYS,
  type DocumentMeta,
  type Bookmark,
  type Highlight,
  type UserPreferences,
} from '@/types';

// =============================================================================
// IndexedDB Helper Functions
// =============================================================================

// Singleton IndexedDB instance
let db: IDBDatabase | null = null;

/**
 * Initialize or get the IndexedDB database (singleton pattern).
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

      // Create object store for PDF binary data
      if (!database.objectStoreNames.contains(INDEXEDDB_CONFIG.STORE_PDFS)) {
        database.createObjectStore(INDEXEDDB_CONFIG.STORE_PDFS);
      }

      // Create object store for text content
      if (!database.objectStoreNames.contains(INDEXEDDB_CONFIG.STORE_TEXTS)) {
        database.createObjectStore(INDEXEDDB_CONFIG.STORE_TEXTS);
      }
    };
  });
}

// =============================================================================
// PDF Storage (IndexedDB)
// =============================================================================

/**
 * Store a PDF ArrayBuffer in IndexedDB.
 */
export async function storePDF(
  documentId: string,
  data: ArrayBuffer
): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INDEXEDDB_CONFIG.STORE_PDFS, 'readwrite');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_PDFS);
    const request = store.put(data, documentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Alias for backwards compatibility
export const storePDFInStorage = storePDF;

/**
 * Get a PDF ArrayBuffer from IndexedDB.
 */
export async function getPDF(
  documentId: string
): Promise<ArrayBuffer | null> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INDEXEDDB_CONFIG.STORE_PDFS, 'readonly');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_PDFS);
    const request = store.get(documentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

// Alias for backwards compatibility
export const getPDFFromStorage = getPDF;

/**
 * Delete a PDF from IndexedDB.
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

// Alias for backwards compatibility
export const deletePDFFromStorage = deletePDF;

// =============================================================================
// Text Storage (IndexedDB)
// =============================================================================

/**
 * Store text content in IndexedDB.
 */
export async function storeText(
  documentId: string,
  content: string
): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INDEXEDDB_CONFIG.STORE_TEXTS, 'readwrite');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_TEXTS);
    const request = store.put(content, documentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get text content from IndexedDB.
 */
export async function getText(
  documentId: string
): Promise<string | null> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INDEXEDDB_CONFIG.STORE_TEXTS, 'readonly');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_TEXTS);
    const request = store.get(documentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? null);
  });
}

/**
 * Delete text content from IndexedDB.
 */
export async function deleteText(documentId: string): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(INDEXEDDB_CONFIG.STORE_TEXTS, 'readwrite');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_TEXTS);
    const request = store.delete(documentId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Check if storage quota is available.
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

// =============================================================================
// Generic localStorage Utilities
// =============================================================================

/**
 * Generic localStorage getter with type safety.
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
 * Generic localStorage setter.
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
 * Remove item from localStorage.
 */
export function removeFromStorage(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

// =============================================================================
// LocalStorage Normalization Helpers
// =============================================================================

/**
 * Normalize a document metadata entry from localStorage.
 * Fills missing `kind` with 'pdf' and ensures PDF-specific defaults.
 * Returns null for entries that cannot be normalized (missing required fields).
 */
function normalizeDocument(doc: unknown): DocumentMeta | null {
  if (!doc || typeof doc !== 'object') return null;

  const d = doc as Record<string, unknown>;

  // Required fields for all documents
  if (typeof d.id !== 'string' || typeof d.title !== 'string') return null;
  if (typeof d.addedAt !== 'number' || typeof d.lastOpenedAt !== 'number') return null;

  // Determine kind - default to 'pdf' for legacy data
  const kind = d.kind === 'text' ? 'text' : 'pdf';

  // Base fields
  const base = {
    id: d.id,
    title: d.title,
    kind,
    addedAt: d.addedAt,
    lastOpenedAt: d.lastOpenedAt,
    wordCount: typeof d.wordCount === 'number' ? d.wordCount : undefined,
    textPreview: typeof d.textPreview === 'string' ? d.textPreview : undefined,
    fileName: typeof d.fileName === 'string' ? d.fileName : undefined,
    pageCount: typeof d.pageCount === 'number' ? d.pageCount : undefined,
    fileSize: typeof d.fileSize === 'number' ? d.fileSize : undefined,
    lastReadPage: typeof d.lastReadPage === 'number' ? d.lastReadPage : undefined,
    thumbnailDataUrl: typeof d.thumbnailDataUrl === 'string' ? d.thumbnailDataUrl : undefined,
  };

  if (kind === 'pdf') {
    // For PDFs, ensure required fields have defaults
    return {
      ...base,
      kind: 'pdf',
      fileName: base.fileName ?? 'unknown.pdf',
      pageCount: base.pageCount ?? 1,
      fileSize: base.fileSize ?? 0,
      lastReadPage: base.lastReadPage ?? 1,
    };
  } else {
    return {
      ...base,
      kind: 'text',
    };
  }
}

/**
 * Normalize a bookmark entry from localStorage.
 * Fills missing `kind` with 'pdf'.
 * Returns null for entries that cannot be normalized.
 */
function normalizeBookmark(bookmark: unknown): Bookmark | null {
  if (!bookmark || typeof bookmark !== 'object') return null;

  const b = bookmark as Record<string, unknown>;

  // Required fields
  if (typeof b.id !== 'string' || typeof b.documentId !== 'string') return null;
  if (typeof b.createdAt !== 'number') return null;

  // Determine kind - default to 'pdf' for legacy data
  const kind = b.kind === 'text' ? 'text' : 'pdf';

  const base = {
    id: b.id,
    documentId: b.documentId,
    label: typeof b.label === 'string' ? b.label : undefined,
    createdAt: b.createdAt,
  };

  if (kind === 'text') {
    if (typeof b.wordIndex !== 'number') return null;
    return {
      ...base,
      kind: 'text',
      wordIndex: b.wordIndex,
    };
  } else {
    // Legacy bookmarks must have page
    if (typeof b.page !== 'number') return null;
    return {
      ...base,
      kind: 'pdf',
      page: b.page,
    };
  }
}

/**
 * Normalize a highlight entry from localStorage.
 * Fills missing `kind` with 'pdf'.
 * Returns null for entries that cannot be normalized.
 */
function normalizeHighlight(highlight: unknown): Highlight | null {
  if (!highlight || typeof highlight !== 'object') return null;

  const h = highlight as Record<string, unknown>;

  // Required fields
  if (typeof h.id !== 'string' || typeof h.documentId !== 'string') return null;
  if (typeof h.text !== 'string' || typeof h.createdAt !== 'number') return null;

  // Validate color
  const validColors = ['yellow', 'green', 'blue', 'pink', 'orange'];
  const color = validColors.includes(h.color as string) ? (h.color as Highlight['color']) : 'yellow';

  // Determine kind - default to 'pdf' for legacy data
  const kind = h.kind === 'text' ? 'text' : 'pdf';

  const base = {
    id: h.id,
    documentId: h.documentId,
    color,
    text: h.text,
    note: typeof h.note === 'string' ? h.note : undefined,
    createdAt: h.createdAt,
    updatedAt: typeof h.updatedAt === 'number' ? h.updatedAt : undefined,
  };

  if (kind === 'text') {
    if (typeof h.startWord !== 'number' || typeof h.endWord !== 'number') return null;
    return {
      ...base,
      kind: 'text',
      startWord: h.startWord,
      endWord: h.endWord,
    };
  } else {
    // Legacy highlights must have page and rects
    if (typeof h.page !== 'number' || !Array.isArray(h.rects)) return null;
    return {
      ...base,
      kind: 'pdf',
      page: h.page,
      rects: h.rects,
    };
  }
}

// =============================================================================
// Document Metadata Storage (localStorage)
// =============================================================================

/**
 * Get all document metadata from localStorage.
 * Normalizes legacy data (missing `kind` defaults to 'pdf') and writes back if changed.
 */
export function getDocuments(): DocumentMeta[] {
  const raw = getFromStorage<unknown[]>(STORAGE_KEYS.DOCUMENTS, []);
  if (!Array.isArray(raw)) return [];

  const normalized: DocumentMeta[] = [];
  let needsWrite = false;

  for (const item of raw) {
    const doc = normalizeDocument(item);
    if (doc) {
      normalized.push(doc);
      // Check if normalization changed the data
      if (JSON.stringify(doc) !== JSON.stringify(item)) {
        needsWrite = true;
      }
    } else {
      // Invalid entry was filtered out
      needsWrite = true;
    }
  }

  // Write back normalized data if changes were made
  if (needsWrite && normalized.length > 0) {
    setToStorage(STORAGE_KEYS.DOCUMENTS, normalized);
  }

  return normalized;
}

/**
 * Set all document metadata to localStorage.
 */
export function setDocuments(documents: DocumentMeta[]): void {
  setToStorage(STORAGE_KEYS.DOCUMENTS, documents);
}

/**
 * Get a single document's metadata by ID.
 */
export function getDocument(documentId: string): DocumentMeta | null {
  const documents = getDocuments();
  return documents.find((doc) => doc.id === documentId) || null;
}

/**
 * Save document metadata to localStorage.
 */
export function saveDocument(document: DocumentMeta): void {
  const documents = getDocuments();
  const index = documents.findIndex((doc) => doc.id === document.id);

  if (index >= 0) {
    documents[index] = document;
  } else {
    documents.push(document);
  }

  setDocuments(documents);
}

/**
 * Delete document metadata from localStorage.
 */
export function deleteDocument(documentId: string): void {
  const documents = getDocuments();
  setDocuments(documents.filter((doc) => doc.id !== documentId));
}

/**
 * Update the lastOpenedAt timestamp for a document.
 */
export function updateLastOpened(documentId: string): void {
  const doc = getDocument(documentId);
  if (doc) {
    doc.lastOpenedAt = Date.now();
    saveDocument(doc);
  }
}

/**
 * Update the lastReadPage for a document.
 */
export function updateLastReadPage(documentId: string, page: number): void {
  const doc = getDocument(documentId);
  if (doc) {
    doc.lastReadPage = page;
    saveDocument(doc);
  }
}

// =============================================================================
// Bookmark Storage (localStorage)
// =============================================================================

/**
 * Get all bookmarks from localStorage.
 * Normalizes legacy data (missing `kind` defaults to 'pdf') and writes back if changed.
 */
export function getBookmarks(): Bookmark[] {
  const raw = getFromStorage<unknown[]>(STORAGE_KEYS.BOOKMARKS, []);
  if (!Array.isArray(raw)) return [];

  const normalized: Bookmark[] = [];
  let needsWrite = false;

  for (const item of raw) {
    const bookmark = normalizeBookmark(item);
    if (bookmark) {
      normalized.push(bookmark);
      if (JSON.stringify(bookmark) !== JSON.stringify(item)) {
        needsWrite = true;
      }
    } else {
      needsWrite = true;
    }
  }

  if (needsWrite && normalized.length > 0) {
    setToStorage(STORAGE_KEYS.BOOKMARKS, normalized);
  }

  return normalized;
}

/**
 * Set all bookmarks to localStorage.
 */
export function setBookmarks(bookmarks: Bookmark[]): void {
  setToStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
}

/**
 * Get bookmarks for a specific document.
 */
export function getBookmarksForDocument(documentId: string): Bookmark[] {
  return getBookmarks().filter((b) => b.documentId === documentId);
}

// =============================================================================
// Highlight Storage (localStorage)
// =============================================================================

/**
 * Get all highlights from localStorage.
 * Normalizes legacy data (missing `kind` defaults to 'pdf') and writes back if changed.
 */
export function getHighlights(): Highlight[] {
  const raw = getFromStorage<unknown[]>(STORAGE_KEYS.HIGHLIGHTS, []);
  if (!Array.isArray(raw)) return [];

  const normalized: Highlight[] = [];
  let needsWrite = false;

  for (const item of raw) {
    const highlight = normalizeHighlight(item);
    if (highlight) {
      normalized.push(highlight);
      if (JSON.stringify(highlight) !== JSON.stringify(item)) {
        needsWrite = true;
      }
    } else {
      needsWrite = true;
    }
  }

  if (needsWrite && normalized.length > 0) {
    setToStorage(STORAGE_KEYS.HIGHLIGHTS, normalized);
  }

  return normalized;
}

/**
 * Set all highlights to localStorage.
 */
export function setHighlights(highlights: Highlight[]): void {
  setToStorage(STORAGE_KEYS.HIGHLIGHTS, highlights);
}

/**
 * Get highlights for a specific document.
 */
export function getHighlightsForDocument(documentId: string): Highlight[] {
  return getHighlights().filter((h) => h.documentId === documentId);
}

// =============================================================================
// User Preferences Storage (localStorage)
// =============================================================================

/**
 * Default user preferences.
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  defaultZoom: 1,
  defaultSidebarOpen: true,
  showPageNumbers: true,
  defaultWpm: 300,
};

/**
 * Get user preferences from localStorage.
 */
export function getPreferences(): UserPreferences {
  return getFromStorage<UserPreferences>(STORAGE_KEYS.PREFERENCES, DEFAULT_PREFERENCES);
}

/**
 * Set user preferences to localStorage.
 */
export function setPreferences(preferences: UserPreferences): void {
  setToStorage(STORAGE_KEYS.PREFERENCES, preferences);
}

// =============================================================================
// Composite Operations
// =============================================================================

/**
 * Delete a document and all associated data (PDF/text content, bookmarks, highlights).
 * Safely attempts to delete both PDF and text content regardless of document kind.
 */
export async function deleteDocumentComplete(documentId: string): Promise<void> {
  // Delete both PDF and text content from IndexedDB
  // (we don't know the kind, or the document may already be deleted from localStorage)
  // Both deletes are safe to call even if the content doesn't exist
  await Promise.all([
    deletePDF(documentId).catch(() => {}),
    deleteText(documentId).catch(() => {}),
  ]);

  // Remove from documents list
  const documents = getDocuments();
  setDocuments(documents.filter((d) => d.id !== documentId));

  // Remove associated bookmarks
  const bookmarks = getBookmarks();
  setBookmarks(bookmarks.filter((b) => b.documentId !== documentId));

  // Remove associated highlights
  const highlights = getHighlights();
  setHighlights(highlights.filter((h) => h.documentId !== documentId));
}
