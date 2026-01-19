'use client';

import { useEffect } from 'react';
import { VALIDATION } from '@/types';

interface UseZoomKeyboardOptions {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  enabled?: boolean;
}

export function useZoomKeyboard({
  zoom,
  onZoomChange,
  enabled = true,
}: UseZoomKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd key
      if (!e.ctrlKey && !e.metaKey) return;

      // Prevent default browser zoom
      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '0') {
        e.preventDefault();
      }

      switch (e.key) {
        case '+':
        case '=': // Plus without shift
          const newZoomIn = Math.min(zoom + VALIDATION.ZOOM_STEP, VALIDATION.MAX_ZOOM);
          onZoomChange(newZoomIn);
          break;

        case '-':
          const newZoomOut = Math.max(zoom - VALIDATION.ZOOM_STEP, VALIDATION.MIN_ZOOM);
          onZoomChange(newZoomOut);
          break;

        case '0':
          onZoomChange(1); // Reset to 100%
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoom, onZoomChange, enabled]);
}
