# Progress Log

Task started: 2026-01-20 17:38:17

### 2026-01-20 17:38:17
**Iteration 1 started**

### 2026-01-20
**Criterion 1: Text bookmarks stored with wordIndex**
- Created `src/hooks/useTextBookmarks.ts` - a new hook for managing text bookmarks
- Hook follows the same pattern as `useTextHighlights` and `useBookmarks`
- Uses existing `TextBookmark` type from `src/types/index.ts` (with `kind: 'text'` and `wordIndex`)
- Uses existing storage infrastructure from `src/lib/storage.ts`
- Bookmarks are sorted by word index and persisted to localStorage
