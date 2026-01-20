---
task: Text Reader Scaffold and Navigation
priority: 1
depends_on: ["001-document-types-storage.md", "003-library-paste-text.md"]
---

# Task: Text Reader Scaffold and Navigation

Add a text reader view that mirrors the PDF reader layout and route to it based on document kind.

## Overview

This task introduces a new TextReader component with a top bar, sidebar, and scrollable text content area. The reader should load text content from IndexedDB, handle missing content errors, and support Home/Library navigation. No highlights, bookmarks, or speed read selection logic yet (those come in later tasks).

## Context

The current reader route (`/reader/:id`) always renders a PDF viewer. The PRD requires text documents to open in a reader with a similar layout and UI affordances, but without PDF-specific components.

## Requirements

- Route switch in `src/app/reader/[id]/page.tsx`:
  - Load document metadata for `id` (use `getDocument` or `getDocuments`).
  - If `kind === 'pdf'`, render `PDFViewer` (existing behavior).
  - If `kind === 'text'`, render the new `TextReader` component.
  - If document is missing, show a friendly error state with a "Back to Library" button.
- Create `TextReader` in `src/components/text/TextReader.tsx` (new folder is fine):
  - Layout matches PDF reader: top bar, left sidebar, main content area.
  - Top bar includes:
    - Home/Library button (navigates to `/`)
    - Document title (truncate long titles)
    - Speed Read button (wired to full document speed read later)
    - Bookmark toggle button (placeholder state for now)
    - Position indicator placeholder (for later task)
  - Sidebar includes two tabs: Bookmarks and Notes (no Contents tab).
    - Each tab can show "No bookmarks" or "No notes" placeholder text for now.
  - Main content area:
    - Scrollable container with read-only text content.
    - Use a loading state while text is fetched.
    - If the text content is missing from IndexedDB, show an error message and a Delete action that removes the document (call `deleteDocumentComplete`).
- Ensure `lastOpenedAt` is updated when the reader opens the document (use existing update logic in storage or `useDocumentLibrary`).
- Do not implement selection, highlights, bookmarks, or speed read start here. Keep the component ready to integrate in later tasks.

## Success Criteria

1. [x] `/reader/:id` renders PDF or TextReader based on document kind.
2. [x] TextReader loads text content from IndexedDB with loading and error states.
3. [x] TextReader top bar includes Home/Library navigation and placeholder controls.
4. [x] Sidebar shows Bookmarks and Notes tabs with empty states.
5. [x] files added or edited

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
