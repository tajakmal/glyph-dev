---
task: Upload Zone and Library Navigation
priority: 2
depends_on: ["001-typescript-types", "002-shared-ui-components", "007-library-management"]
---

# Task: Upload Zone and Library Navigation

Create the UploadZone, DocumentCard, and LibraryGrid components, and update the home page to show the library.

## Overview

This task builds the library UI that replaces the original RSVP-only home page. Users can upload PDFs via drag-and-drop or click-to-browse, see their documents in a responsive grid, and click to open them in the reader.

## Context

- Components go in `src/components/library/`
- Update `src/app/page.tsx` to show library
- Use the useDocumentLibrary hook
- Follow the UI specs from PRD Section 8.2 and 8.3
- Implement right-click context menu for document actions

## Requirements

### UploadZone Component

**File:** `src/components/library/UploadZone.tsx`

```typescript
'use client';

import React, { useState, useCallback, useRef } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File) => Promise<void>;
  isUploading?: boolean;
  error?: string | null;
}

/**
 * Drag-and-drop upload zone for PDF files
 *
 * States:
 * - Default: Dashed border, upload icon + text
 * - Drag over: Solid border, blue tint
 * - Uploading: Progress spinner
 * - Error: Red border, error message
 */
export function UploadZone({ onFileSelect, isUploading, error }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onFileSelect(file);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div
      className={`
        relative h-[120px] rounded-2xl border-2 border-dashed
        flex items-center justify-center cursor-pointer
        transition-all duration-200
        ${isDragOver ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-600'}
        ${error ? 'border-red-500 bg-red-500/10' : ''}
        ${isUploading ? 'pointer-events-none' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
          <span className="text-zinc-400 text-sm">Uploading...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 text-red-400">
          <span className="text-sm">{error}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-zinc-400">
          {/* Upload Icon */}
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm">Drag & drop PDF here or click to browse</span>
        </div>
      )}
    </div>
  );
}
```

### DocumentCard Component

**File:** `src/components/library/DocumentCard.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentMeta } from '@/types';

interface DocumentCardProps {
  document: DocumentMeta;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export function DocumentCard({ document, onDelete, onRename }: DocumentCardProps) {
  const router = useRouter();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(document.title);

  const handleClick = () => {
    router.push(`/reader/${document.id}`);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== document.title) {
      onRename(document.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  return (
    <>
      <div
        className="
          w-[200px] rounded-xl bg-zinc-900 border border-zinc-800
          cursor-pointer transition-all duration-200
          hover:scale-[1.02] hover:shadow-lg hover:border-red-500/50
        "
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Thumbnail */}
        <div className="aspect-[0.714] bg-zinc-800 rounded-t-xl overflow-hidden">
          {document.thumbnailDataUrl ? (
            <img
              src={document.thumbnailDataUrl}
              alt={document.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              className="w-full bg-zinc-800 text-zinc-100 text-sm font-medium rounded px-2 py-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3 className="text-zinc-100 text-sm font-medium truncate" title={document.title}>
              {document.title}
            </h3>
          )}
          <p className="text-zinc-500 text-xs mt-1">
            {document.pageCount} pages • {formatFileSize(document.fileSize)}
          </p>
          <p className="text-zinc-600 text-xs mt-0.5">
            Last read: p.{document.lastReadPage}
          </p>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                router.push(`/reader/${document.id}`);
              }}
            >
              Open
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                router.push(`/speed-read?documentId=${document.id}`);
              }}
            >
              Speed Read
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                setIsRenaming(true);
              }}
            >
              Rename
            </button>
            <hr className="my-1 border-zinc-700" />
            <button
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                if (confirm('Delete this document? This cannot be undone.')) {
                  onDelete(document.id);
                }
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}
```

### LibraryGrid Component

**File:** `src/components/library/LibraryGrid.tsx`

```typescript
'use client';

import React from 'react';
import type { DocumentMeta } from '@/types';
import { DocumentCard } from './DocumentCard';

interface LibraryGridProps {
  documents: DocumentMeta[];
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export function LibraryGrid({ documents, onDelete, onRename }: LibraryGridProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p>No documents yet.</p>
        <p className="text-sm mt-1">Upload a PDF to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  );
}
```

### Updated Home Page

**File:** `src/app/page.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { useDocumentLibrary } from '@/hooks/useDocumentLibrary';
import { UploadZone } from '@/components/library/UploadZone';
import { LibraryGrid } from '@/components/library/LibraryGrid';

export default function HomePage() {
  const { documents, isLoading, addDocument, removeDocument, updateDocument } = useDocumentLibrary();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      await addDocument(file);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRename = (id: string, newTitle: string) => {
    updateDocument(id, { title: newTitle });
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">GLYPH</h1>
          <p className="text-zinc-500 mt-2">Speed reading, one word at a time</p>
        </header>

        {/* Upload Zone */}
        <section className="mb-8">
          <UploadZone
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
            error={uploadError}
          />
        </section>

        {/* Library */}
        <section>
          <h2 className="text-lg font-medium text-zinc-300 mb-4">
            Your Library {documents.length > 0 && `(${documents.length} documents)`}
          </h2>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
            </div>
          ) : (
            <LibraryGrid
              documents={documents}
              onDelete={removeDocument}
              onRename={handleRename}
            />
          )}
        </section>
      </div>
    </main>
  );
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/library/UploadZone.tsx` | Create | Drag-drop upload component |
| `src/components/library/DocumentCard.tsx` | Create | Document card with context menu |
| `src/components/library/LibraryGrid.tsx` | Create | Responsive document grid |
| `src/components/library/index.ts` | Create | Barrel export |
| `src/app/page.tsx` | Modify | Replace with library view |

## Success Criteria

1. [x] `src/components/library/UploadZone.tsx` exists
2. [x] UploadZone supports drag-and-drop
3. [x] UploadZone supports click-to-browse
4. [x] UploadZone shows loading state during upload
5. [x] UploadZone shows error state on failure
6. [x] `src/components/library/DocumentCard.tsx` exists
7. [x] DocumentCard displays thumbnail, title, page count, file size
8. [x] DocumentCard has right-click context menu
9. [x] Context menu has Open, Speed Read, Rename, Delete options
10. [x] DocumentCard inline rename works
11. [x] `src/components/library/LibraryGrid.tsx` exists
12. [x] LibraryGrid is responsive (2-5 columns based on screen)
13. [x] LibraryGrid shows empty state when no documents
14. [x] Home page shows upload zone and library grid
15. [x] Clicking document card navigates to /reader/[id]
16. [x] `npm run type-check` passes
17. [x] `npm run lint` passes

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
