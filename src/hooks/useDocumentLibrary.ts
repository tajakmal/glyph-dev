'use client';

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { DocumentMeta } from '@/types';
import { VALIDATION } from '@/types';
import {
  getDocuments,
  setDocuments,
  storePDF,
  deleteDocumentComplete,
} from '@/lib/storage';
import {
  loadPDF,
  extractPDFMetadata,
  generateThumbnail,
} from '@/lib/pdf-utils';

interface UseDocumentLibraryReturn {
  /** All documents sorted by lastOpenedAt */
  documents: DocumentMeta[];
  /** Loading state */
  isLoading: boolean;
  /** Error if any operation failed */
  error: Error | null;
  /** Add a new document from a File */
  addDocument: (file: File) => Promise<DocumentMeta>;
  /** Remove a document and all associated data */
  removeDocument: (id: string) => Promise<void>;
  /** Update document metadata */
  updateDocument: (id: string, updates: Partial<DocumentMeta>) => void;
  /** Get a single document by ID */
  getDocument: (id: string) => DocumentMeta | undefined;
  /** Refresh documents from storage */
  refresh: () => void;
}

export function useDocumentLibrary(): UseDocumentLibraryReturn {
  const [documents, setLocalDocuments] = useState<DocumentMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load documents on mount
  useEffect(() => {
    const loadDocuments = () => {
      try {
        const docs = getDocuments();
        // Sort by lastOpenedAt descending
        docs.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
        setLocalDocuments(docs);
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Failed to load documents'));
      } finally {
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const refresh = useCallback(() => {
    const docs = getDocuments();
    docs.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    setLocalDocuments(docs);
  }, []);

  const addDocument = useCallback(async (file: File): Promise<DocumentMeta> => {
    // Validate file type
    if (!(VALIDATION.SUPPORTED_TYPES as readonly string[]).includes(file.type)) {
      throw new Error('Invalid file type. Only PDF files are supported.');
    }

    // Validate file size
    if (file.size > VALIDATION.MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${VALIDATION.MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Clone buffer for pdfjs (it may detach the original)
    const pdfBuffer = arrayBuffer.slice(0);

    // Load PDF to extract metadata
    const pdf = await loadPDF(pdfBuffer);
    const { title, pageCount } = await extractPDFMetadata(pdf, file.name);

    // Create document metadata
    const now = Date.now();
    const docMeta: DocumentMeta = {
      id: uuidv4(),
      title,
      kind: 'pdf',
      fileName: file.name,
      pageCount,
      fileSize: file.size,
      addedAt: now,
      lastOpenedAt: now,
      lastReadPage: 1,
    };

    // Store PDF in IndexedDB
    await storePDF(docMeta.id, arrayBuffer);

    // Store metadata in localStorage
    const docs = getDocuments();
    docs.push(docMeta);
    setDocuments(docs);

    // Update local state
    setLocalDocuments(prev => [docMeta, ...prev]);

    // Generate thumbnail asynchronously (non-blocking)
    generateThumbnail(pdf).then(thumbnailDataUrl => {
      const updatedDocs = getDocuments();
      const index = updatedDocs.findIndex(d => d.id === docMeta.id);
      if (index !== -1) {
        updatedDocs[index].thumbnailDataUrl = thumbnailDataUrl;
        setDocuments(updatedDocs);
        setLocalDocuments([...updatedDocs].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt));
      }
    }).catch(console.error);

    return docMeta;
  }, []);

  const removeDocument = useCallback(async (id: string): Promise<void> => {
    await deleteDocumentComplete(id);
    setLocalDocuments(prev => prev.filter(d => d.id !== id));
  }, []);

  const updateDocument = useCallback((id: string, updates: Partial<DocumentMeta>): void => {
    const docs = getDocuments();
    const index = docs.findIndex(d => d.id === id);

    if (index !== -1) {
      docs[index] = { ...docs[index], ...updates } as DocumentMeta;
      setDocuments(docs);
      setLocalDocuments([...docs].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt));
    }
  }, []);

  const getDocument = useCallback((id: string): DocumentMeta | undefined => {
    return documents.find(d => d.id === id);
  }, [documents]);

  return {
    documents,
    isLoading,
    error,
    addDocument,
    removeDocument,
    updateDocument,
    getDocument,
    refresh,
  };
}
