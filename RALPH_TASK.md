---
task: PDF.js Setup and Configuration
priority: 1
depends_on: ["001-typescript-types"]
---

# Task: PDF.js Setup and Configuration

Install and configure pdfjs-dist for PDF rendering in the Next.js application.

## Overview

This task sets up Mozilla's PDF.js library (pdfjs-dist) for rendering PDFs in the browser. It includes installing the package, configuring the web worker, copying required static files, and creating utility functions for PDF operations.

## Context

- Using pdfjs-dist ^4.0.0
- PDF.js requires a web worker for performance
- Character maps (cmaps) needed for international fonts
- Next.js webpack config needs adjustment for PDF.js
- Utility functions go in `src/lib/pdf-utils.ts`

## Requirements

### Install Dependencies

```bash
npm install pdfjs-dist uuid
npm install --save-dev @types/uuid
```

### Next.js Configuration

**File:** `next.config.js` or `next.config.ts`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Disable canvas for PDF.js (not needed in browser)
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
```

### Copy Static Files

Create a script or manually copy these files from `node_modules/pdfjs-dist`:

1. Copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `public/pdf.worker.min.mjs`
2. Copy `node_modules/pdfjs-dist/cmaps/` folder to `public/cmaps/`

**Recommended:** Add a postinstall script to `package.json`:

```json
{
  "scripts": {
    "postinstall": "cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/ && cp -r node_modules/pdfjs-dist/cmaps public/"
  }
}
```

### PDF Utility Functions

**File:** `src/lib/pdf-utils.ts`

```typescript
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, TextContent } from 'pdfjs-dist';

// Set worker path
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/**
 * Load a PDF document from an ArrayBuffer
 */
export async function loadPDF(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  return pdfjsLib.getDocument({
    data,
    cMapUrl: '/cmaps/',
    cMapPacked: true,
  }).promise;
}

/**
 * Render a PDF page to a canvas element
 * Handles HiDPI displays correctly
 */
export async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number
): Promise<void> {
  const dpr = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * dpr });

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${viewport.width / dpr}px`;
  canvas.style.height = `${viewport.height / dpr}px`;

  const ctx = canvas.getContext('2d')!;

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;
}

/**
 * Get text content from a PDF page
 */
export async function getTextContent(page: PDFPageProxy): Promise<TextContent> {
  return page.getTextContent();
}

/**
 * Extract PDF metadata (title, page count)
 */
export async function extractPDFMetadata(
  pdf: PDFDocumentProxy,
  fileName: string
): Promise<{ title: string; pageCount: number }> {
  const metadata = await pdf.getMetadata();
  const info = metadata.info as Record<string, unknown>;

  // Use PDF title if available, otherwise use filename
  const title = (info?.Title as string) || fileName.replace(/\.pdf$/i, '');

  return {
    title,
    pageCount: pdf.numPages,
  };
}

/**
 * Generate a thumbnail from the first page of a PDF
 * Returns a JPEG data URL
 */
export async function generateThumbnail(
  pdf: PDFDocumentProxy,
  targetWidth: number = 200
): Promise<string> {
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });

  // Calculate scale to fit target width
  const scale = targetWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  // Create off-screen canvas
  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  const ctx = canvas.getContext('2d')!;

  await page.render({
    canvasContext: ctx,
    viewport: scaledViewport,
  }).promise;

  // Convert to JPEG data URL (quality 0.7)
  return canvas.toDataURL('image/jpeg', 0.7);
}

/**
 * Get the outline (table of contents) from a PDF
 */
export async function getPDFOutline(
  pdf: PDFDocumentProxy
): Promise<Array<{ title: string; page: number; items: Array<unknown> }>> {
  const outline = await pdf.getOutline();

  if (!outline) {
    return [];
  }

  // Process outline items recursively
  const processItems = async (items: typeof outline): Promise<Array<{ title: string; page: number; items: Array<unknown> }>> => {
    const result = [];

    for (const item of items) {
      let page = 1;

      if (item.dest) {
        try {
          // Resolve named destination to page number
          const dest = typeof item.dest === 'string'
            ? await pdf.getDestination(item.dest)
            : item.dest;

          if (dest) {
            const pageIndex = await pdf.getPageIndex(dest[0]);
            page = pageIndex + 1; // Convert to 1-based
          }
        } catch {
          // Keep default page 1 if destination resolution fails
        }
      }

      result.push({
        title: item.title,
        page,
        items: item.items ? await processItems(item.items) : [],
      });
    }

    return result;
  };

  return processItems(outline);
}

/**
 * Extract all text from a PDF (for full-document speed reading)
 */
export async function extractAllText(pdf: PDFDocumentProxy): Promise<string> {
  const texts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ');
    texts.push(pageText);
  }

  return texts.join('\n\n');
}
```

### Type Exports for PDF.js

Add to `src/types/index.ts` or create `src/types/pdf.ts`:

```typescript
// Re-export commonly used PDF.js types for convenience
export type { PDFDocumentProxy, PDFPageProxy, TextContent } from 'pdfjs-dist';
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add pdfjs-dist, uuid dependencies and postinstall script |
| `next.config.js` | Modify | Add webpack canvas alias |
| `public/pdf.worker.min.mjs` | Create | Copy from node_modules |
| `public/cmaps/` | Create | Copy from node_modules |
| `src/lib/pdf-utils.ts` | Create | PDF utility functions |

## Success Criteria

1. [x] pdfjs-dist is installed (check package.json)
2. [x] uuid is installed (check package.json)
3. [x] next.config.js has webpack canvas alias configuration
4. [x] `public/pdf.worker.min.mjs` exists
5. [x] `public/cmaps/` directory exists with .bcmap files
6. [x] `src/lib/pdf-utils.ts` exists with loadPDF function
7. [x] `src/lib/pdf-utils.ts` has renderPage function with HiDPI support
8. [x] `src/lib/pdf-utils.ts` has getTextContent function
9. [x] `src/lib/pdf-utils.ts` has generateThumbnail function
10. [x] `src/lib/pdf-utils.ts` has extractPDFMetadata function
11. [x] `npm run type-check` passes
12. [x] `npm run lint` passes
13. [x] `npm run dev` starts without PDF.js errors

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
