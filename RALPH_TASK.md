---
task: Speed Read Selection, Resume, and Focus Return
priority: 2
depends_on: ["002-tokenization-word-mapping.md", "004-text-reader-scaffold.md", "005-text-render-selection.md"]
---

# Task: Speed Read Selection, Resume, and Focus Return

Enable speed read to start at a selected word, continue to the end, and return to the reader at the exact word with a temporary red focus highlight.

## Overview

This task connects selection-based speed reading for both PDFs and text docs, adds session state for returning to a word index, and updates the speed read header with clear navigation back to the reader or library.

## Context

Currently speed read only accepts a text snippet or full PDF text and does not maintain a word index. Returning to the reader restores only scroll position. The PRD requires word-accurate resume and a temporary focus highlight on return.

## Requirements

- Navigation utilities (`src/lib/speed-read.ts`):
  - Extend navigation helpers to accept a `startWordIndex` and `documentKind`.
  - Store `returnPath` and selection metadata in sessionStorage as needed.
- Speed read page (`src/app/speed-read/page.tsx`):
  - Accept query params for:
    - `documentId`
    - `startIndex` (word index)
    - `kind` (`pdf` or `text`)
  - Load text based on kind:
    - `pdf`: use `getPDF` + `loadPDF` + `extractAllText`
    - `text`: use `getText`
  - Use shared `tokenize` helper to parse words.
  - Start playback at `startIndex` when provided; otherwise start at 0.
  - Persist current word index and document id to sessionStorage on index changes.
- SpritzReader updates (`src/components/SpritzReader.tsx`):
  - Accept props:
    - `initialIndex?: number`
    - `onIndexChange?: (index: number) => void`
    - Optionally `words?: string[]` if you prefer to pass pre-tokenized content.
  - Use shared `tokenize` helper instead of local splitting.
  - Call `onIndexChange` whenever `currentIndex` changes (throttle if needed).
- Launching speed read from selection:
  - PDF selection:
    - Use word-index mapping utilities to compute a global `startWordIndex`.
    - If mapping fails (selection spans pages and mapping is unreliable), fall back to passing the selection text as a snippet (per PRD).
  - Text selection:
    - Use selection `startWord` from Task 005.
  - Ensure speed read continues from the selected word to the end of the document (do not limit to selection range).
- Return to reader focus:
  - On reader load, check sessionStorage for `{ documentId, kind, wordIndex }`.
  - If matches current doc:
    - Text reader: scroll to `span[data-word-index="wordIndex"]` and add a temporary red focus highlight class.
    - PDF reader: map `wordIndex` to page using page word counts and scroll to that page. If you can map to a specific word span, highlight it; otherwise highlight the page and document the limitation.
  - Focus highlight should clear on user scroll or click.
- Speed read header:
  - Add a Home/Library action in the speed read header.
  - Keep "Back to Reader" when a return path exists; otherwise default back to `/`.

## Success Criteria

1. [ ] Speed read can start at a specific word index for both PDF and text documents.
2. [ ] Returning from speed read scrolls to the saved word and shows a temporary red focus highlight.
3. [ ] Selection-based speed read continues to the end of the document.
4. [ ] Speed read header includes Home/Library navigation and respects return path.
5. [ ] files added or edited

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
