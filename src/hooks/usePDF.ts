'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentMeta } from '@/types';
import { loadPDF, extractPDFMetadata } from '@/lib/pdf-utils';
import { getPDFFromStorage, getDocument } from '@/lib/storage';

interface UsePDFOptions {
  documentId: string;
}

interface UsePDFReturn {
  /** PDF document proxy from pdfjs-dist */
  pdf: PDFDocumentProxy | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if loading failed */
  error: Error | null;
  /** Document metadata */
  meta: DocumentMeta | null;
  /** Total page count */
  pageCount: number;
  /** Reload the PDF */
  reload: () => Promise<void>;
}

export function usePDF(options: UsePDFOptions): UsePDFReturn {
  const { documentId } = options;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [meta, setMeta] = useState<DocumentMeta | null>(null);

  const loadDocument = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get stored metadata
      const documentMeta = getDocument(documentId);
      if (documentMeta) {
        setMeta(documentMeta);
      }

      // Load PDF binary from IndexedDB
      const pdfData = await getPDFFromStorage(documentId);
      if (!pdfData) {
        throw new Error('PDF not found in storage');
      }

      // Load PDF document
      const pdfDocument = await loadPDF(pdfData);
      setPdf(pdfDocument);

      // If no stored metadata, extract from PDF
      if (!documentMeta) {
        const extractedMeta = await extractPDFMetadata(pdfDocument, 'document.pdf');
        setMeta({
          id: documentId,
          title: extractedMeta.title,
          kind: 'pdf',
          fileName: 'document.pdf',
          pageCount: extractedMeta.pageCount,
          fileSize: pdfData.byteLength,
          addedAt: Date.now(),
          lastOpenedAt: Date.now(),
          lastReadPage: 1,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load PDF'));
      setPdf(null);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  return {
    pdf,
    isLoading,
    error,
    meta,
    pageCount: pdf?.numPages ?? 0,
    reload: loadDocument,
  };
}
