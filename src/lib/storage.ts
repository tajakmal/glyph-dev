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
// Document Metadata Storage (localStorage)
// =============================================================================

/**
 * Get all document metadata from localStorage.
 */
export function getDocuments(): DocumentMeta[] {
  return getFromStorage<DocumentMeta[]>(STORAGE_KEYS.DOCUMENTS, []);
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
 */
export function getBookmarks(): Bookmark[] {
  return getFromStorage<Bookmark[]>(STORAGE_KEYS.BOOKMARKS, []);
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
 */
export function getHighlights(): Highlight[] {
  return getFromStorage<Highlight[]>(STORAGE_KEYS.HIGHLIGHTS, []);
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
 * Delete a document and all associated data (PDF, bookmarks, highlights).
 */
export async function deleteDocumentComplete(documentId: string): Promise<void> {
  // Delete PDF from IndexedDB
  await deletePDF(documentId);

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
