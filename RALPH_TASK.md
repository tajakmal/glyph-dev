---
task: Speed Reading Integration
priority: 5
depends_on: ["005-pdf-viewer-component", "015-highlight-popover-notes"]
---

# Task: Speed Reading Integration

Connect the PDF reader to the existing RSVP speed reading functionality, allowing users to speed-read selected text, highlights, or entire documents.

## Overview

This task integrates the existing SpritzReader component with the new PDF reader. Users can trigger speed reading from multiple entry points: selection popover, highlight popover, toolbar button, and library card context menu. The speed reader should accept text via URL parameters or sessionStorage, and provide navigation back to the reader.

## Context

- Existing SpritzReader component in src/components/SpritzReader.tsx
- Multiple entry points from PRD Section 4.8
- Data passing via URL params (small text) or sessionStorage (large text)
- Return navigation should restore scroll position

## Requirements

### Update Speed Read Route

**File:** `src/app/speed-read/page.tsx`

```typescript
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SpritzReader } from '@/components/SpritzReader';
import { getPDF } from '@/lib/storage';
import { loadPDF, extractAllText } from '@/lib/pdf-utils';
import { getDocuments } from '@/lib/storage';

function SpeedReadContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [text, setText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [returnPath, setReturnPath] = useState<string | null>(null);

  useEffect(() => {
    const loadText = async () => {
      setIsLoading(true);

      try {
        // Check for text in URL params (small text)
        const urlText = searchParams.get('text');
        if (urlText) {
          setText(decodeURIComponent(urlText));
          setIsLoading(false);
          return;
        }

        // Check for text in sessionStorage
        const source = searchParams.get('source');
        if (source === 'session') {
          const sessionText = sessionStorage.getItem('glyph:speedread-text');
          if (sessionText) {
            setText(sessionText);
            sessionStorage.removeItem('glyph:speedread-text');
          }
          setIsLoading(false);
          return;
        }

        // Check for document ID (full document speed read)
        const documentId = searchParams.get('documentId');
        if (documentId) {
          // Get document metadata
          const documents = getDocuments();
          const doc = documents.find(d => d.id === documentId);
          if (doc) {
            setDocumentTitle(doc.title);
            setReturnPath(`/reader/${documentId}`);
          }

          // Load PDF and extract text
          const pdfData = await getPDF(documentId);
          if (pdfData) {
            const pdf = await loadPDF(pdfData);
            const extractedText = await extractAllText(pdf);
            setText(extractedText);
          }
          setIsLoading(false);
          return;
        }

        // No text source found
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load text:', error);
        setIsLoading(false);
      }
    };

    // Get return path from sessionStorage
    const storedReturnPath = sessionStorage.getItem('glyph:speedread-return');
    if (storedReturnPath) {
      setReturnPath(storedReturnPath);
    }

    loadText();
  }, [searchParams]);

  const handleBack = () => {
    if (returnPath) {
      router.push(returnPath);
    } else {
      router.push('/');
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
          <p className="text-zinc-400">Loading text...</p>
        </div>
      </div>
    );
  }

  if (!text) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950">
        <p className="text-zinc-400 mb-4">No text to speed read.</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-zinc-800 text-zinc-200 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header with back button */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-zinc-800">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Reader</span>
        </button>
        {documentTitle && (
          <span className="text-zinc-500 text-sm truncate">
            Reading: {documentTitle}
          </span>
        )}
      </div>

      {/* Speed Reader */}
      <div className="flex-1 overflow-hidden">
        <SpritzReader initialText={text} />
      </div>
    </div>
  );
}

export default function SpeedReadPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
      </div>
    }>
      <SpeedReadContent />
    </Suspense>
  );
}
```

### Update SpritzReader Component

**File:** `src/components/SpritzReader.tsx` (update)

Add support for initialText prop:

```typescript
interface SpritzReaderProps {
  /** Initial text to speed read (optional) */
  initialText?: string;
}

export function SpritzReader({ initialText }: SpritzReaderProps) {
  const [text, setText] = useState(initialText || '');
  // ... rest of existing implementation

  // If initialText is provided, skip the input UI
  useEffect(() => {
    if (initialText) {
      setText(initialText);
      // Optionally auto-start
    }
  }, [initialText]);

  // ... existing render
}
```

### Navigation Helper Functions

**File:** `src/lib/speed-read.ts`

