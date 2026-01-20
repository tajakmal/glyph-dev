---
task: Text Rendering and Selection Mapping
priority: 2
depends_on: ["002-tokenization-word-mapping.md", "004-text-reader-scaffold.md"]
---

# Task: Text Rendering and Selection Mapping

Render text content as word spans and map user selections to word indices with a selection popover.

## Overview

Text highlights, bookmarks, and speed read selection all depend on accurate word indices. This task renders every word in the text reader with a word index and implements selection handling that maps a DOM selection to start/end word indices. It also updates selection highlight styling to match the red ORP color family.

## Context

The PDF reader already has a selection popover, but text documents are currently rendered as plain text. We need word-level spans to support precise navigation and mapping to word indices.

## Requirements

- Text rendering in `TextReader`:
  - Use the shared `tokenize` helper to split content into words.
  - Render each word in its own `span` with `data-word-index` and a stable key.
  - Preserve readable spacing between words (use a trailing space node or CSS `white-space` handling).
  - Keep the content read-only (no contenteditable).
- Selection handling:
  - Add a selection listener scoped to the text container.
  - On mouseup selection, compute `{ startWord, endWord, text }` using word span indices:
    - Use the selection `Range` to find the nearest `span[data-word-index]` for start and end.
    - Normalize ordering so `startWord <= endWord`.
  - Store selection state in `TextReader` so later tasks can create highlights and speed read from it.
- Selection popover:
  - Add a popover anchored to the selection bounding rect.
  - The popover should offer:
    - Highlight color buttons (reuse `SelectionPopover` from `src/components/pdf/PDFHighlightPopover.tsx` if possible)
    - Speed Read action (to be wired later)
    - Close action
  - The popover should close on outside click and Escape.
- Selection highlight styling:
  - Update `src/app/globals.css` to define a red selection color for text reader content.
  - Use a class selector so only text reader content uses the red selection, not all UI.
  - Example target: `rgba(239, 68, 68, 0.45)`.

## Success Criteria

1. [x] TextReader renders content as word spans with `data-word-index` attributes.
2. [x] Text selection maps to accurate start/end word indices.
3. [x] Selection popover appears on selection and can be dismissed.
4. [x] Text selection highlight uses the red ORP color family.
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
