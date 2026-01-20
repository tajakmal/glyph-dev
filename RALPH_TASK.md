---
task: PDF Page Indicator Accuracy and Home Button
priority: 2
depends_on: ["001-document-types-storage.md"]
---

# Task: PDF Page Indicator Accuracy and Home Button

Fix PDF page indicator accuracy while scrolling and add Home/Library navigation in the PDF reader, plus update PDF selection highlight color.

## Overview

The page indicator currently relies on DOM visibility and can become stale due to virtualization. This task replaces it with scrollTop-based page calculation, ensures bookmarks reflect the correct page, adds a Home/Library action in the top bar, and updates selection highlight color to the red ORP family.

## Context

The PRD calls out inaccurate PDF page indicators and bookmarks when scrolling through virtualized pages. It also requires navigation back to Home/Library and a red selection color.

## Requirements

- Page indicator logic in `src/components/pdf/PDFViewer.tsx`:
  - Replace the "most visible page" calculation with a scrollTop-based calculation using `pageHeights` and `getPageOffset`.
  - Compute the current page based on the scroll position plus a small offset (example: scrollTop + 20px or scrollTop + viewportHeight * 0.25) so the indicator updates as soon as the user enters a page.
  - Ensure the calculation works even when pages are virtualized (use known heights, not DOM visibility).
  - Update `currentPage` state and `onPageChange` accordingly.
- Bookmark toggle accuracy:
  - Ensure the bookmark toggle button uses the corrected `currentPage` value and reflects the correct page while scrolling.
- Home/Library button:
  - Add a Home/Library button to `PDFControls` (left side of the top bar).
  - Button should navigate to `/` and have an accessible label.
  - Preserve existing layout and controls.
- PDF selection highlight color:
  - Update `.pdf-text-layer span::selection` in `src/app/globals.css` to a red-family color (example: `rgba(239, 68, 68, 0.45)`).

## Success Criteria

1. [x] PDF page indicator updates correctly while scrolling with virtualization enabled.
2. [x] Bookmark toggle reflects the correct current page.
3. [x] PDF top bar includes a Home/Library button that navigates to `/`.
4. [ ] PDF selection highlight uses the red ORP color family.
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
