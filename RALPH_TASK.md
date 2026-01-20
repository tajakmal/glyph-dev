---
task: Shared Tokenization and Word Index Mapping
priority: 1
depends_on: ["001-document-types-storage.md"]
---

# Task: Shared Tokenization and Word Index Mapping

Create a single, shared tokenization and word-index mapping utility used by PDF, text reader, and speed read so word indices stay consistent everywhere.

## Overview

The PRD requires starting speed read at a selected word, returning to the exact word, and mapping word indices across PDF pages. That only works if every surface uses identical tokenization and indexing rules. This task introduces shared utilities for tokenization and word-index mapping and wires them into the PDF and text pipelines (no UI yet).

## Context

Right now, PDF text extraction and speed read tokenization are handled in multiple places with slightly different logic. Text documents will add yet another pipeline. A shared helper avoids drift and makes word-index based highlights and bookmarks reliable.

## Requirements

- Add a new helper in `src/lib/tokenize.ts` (or similar) that exports:
  - `tokenize(text: string): string[]` that:
    - splits on whitespace (`/\s+/`)
    - trims input
    - filters empty tokens
  - `buildWordBoundaries(text: string): Array<{ start: number; end: number }>` that returns char offset ranges for each word using the same tokenization rules.
  - `getWordIndexAtOffset(offset: number, boundaries: Array<{ start: number; end: number }>): number` that returns the closest word index for a given character offset.
- Add PDF-specific mapping helpers (in `src/lib/pdf-utils.ts` or a new `src/lib/word-mapping.ts`):
  - `buildPageWordCounts(pdf: PDFDocumentProxy): Promise<number[]>` that extracts page text and tokenizes it using `tokenize`.
  - `mapWordIndexToPage(wordIndex: number, pageWordCounts: number[]): { page: number; indexOnPage: number }`.
  - `mapSelectionToWordIndex(selectionRange: Range, pageWordCounts: number[], currentPage: number): number` that:
    - counts words before the selection within the page using the same tokenization helper
    - adds all prior page word counts
- Add text-specific mapping helpers:
  - `getSelectionWordRange(selectionRange: Range, boundaries: Array<{ start: number; end: number }>): { startWord: number; endWord: number }` based on selection offsets.
- Ensure the following call sites use the shared helpers (no UI changes yet, just switch tokenization logic):
  - `src/components/SpritzReader.tsx` (replace its local `split(/\s+/)` logic with `tokenize`).
  - `src/lib/pdf-utils.ts` `extractAllText` uses tokenization rules consistent with the helper (not required to change output formatting, but should be used by speed read flow later).
- Include inline documentation/comments for each helper explaining the required consistency guarantees.

## Success Criteria

1. [x] Shared tokenization helper exists and is used for all new word-index operations.
2. [x] PDF page word count mapping utility returns stable counts per page.
3. [x] Text selection word range mapping helper is available for the text reader.
4. [x] `SpritzReader` no longer uses its own tokenization logic.
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
