'use client';

import { INDEXEDDB_CONFIG, STORAGE_KEYS, type DocumentMeta } from '@/types';

// =============================================================================
// IndexedDB Helper Functions
// =============================================================================

/**
 * Open the IndexedDB database, creating object stores if necessary.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      INDEXEDDB_CONFIG.DB_NAME,
      INDEXEDDB_CONFIG.DB_VERSION
    );

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store for PDF binary data
      if (!db.objectStoreNames.contains(INDEXEDDB_CONFIG.STORE_PDFS)) {
        db.createObjectStore(INDEXEDDB_CONFIG.STORE_PDFS);
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
export async function storePDFInStorage(
  documentId: string,
  data: ArrayBuffer
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INDEXEDDB_CONFIG.STORE_PDFS, 'readwrite');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_PDFS);
    const request = store.put(data, documentId);

    request.onerror = () => {
      reject(new Error('Failed to store PDF'));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Get a PDF ArrayBuffer from IndexedDB.
 */
export async function getPDFFromStorage(
  documentId: string
): Promise<ArrayBuffer | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INDEXEDDB_CONFIG.STORE_PDFS, 'readonly');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_PDFS);
    const request = store.get(documentId);

    request.onerror = () => {
      reject(new Error('Failed to retrieve PDF'));
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Delete a PDF from IndexedDB.
 */
export async function deletePDFFromStorage(documentId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INDEXEDDB_CONFIG.STORE_PDFS, 'readwrite');
    const store = transaction.objectStore(INDEXEDDB_CONFIG.STORE_PDFS);
    const request = store.delete(documentId);

    request.onerror = () => {
      reject(new Error('Failed to delete PDF'));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// =============================================================================
// Document Metadata Storage (localStorage)
// =============================================================================

/**
 * Get all document metadata from localStorage.
 */
export function getDocuments(): DocumentMeta[] {
  if (typeof window === 'undefined') return [];

  const data = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
  if (!data) return [];

  try {
    return JSON.parse(data) as DocumentMeta[];
  } catch {
    return [];
  }
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

  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(documents));
}

/**
 * Delete document metadata from localStorage.
 */
export function deleteDocument(documentId: string): void {
  const documents = getDocuments();
  const filtered = documents.filter((doc) => doc.id !== documentId);
  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(filtered));
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
