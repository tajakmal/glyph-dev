---
task: Text Bookmarks and Position Indicator
priority: 2
depends_on: ["001-document-types-storage.md", "005-text-render-selection.md"]
---

# Task: Text Bookmarks and Position Indicator

Add word-index based bookmarks for text documents and show a live word position indicator while scrolling.

## Overview

Text bookmarks store a word index and render a snippet label in the sidebar. The reader also needs a position indicator showing word progress and a bookmark toggle that applies to the current word.

## Context

Bookmarks today are page-based and specific to PDFs. The PRD requires word-index bookmarks for text documents and a position indicator of the current word within the text.

## Requirements

- Bookmarks data model:
  - Ensure `TextBookmark` entries are persisted with `kind: 'text'` and `wordIndex`.
  - Update or extend `useBookmarks` to support text bookmarks while preserving PDF behavior.
- Current word tracking:
  - Track the "current word" based on scroll position in the text container.
  - Use `elementFromPoint` near the top of the container (with a small vertical offset) to find the nearest `span[data-word-index]`.
  - Update `currentWordIndex` on scroll with a requestAnimationFrame throttle to avoid jank.
- Position indicator in the top bar:
  - Display `Word X / Y (Z%)` where:
    - `X = currentWordIndex + 1`
    - `Y = total word count`
    - `Z = Math.round((X / Y) * 100)`
  - If word count is missing in metadata, compute it from tokenized words.
- Bookmark toggle:
  - Add a bookmark button in the TextReader top bar.
  - Active state when there is a bookmark at `currentWordIndex`.
  - Clicking toggles bookmark add/remove at current word.
  - Add keyboard shortcut `B` to toggle (ignore when focus is in inputs or textareas).
- Sidebar list:
  - In Bookmarks tab, list text bookmarks sorted by word index.
  - Label format: `snippet + position` where:
    - Snippet is 40-60 characters centered on the bookmarked word.
    - Position uses the same `Word X / Y (Z%)` format.
  - Clicking a bookmark scrolls to the word span (`scrollIntoView`).

## Success Criteria

1. [x] Text bookmarks are stored with `wordIndex` and load correctly for a document.
2. [x] Current word index updates while scrolling and drives the position indicator.
3. [x] Bookmark toggle works via button and `B` key.
4. [x] Bookmarks sidebar lists snippet + position and scrolls on click.
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
