import type { DocumentMeta, PDFHighlight } from '@/types';

/**
 * Generate Markdown content from highlights
 */
export function generateAnnotationsMarkdown(
  document: DocumentMeta,
  highlights: PDFHighlight[]
): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${document.title}`);
  lines.push('');
  lines.push(`Exported from Glyph on ${formatDate(new Date())}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (highlights.length === 0) {
    lines.push('*No highlights in this document.*');
    return lines.join('\n');
  }

  // Group highlights by page
  const byPage = highlights.reduce((acc, h) => {
    if (!acc[h.page]) acc[h.page] = [];
    acc[h.page].push(h);
    return acc;
  }, {} as Record<number, PDFHighlight[]>);

  // Sort pages
  const pages = Object.keys(byPage)
    .map(Number)
    .sort((a, b) => a - b);

  let highlightCount = 0;

  for (const page of pages) {
    const pageHighlights = byPage[page];

    // Sort by creation time within page
    pageHighlights.sort((a, b) => a.createdAt - b.createdAt);

    lines.push(`## Page ${page}`);
    lines.push('');

    for (const highlight of pageHighlights) {
      highlightCount++;

      // Format color label
      const colorLabel = formatColorLabel(highlight.color);

      // Quoted text
      lines.push(`> "${escapeMarkdown(highlight.text)}" [${colorLabel}]`);
      lines.push('');

      // Note if present
      if (highlight.note) {
        lines.push(`**Note:** ${escapeMarkdown(highlight.note)}`);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  // Summary
  lines.push(`*Exported ${highlightCount} highlight${highlightCount !== 1 ? 's' : ''} from ${pages.length} page${pages.length !== 1 ? 's' : ''}*`);

  return lines.join('\n');
}

/**
 * Trigger download of the markdown file
 */
export function downloadAnnotations(
  documentMeta: DocumentMeta,
  highlights: PDFHighlight[]
): void {
  const content = generateAnnotationsMarkdown(documentMeta, highlights);
  const filename = sanitizeFilename(documentMeta.title) + '_annotations.md';

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  window.document.body.appendChild(a);
  a.click();

  // Cleanup
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper functions

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatColorLabel(color: string): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

function escapeMarkdown(text: string): string {
  // Escape special markdown characters in the text
  return text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\n/g, ' '); // Replace newlines with spaces in quoted text
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .slice(0, 100); // Limit length
}
