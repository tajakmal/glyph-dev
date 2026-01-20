# Progress Log

Task started: 2026-01-20 17:53:15

### 2026-01-20 17:53:15
**Iteration 1 started**

### Criterion 1: PDF page indicator updates correctly while scrolling
**Status: COMPLETED**

Replaced DOM-visibility-based page tracking with scrollTop-based calculation in `src/components/pdf/PDFViewer.tsx` (lines 418-459).

Changes made:
- Removed logic that finds "most visible page" by querying DOM elements
- Added `calculateCurrentPage()` function that uses accumulated `pageHeights` and `estimatedPageHeight`
- Uses `scrollTop + viewportHeight * 0.25` offset so indicator updates as user enters a page
- Works correctly even when pages are virtualized (not rendered in DOM)
- Added `pageCount`, `pageHeights`, `estimatedPageHeight` to useEffect dependencies
