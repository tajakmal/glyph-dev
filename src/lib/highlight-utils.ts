import type { HighlightRect } from '@/types';

/**
 * Normalize selection rects to 0-1 range based on page dimensions.
 * This allows highlights to render correctly at any zoom level.
 */
export function normalizeRects(
  rects: DOMRect[],
  pageWidth: number,
  pageHeight: number
): HighlightRect[] {
  return rects.map(rect => ({
    x: rect.x / pageWidth,
    y: rect.y / pageHeight,
    width: rect.width / pageWidth,
    height: rect.height / pageHeight,
  }));
}

/**
 * Denormalize rects back to pixel values for rendering.
 * Converts from 0-1 range to actual pixel coordinates.
 */
export function denormalizeRects(
  rects: HighlightRect[],
  pageWidth: number,
  pageHeight: number
): Array<{ x: number; y: number; width: number; height: number }> {
  return rects.map(rect => ({
    x: rect.x * pageWidth,
    y: rect.y * pageHeight,
    width: rect.width * pageWidth,
    height: rect.height * pageHeight,
  }));
}

/**
 * Merge overlapping or adjacent rects for cleaner rendering.
 * This reduces visual artifacts from multiple overlapping highlight boxes.
 */
export function mergeRects(rects: HighlightRect[]): HighlightRect[] {
  if (rects.length <= 1) return rects;

  // Sort by y position, then x
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.y - b.y) < 0.01) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const merged: HighlightRect[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Check if on same line and adjacent/overlapping
    const sameLine = Math.abs(current.y - next.y) < 0.01;
    const overlapping = current.x + current.width >= next.x - 0.01;

    if (sameLine && overlapping) {
      // Merge by extending width to cover both rects
      const newWidth = Math.max(
        current.x + current.width,
        next.x + next.width
      ) - current.x;
      current = { ...current, width: newWidth };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}
