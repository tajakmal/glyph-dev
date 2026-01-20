# Progress Log

Task started: 2026-01-20 17:19:28

### 2026-01-20 17:19:29
**Iteration 1 started**

### 2026-01-20 (continued)
**Completed: Shared Tokenization and Word Index Mapping**

All criteria completed:

1. **Created `src/lib/tokenize.ts`** - Core tokenization utilities:
   - `tokenize(text)`: Canonical tokenization function (trims, splits on whitespace, filters empty)
   - `buildWordBoundaries(text)`: Returns char offset ranges for each word
   - `getWordIndexAtOffset(offset, boundaries)`: Maps char offset to word index
   - `getSelectionWordRange(selectionRange, boundaries)`: Maps DOM selection to word range
   - `getTextForWordRange(text, startWord, endWord)`: Extracts text for word range

2. **Created `src/lib/word-mapping.ts`** - PDF-specific mapping utilities:
   - `buildPageWordCounts(pdf)`: Extracts word counts per page using shared tokenize
   - `mapWordIndexToPage(wordIndex, counts)`: Maps global word index to page/offset
   - `mapPageToWordIndex(page, indexOnPage, counts)`: Inverse mapping
   - `getTotalWordCount(counts)`: Sum across all pages
   - `getCumulativeWordCount(page, counts)`: Words before a page
   - `mapSelectionToWordIndex(pageText, offset, page, counts)`: Selection to global index
   - `mapRangeSelectionToWordIndex(range, page, counts, text)`: Range version

3. **Updated `src/components/SpritzReader.tsx`**:
   - Added import for shared `tokenize` function
   - Replaced `parseText` local tokenization with shared `tokenize()`
   - Replaced word count displays (file info and text input) with `tokenize()`

4. **Build verified**: `npm run build` completes successfully with no errors

### 2026-01-20 17:22:37
**Iteration 1 ended** - TASK COMPLETE
