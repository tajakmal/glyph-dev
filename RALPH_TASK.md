---
task: Paste Text Flow and Library Updates
priority: 1
depends_on: ["001-document-types-storage.md"]
---

# Task: Paste Text Flow and Library Updates

Add a Paste Text workflow on the Home page and update library cards to display text documents alongside PDFs.

## Overview

Users need to paste text, save it as a document, and see it immediately in the library grid. This task adds the Paste Text UI, creates text documents in storage, and updates library cards and empty states to support both document kinds.

## Context

The current Home page only supports PDF uploads and library cards only render PDF metadata. The PRD requires text documents to be first-class citizens in the library, including distinct card metadata (word count and preview), a Text badge, and context menu actions.

## Requirements

- Home page UI (`src/app/page.tsx`):
  - Add a new Paste Text panel next to or below the existing PDF Upload zone.
  - Paste Text panel must include:
    - Title input (optional)
    - Text area for paste
    - Live word count
    - Save button disabled when text is empty or whitespace
  - Default title logic:
    - If title input is empty, use the first non-empty line of the text
    - If that is missing, use `"Untitled Text"`
  - After save:
    - Clear the text input and reset the title input
    - The new document appears in the library grid immediately
- Document creation logic (`src/hooks/useDocumentLibrary.ts`):
  - Add `addTextDocument` that accepts `{ title?, content }` and returns a `DocumentMeta`.
  - Create metadata with `kind: 'text'`, `wordCount`, and `textPreview` (first ~160 chars, whitespace collapsed).
  - Use `storeText` from `src/lib/storage.ts` to persist content to IndexedDB.
  - Ensure `lastOpenedAt` and `addedAt` are set consistently with PDFs.
  - Keep text documents read-only (no edit flow for the actual content).
- Library grid and cards:
  - Update `src/components/library/LibraryGrid.tsx` empty state to mention both upload and paste (example: "Upload a PDF or paste text to get started").
  - Update `src/components/library/DocumentCard.tsx` to render text documents:
    - Show a "Text" badge or icon on the thumbnail area.
    - Show word count instead of page count and file size.
    - Show a short preview line (use `textPreview`, fallback to `"No preview"`).
    - Keep the context menu actions: Open, Speed Read, Rename, Delete.
    - Speed Read for text documents should open the full document speed reader (same route shape as PDFs).
  - For PDFs, preserve existing card UI and metadata.
- Ensure text document cards still open `/reader/:id` on click.

## Success Criteria

1. [x] Home page has a Paste Text panel with title, text area, word count, and disabled Save when empty.
2. [x] `addTextDocument` stores text content in IndexedDB and metadata in localStorage.
3. [x] Library grid shows both PDF and text cards, with correct metadata and previews for text.
4. [x] Library empty state references both PDF upload and text paste.
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
