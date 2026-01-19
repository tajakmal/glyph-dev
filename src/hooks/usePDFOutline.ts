'use client';

import { useState, useEffect } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PDFOutlineItem } from '@/types';
import { getPDFOutline } from '@/lib/pdf-utils';

interface UsePDFOutlineOptions {
  pdf: PDFDocumentProxy | null;
}

interface UsePDFOutlineReturn {
  /** Outline items (table of contents) */
  outline: PDFOutlineItem[];
  /** Whether the PDF has an outline */
  hasOutline: boolean;
  /** Loading state */
  isLoading: boolean;
}

export function usePDFOutline({ pdf }: UsePDFOutlineOptions): UsePDFOutlineReturn {
  const [outline, setOutline] = useState<PDFOutlineItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!pdf) {
      setOutline([]);
      return;
    }

    const loadOutline = async () => {
      setIsLoading(true);
      try {
        const result = await getPDFOutline(pdf);
        setOutline(result as PDFOutlineItem[]);
      } catch (error) {
        console.error('Failed to load outline:', error);
        setOutline([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadOutline();
  }, [pdf]);

  return {
    outline,
    hasOutline: outline.length > 0,
    isLoading,
  };
}
