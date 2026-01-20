---
task: Text Highlights and Notes
priority: 2
depends_on: ["001-document-types-storage.md", "005-text-render-selection.md"]
---

# Task: Text Highlights and Notes

Implement text highlights stored as word-index ranges, including overlap merging and note handling.

## Overview

Text highlights are stored by word index ranges, rendered inline in the reader, and editable via a popover. This task adds the highlight creation and merge logic as well as the Notes sidebar list for text documents.

## Context

PDF highlights already exist, but text highlights require word-level storage and merging rules. The PRD defines how overlapping highlights should merge and how notes should be preserved or combined.

## Requirements

- Data model and storage integration:
  - Ensure `TextHighlight` is persisted in localStorage with `kind: 'text'`, `startWord`, `endWord`, and `text`.
  - Reuse `useHighlights` or create a `useTextHighlights` hook that filters by `documentId` and `kind: 'text'`.
- Highlight creation from selection:
  - Use `startWord` and `endWord` from the selection state (Task 005).
  - Build the highlight `text` from the selected word range using the tokenized word array.
- Merge logic for overlapping highlights:
  - Two highlights overlap if their word ranges intersect.
  - Merge behavior:
    - New range = union of overlapping ranges.
    - Color = newly selected color.
    - Notes:
      - If the new highlight includes a note, use it.
      - Else if exactly one overlapping highlight has a note, keep that note.
      - Else if multiple overlapping highlights have notes, concatenate them separated by a blank line and truncate to `VALIDATION.MAX_NOTE_LENGTH`.
  - Replace overlapping highlights in storage with the merged result.
- Inline rendering in text reader:
  - Apply background color to word spans for highlights (use `HIGHLIGHT_COLORS[color].bg`).
  - When multiple highlights exist, ensure merged range renders as a single contiguous highlight.
- Highlight popover for text:
  - Clicking a highlighted word opens a popover allowing:
    - Color change
    - Note edit
    - Delete
    - Speed Read action (wired later)
  - Reuse `HighlightPopover` from PDF if possible, but ensure it accepts text highlights.
- Notes sidebar:
  - Populate Notes tab with text highlights that have notes.
  - Show a snippet of highlighted text and the note.
  - Clicking a note scrolls to the highlight range in the text reader.

## Success Criteria

1. [x] Text highlights are created and stored as word-index ranges.
2. [x] Overlapping highlights merge using the PRD rules for range, color, and notes.
3. [x] Highlights render inline across the correct word spans.
4. [ ] Highlight popover supports color change, note edit, delete, and speed read action.
5. [ ] Notes sidebar lists note-bearing highlights and scrolls to them.
6. [ ] files added or edited

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
