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

### Criterion 2: Bookmark toggle reflects the correct current page
**Status: COMPLETED**

No additional code changes required. The bookmark toggle in `PDFControls` (line 727-728) and the B keyboard shortcut (line 204) both use `currentPage` state, which is now correctly calculated via scrollTop-based logic from criterion 1.

### Criterion 3: PDF top bar includes a Home/Library button
**Status: COMPLETED**

Added Home/Library button to `src/components/pdf/PDFControls.tsx`:
- Added `import Link from 'next/link'` at the top
- Added Home button with house icon at the left side of the top bar (before sidebar toggle)
- Button links to `/` (Library page)
- Has accessible label "Go to Library" and title tooltip "Library"

### Criterion 4: PDF selection highlight uses red ORP color family
**Status: COMPLETED**

Updated `.pdf-text-layer span::selection` in `src/app/globals.css`:
- Changed from `rgba(59, 130, 246, 0.3)` (blue) to `rgba(239, 68, 68, 0.45)` (red ORP family)

### Criterion 5: Files added or edited
**Status: COMPLETED**

Files modified:
- `src/components/pdf/PDFViewer.tsx` - scrollTop-based page indicator calculation
- `src/components/pdf/PDFControls.tsx` - Home/Library navigation button
- `src/app/globals.css` - red ORP selection color for PDF text

---

## Task Complete

All 5 criteria have been completed successfully.
