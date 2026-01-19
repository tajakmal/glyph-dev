---
task: Annotation Export
priority: 4
depends_on: ["014-highlights-system", "013-sidebar-toc"]
---

# Task: Annotation Export

Implement the export functionality that generates a Markdown file containing all highlights and notes for a document.

## Overview

This task creates the export feature that allows users to download their annotations as a Markdown file. The export includes all highlights grouped by page, with their text, color, and any associated notes. The file is formatted for easy reading and import into note-taking apps.

## Context

- Export format from PRD Section 4.7
- Trigger: Button in sidebar or Ctrl+Shift+E
- Output: Downloaded .md file
- Filename: `{document-title}_annotations.md`

## Requirements

### Export Utility

**File:** `src/lib/export.ts`

```typescript
import type { Highlight, DocumentMeta } from '@/types';

/**
 * Generate Markdown content from highlights
 */
export function generateAnnotationsMarkdown(
  document: DocumentMeta,
  highlights: Highlight[]
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
  }, {} as Record<number, Highlight[]>);

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
  document: DocumentMeta,
  highlights: Highlight[]
): void {
  const content = generateAnnotationsMarkdown(document, highlights);
  const filename = sanitizeFilename(document.title) + '_annotations.md';

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();

  // Cleanup
  document.body.removeChild(a);
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
```

### Alternative Export Formats (Optional Enhancement)

```typescript
/**
 * Generate JSON export for programmatic use
 */
export function generateAnnotationsJSON(
  document: DocumentMeta,
  highlights: Highlight[]
): string {
  const data = {
    document: {
      id: document.id,
      title: document.title,
      pageCount: document.pageCount,
    },
    exportedAt: new Date().toISOString(),
    highlights: highlights.map(h => ({
      page: h.page,
      color: h.color,
      text: h.text,
      note: h.note,
      createdAt: new Date(h.createdAt).toISOString(),
    })),
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Generate plain text export
 */
export function generateAnnotationsText(
  document: DocumentMeta,
  highlights: Highlight[]
): string {
  const lines: string[] = [];

  lines.push(document.title);
  lines.push('='.repeat(document.title.length));
  lines.push('');
  lines.push(`Exported: ${formatDate(new Date())}`);
  lines.push('');

  // Group by page
  const byPage = highlights.reduce((acc, h) => {
    if (!acc[h.page]) acc[h.page] = [];
    acc[h.page].push(h);
    return acc;
  }, {} as Record<number, Highlight[]>);

  const pages = Object.keys(byPage).map(Number).sort((a, b) => a - b);

  for (const page of pages) {
    lines.push(`Page ${page}`);
    lines.push('-'.repeat(10));

    for (const h of byPage[page]) {
      lines.push(`"${h.text}"`);
      if (h.note) {
        lines.push(`  Note: ${h.note}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
```

### Keyboard Shortcut

Add to PDFViewer:

```typescript
// Handle Ctrl+Shift+E for export
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'e') {
      e.preventDefault();
      handleExport();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleExport]);

const handleExport = useCallback(() => {
  if (highlights.length === 0) {
    // Could show a toast: "No highlights to export"
    return;
  }

  if (documentMeta) {
    downloadAnnotations(documentMeta, highlights);
  }
}, [highlights, documentMeta]);
```

### Wire Up Export Button in Sidebar

In PDFSidebar, the onExport callback should trigger the download:

```typescript
// In the parent component (PDFViewer)
<PDFSidebar
  // ... other props
  onExport={() => {
    if (meta && highlights.length > 0) {
      downloadAnnotations(meta, highlights);
    }
  }}
/>
```

### Example Export Output

```markdown
# Research Paper on Machine Learning

Exported from Glyph on January 18, 2026

---

## Page 3

> "This is a highlighted passage that was marked as important." [Yellow]

**Note:** This is my annotation about the highlight.

---

## Page 7

> "Another highlighted section from the document." [Green]

---

## Page 12

> "A third highlight with a longer note attached." [Blue]

**Note:** This is a longer note that provides additional context and thoughts about the highlighted passage.

---

*Exported 3 highlights from 3 pages*
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/export.ts` | Create | Export utilities for Markdown generation |
| `src/components/pdf/PDFViewer.tsx` | Modify | Add export keyboard shortcut |
| `src/components/pdf/PDFSidebar.tsx` | Modify | Wire up export button |

## Success Criteria

1. [x] `src/lib/export.ts` exists
2. [x] generateAnnotationsMarkdown produces valid Markdown
3. [x] Highlights are grouped by page number
4. [x] Each highlight shows quoted text and color label
5. [x] Notes are included with **Note:** prefix
6. [x] Summary shows count of highlights and pages
7. [x] downloadAnnotations triggers file download
8. [x] Filename is sanitized and includes document title
9. [x] Special characters in text are escaped
10. [x] Ctrl+Shift+E triggers export
11. [x] Export button in sidebar triggers download
12. [x] Export is disabled when no highlights exist
13. [x] Export date is formatted correctly
14. [x] Exported file has .md extension
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