```typescript
import { useRouter } from 'next/navigation';

/**
 * Navigate to speed reader with text
 * Uses URL params for small text (<2000 chars), sessionStorage for larger
 */
export function navigateToSpeedRead(
  router: ReturnType<typeof useRouter>,
  text: string,
  options?: {
    returnPath?: string;
    documentId?: string;
  }
) {
  // Store return path
  if (options?.returnPath) {
    sessionStorage.setItem('glyph:speedread-return', options.returnPath);
  }

  // Small text: use URL params
  if (text.length < 2000) {
    router.push(`/speed-read?text=${encodeURIComponent(text)}`);
    return;
  }

  // Large text: use sessionStorage
  sessionStorage.setItem('glyph:speedread-text', text);
  router.push('/speed-read?source=session');
}

/**
 * Navigate to speed reader for full document
 */
export function navigateToDocumentSpeedRead(
  router: ReturnType<typeof useRouter>,
  documentId: string,
  returnPath?: string
) {
  if (returnPath) {
    sessionStorage.setItem('glyph:speedread-return', returnPath);
  }

  router.push(`/speed-read?documentId=${documentId}`);
}
```

### Add Speed Read Button to Toolbar

**File:** `src/components/pdf/PDFControls.tsx` (update)

```typescript
interface PDFControlsProps {
  // ... existing props
  /** Callback for speed read entire document */
  onSpeedReadDocument?: () => void;
}

// In the toolbar:
<button
  onClick={onSpeedReadDocument}
  className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
  aria-label="Speed read entire document"
  title="Speed read document"
>
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
</button>
```

### Speed Read from Popovers

In PDFHighlightPopover, the onSpeedRead callback should:

```typescript
// In selection popover
const handleSpeedRead = () => {
  navigateToSpeedRead(router, selection.text, {
    returnPath: `/reader/${documentId}`,
  });
};

// In highlight popover
const handleSpeedRead = () => {
  navigateToSpeedRead(router, highlight.text, {
    returnPath: `/reader/${documentId}`,
  });
};
```

### Speed Read from Library Card

In DocumentCard context menu, add Speed Read option that navigates:

```typescript
// In context menu
<button
  onClick={(e) => {
    e.stopPropagation();
    setShowContextMenu(false);
    navigateToDocumentSpeedRead(router, document.id);
  }}
>
  Speed Read
</button>
```

### Save and Restore Scroll Position

When navigating to speed read from reader, save scroll position:

```typescript
// Before navigating to speed read
sessionStorage.setItem('glyph:reader-scroll', JSON.stringify({
  documentId,
  scrollTop: containerRef.current?.scrollTop || 0,
}));

// On reader mount, restore if returning from speed read
useEffect(() => {
  const saved = sessionStorage.getItem('glyph:reader-scroll');
  if (saved) {
    const { documentId: savedId, scrollTop } = JSON.parse(saved);
    if (savedId === documentId && containerRef.current) {
      containerRef.current.scrollTop = scrollTop;
    }
    sessionStorage.removeItem('glyph:reader-scroll');
  }
}, [documentId]);
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/speed-read/page.tsx` | Modify | Update to accept text from multiple sources |
| `src/components/SpritzReader.tsx` | Modify | Add initialText prop |
| `src/lib/speed-read.ts` | Create | Navigation helper functions |
| `src/components/pdf/PDFControls.tsx` | Modify | Add speed read button |
| `src/components/pdf/PDFHighlightPopover.tsx` | Modify | Wire up speed read callback |
| `src/components/library/DocumentCard.tsx` | Modify | Add speed read to context menu |

## Success Criteria

1. [x] Speed read route accepts text via URL param
2. [x] Speed read route accepts text via sessionStorage
3. [x] Speed read route accepts documentId for full document
4. [x] SpritzReader accepts initialText prop
5. [x] `src/lib/speed-read.ts` exists with navigation helpers
6. [x] Small text (<2000 chars) uses URL params
7. [x] Large text uses sessionStorage
8. [x] Speed read button in toolbar triggers document speed read
9. [x] Speed read from selection popover works
10. [x] Speed read from highlight popover works
11. [x] Speed read from library card context menu works
12. [x] Back button returns to reader
13. [x] Scroll position is saved before navigating
14. [x] Scroll position is restored when returning
15. [x] Loading state shows while extracting document text
16. [x] Error state shows when no text available
17. [x] `npm run type-check` passes
18. [x] `npm run lint` passes

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
