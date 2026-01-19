---
task: Zoom Controls
priority: 3
depends_on: ["002-shared-ui-components", "005-pdf-viewer-component"]
---

# Task: Zoom Controls

Implement zoom controls including toolbar buttons, keyboard shortcuts, and pinch-to-zoom for touch devices.

## Overview

This task adds comprehensive zoom functionality to the PDF viewer. Users can zoom using toolbar buttons, keyboard shortcuts (Ctrl+/-/0), preset zoom levels, and pinch gestures on touch devices. The zoom should preserve scroll position (keeping the center of the viewport stable).

## Context

- Zoom range: 50% to 300%
- Zoom step: 25%
- Default zoom: "Fit to width" (calculated based on container width)
- Keyboard shortcuts follow standard patterns (Ctrl+Plus, Ctrl+Minus, Ctrl+0)
- Pinch zoom uses touch events

## Requirements

### PDFControls Component (Zoom Section)

**File:** `src/components/pdf/PDFControls.tsx`

```typescript
'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { VALIDATION } from '@/types';

interface PDFControlsProps {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  /** Set zoom level */
  onZoomChange: (zoom: number) => void;
  /** Current page number (1-based) */
  currentPage: number;
  /** Total page count */
  pageCount: number;
  /** Go to specific page */
  onPageChange: (page: number) => void;
  /** Document title */
  title?: string;
  /** Toggle sidebar */
  onSidebarToggle?: () => void;
  /** Is sidebar open */
  isSidebarOpen?: boolean;
}

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function PDFControls({
  zoom,
  onZoomChange,
  currentPage,
  pageCount,
  onPageChange,
  title,
  onSidebarToggle,
  isSidebarOpen,
}: PDFControlsProps) {
  const zoomIn = () => {
    const newZoom = Math.min(zoom + VALIDATION.ZOOM_STEP, VALIDATION.MAX_ZOOM);
    onZoomChange(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(zoom - VALIDATION.ZOOM_STEP, VALIDATION.MIN_ZOOM);
    onZoomChange(newZoom);
  };

  const resetZoom = () => {
    onZoomChange(1);
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
      {/* Left: Sidebar toggle and title */}
      <div className="flex items-center gap-3">
        {onSidebarToggle && (
          <button
            onClick={onSidebarToggle}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {title && (
          <span className="text-zinc-300 text-sm font-medium truncate max-w-[200px]" title={title}>
            {title}
          </span>
        )}
      </div>

      {/* Center: Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={zoomOut}
          disabled={zoom <= VALIDATION.MIN_ZOOM}
          className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom out"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <select
          value={zoom}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          className="bg-zinc-800 text-zinc-300 text-sm rounded-lg px-2 py-1 border border-zinc-700 focus:outline-none focus:border-zinc-600"
        >
          {ZOOM_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {Math.round(preset * 100)}%
            </option>
          ))}
          {!ZOOM_PRESETS.includes(zoom) && (
            <option value={zoom}>{zoomPercent}%</option>
          )}
        </select>

        <button
          onClick={zoomIn}
          disabled={zoom >= VALIDATION.MAX_ZOOM}
          className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Zoom in"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button
          onClick={resetZoom}
          className="px-2 py-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg text-sm transition-colors"
          aria-label="Reset zoom to fit width"
        >
          Fit
        </button>
      </div>

      {/* Right: Page indicator */}
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <span>Page</span>
        <input
          type="number"
          min={1}
          max={pageCount}
          value={currentPage}
          onChange={(e) => {
            const page = parseInt(e.target.value);
            if (page >= 1 && page <= pageCount) {
              onPageChange(page);
            }
          }}
          className="w-12 bg-zinc-800 text-zinc-300 text-center rounded px-1 py-0.5 border border-zinc-700"
        />
        <span>of {pageCount}</span>
      </div>
    </div>
  );
}
```

### Keyboard Shortcuts Hook

**File:** `src/hooks/useZoomKeyboard.ts`

```typescript
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
```

### Pinch-to-Zoom Hook

**File:** `src/hooks/usePinchZoom.ts`

```typescript
'use client';

import { useEffect, useRef, RefObject } from 'react';
import { VALIDATION } from '@/types';

interface UsePinchZoomOptions {
  /** Element ref to attach gesture handlers */
  elementRef: RefObject<HTMLElement>;
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
  const isPinchingRef = useRef(false);
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
        isPinchingRef.current = true;
        startDistanceRef.current = getDistance(e.touches);
        startZoomRef.current = zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPinchingRef.current || e.touches.length !== 2) return;

      e.preventDefault(); // Prevent page zoom

      const currentDistance = getDistance(e.touches);
      const scale = currentDistance / startDistanceRef.current;
      const newZoom = Math.min(maxZoom, Math.max(minZoom, startZoomRef.current * scale));

      onZoomChange(newZoom);
    };

    const handleTouchEnd = () => {
      isPinchingRef.current = false;
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
    isPinching: isPinchingRef.current,
  };
}
```

### Update PDFViewer for Zoom

Update `PDFViewer.tsx` to integrate zoom controls and preserve scroll position:

```typescript
// Add to PDFViewer.tsx

// Preserve scroll position when zooming
const handleZoomChange = useCallback((newZoom: number) => {
  const container = containerRef.current;
  if (!container) {
    setZoom(newZoom);
    return;
  }

  // Get current scroll center
  const scrollCenter = container.scrollTop + container.clientHeight / 2;
  const scrollRatio = scrollCenter / container.scrollHeight;

  setZoom(newZoom);

  // After re-render, restore scroll position
  requestAnimationFrame(() => {
    const newScrollCenter = container.scrollHeight * scrollRatio;
    container.scrollTop = newScrollCenter - container.clientHeight / 2;
  });
}, []);

// Add keyboard shortcuts
useZoomKeyboard({
  zoom,
  onZoomChange: handleZoomChange,
});

// Add pinch zoom
usePinchZoom({
  elementRef: containerRef,
  zoom,
  onZoomChange: handleZoomChange,
});
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/pdf/PDFControls.tsx` | Create | Toolbar with zoom controls |
| `src/hooks/useZoomKeyboard.ts` | Create | Keyboard shortcut handler |
| `src/hooks/usePinchZoom.ts` | Create | Touch pinch gesture handler |
| `src/components/pdf/PDFViewer.tsx` | Modify | Integrate zoom functionality |

## Success Criteria

1. [x] `src/components/pdf/PDFControls.tsx` exists
2. [x] PDFControls has zoom in/out buttons
3. [x] PDFControls has zoom preset dropdown (50%, 75%, 100%, 125%, 150%, 200%, 300%)
4. [x] PDFControls has "Fit" button to reset zoom
5. [x] PDFControls shows page indicator (Page X of Y)
6. [x] `src/hooks/useZoomKeyboard.ts` exists
7. [x] Ctrl+Plus zooms in
8. [x] Ctrl+Minus zooms out
9. [x] Ctrl+0 resets zoom to 100%
10. [x] Keyboard shortcuts prevent browser default zoom
11. [x] `src/hooks/usePinchZoom.ts` exists
12. [x] Pinch-to-zoom works on touch devices
13. [x] Zoom is constrained between 50% and 300%
14. [x] Scroll position is preserved when zooming
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
