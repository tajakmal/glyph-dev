'use client';

import { useState, useCallback } from 'react';
import type { TextSelection } from '@/components/pdf/PDFTextLayer';

interface UseTextSelectionReturn {
  /** Current selection */
  selection: TextSelection | null;
  /** Clear the selection */
  clearSelection: () => void;
  /** Handle a new selection */
  handleSelection: (selection: TextSelection) => void;
  /** Whether there is an active selection */
  hasSelection: boolean;
}

export function useTextSelection(): UseTextSelectionReturn {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    // Also clear browser selection
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleSelection = useCallback((newSelection: TextSelection) => {
    setSelection(newSelection);
  }, []);

  return {
    selection,
    clearSelection,
    handleSelection,
    hasSelection: selection !== null && selection.text.length > 0,
  };
}
