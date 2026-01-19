'use client';

import { useEffect, useRef, useState, RefObject } from 'react';
import { VALIDATION } from '@/types';

interface UsePinchZoomOptions {
  /** Element ref to attach gesture handlers */
  elementRef: RefObject<HTMLElement | null>;
  /** Current zoom level */
  zoom: number;
  /** Callback when zoom changes */
  onZoomChange: (zoom: number) => void;
  /** Minimum zoom */
  minZoom?: number;
  /** Maximum zoom */
  maxZoom?: number;
  /** Whether pinch zoom is enabled */
  enabled?: boolean;
}

interface UsePinchZoomReturn {
  /** Is currently pinching */
  isPinching: boolean;
}

export function usePinchZoom({
  elementRef,
  zoom,
  onZoomChange,
  minZoom = VALIDATION.MIN_ZOOM,
  maxZoom = VALIDATION.MAX_ZOOM,
  enabled = true,
}: UsePinchZoomOptions): UsePinchZoomReturn {
  const [isPinching, setIsPinching] = useState(false);
  const startDistanceRef = useRef(0);
  const startZoomRef = useRef(zoom);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    const getDistance = (touches: TouchList): number => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        setIsPinching(true);
        startDistanceRef.current = getDistance(e.touches);
        startZoomRef.current = zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;

      e.preventDefault(); // Prevent page zoom

      const currentDistance = getDistance(e.touches);
      const scale = currentDistance / startDistanceRef.current;
      const newZoom = Math.min(maxZoom, Math.max(minZoom, startZoomRef.current * scale));

      onZoomChange(newZoom);
    };

    const handleTouchEnd = () => {
      setIsPinching(false);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [elementRef, zoom, onZoomChange, minZoom, maxZoom, enabled]);

  return {
    isPinching,
  };
}
