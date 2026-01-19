import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';

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
    canvas,
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
    canvas,
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
