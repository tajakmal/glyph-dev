---
task: Add Text Document Types and Storage
priority: 1
depends_on: []
---

# Task: Add Text Document Types and Storage

Introduce text documents as a first-class type in the data model and storage layers, with safe migrations for existing PDF-only data.

## Overview

This task upgrades the core data model to support both PDF and text documents, adds IndexedDB storage for text content, and normalizes existing localStorage data so older installs keep working without manual cleanup.

## Context

Today the app assumes every document is a PDF and stores only PDF metadata and binary data. The PRD requires text documents stored as strings, additional metadata fields (word count and preview), and union types for bookmarks and highlights. We must also migrate existing local data to avoid runtime errors and avoid data loss.

## Requirements

- Update type definitions in `src/types/index.ts`:
  - Add `kind: 'pdf' | 'text'` to `DocumentMeta` (required for all documents).
  - Add text-only metadata fields to `DocumentMeta`:
    - `wordCount?: number`
    - `textPreview?: string` (first ~160 characters of the content, trimmed)
  - Make PDF-only fields tolerant for text docs (use optional fields or a union type):
    - `pageCount`, `fileSize`, `fileName`, `lastReadPage`, `thumbnailDataUrl` should not be required for text.
  - Split bookmarks into a union type:
    - `PDFBookmark`: `{ kind: 'pdf'; page: number; ... }`
    - `TextBookmark`: `{ kind: 'text'; wordIndex: number; ... }`
  - Split highlights into a union type:
    - `PDFHighlight`: existing fields plus `{ kind: 'pdf' }`
    - `TextHighlight`: `{ kind: 'text'; startWord: number; endWord: number; color; note?; text; createdAt; updatedAt? }`
- Update `INDEXEDDB_CONFIG` in `src/types/index.ts`:
  - Bump `DB_VERSION` from 1 to 2.
  - Add a new store name constant for text content (for example `STORE_TEXTS: 'texts'`).
- Extend IndexedDB helpers in `src/lib/storage.ts`:
  - Update `getDB` to create the new `texts` store in `onupgradeneeded`.
  - Add `storeText(documentId: string, content: string)`, `getText(documentId: string)`, and `deleteText(documentId: string)`.
  - Update `deleteDocumentComplete` to delete text content in addition to PDFs. If unsure of document kind, attempt both deletes safely.
- Add localStorage normalization helpers in `src/lib/storage.ts`:
  - When reading documents, bookmarks, or highlights, fill missing `kind` with `'pdf'`.
  - Normalize missing fields in legacy data (example: `lastReadPage` defaults to `1` for PDFs).
  - If normalization changes data, write the corrected arrays back to localStorage to keep future reads clean.
  - All normalization must be defensive: no thrown errors on malformed storage entries.
- Do not change UI behavior in this task. This task should only touch types and storage/migration logic.

## Success Criteria

1. [x] `DocumentMeta`, `Bookmark`, and `Highlight` types compile with new union types and `kind` fields.
2. [x] IndexedDB version is bumped and the `texts` store is created in `onupgradeneeded`.
3. [x] `storeText`, `getText`, and `deleteText` are implemented and exported.
4. [x] LocalStorage normalization handles missing `kind` and legacy fields without crashing, and writes back normalized data.
5. [x] `deleteDocumentComplete` removes both PDF binaries and text content safely.
6. [x] files added or edited

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

---

## Questions From Claude (Please Answer)

2. Then list your questions in markdown format with options
3. Be specific about what criterion you're working on
4. The task will move to review for human response

Example:
```
<ralph>CLARIFY</ralph>

## Clarification Needed

**Working on:** Criterion 2 - Database setup
**Blocked because:** Multiple valid approaches, need human decision

### Questions:

1. **Database Choice**
   Which database should be used?
   - PostgreSQL (relational, ACID compliant)
   - MongoDB (document store, flexible schema)
   - SQLite (embedded, lightweight)

2. **Authentication Method**
   How should users authenticate?
   - JWT tokens (stateless)
   - Session cookies (server-side state)
```

Only use CLARIFY when you genuinely cannot proceed without human input.
Do NOT use it for technical questions you can research yourself.

Begin by reading the task and working on the next unchecked criterion.

mcp: context7 starting
mcp: supabase starting
mcp: context7 ready
mcp: supabase ready
mcp startup: ready: context7, supabase

thinking
**Confirming approach to instructions compliance**
exec
/bin/zsh -lc ls in /Users/tajwar/development/glyph-dev succeeded in 6ms:
CLAUDE.md
RALPH_TASK.md
README.md
eslint.config.mjs
next-env.d.ts
next.config.ts
node_modules
package-lock.json
package.json
postcss.config.mjs
public
ralph
src
tsconfig.json
tsconfig.tsbuildinfo

thinking
**Checking guardrails directory name**

I'm verifying whether the directory is named `.ralph` or `ralph` since instructions mention `.ralph/guardrails.md` but a directory named `ralph` appears; I'll list the directory to confirm.
exec
/bin/zsh -lc 'ls ralph' in /Users/tajwar/development/glyph-dev succeeded in 9ms:
CLAUDE.md
EXAMPLES_TEMPLATES
RALPH_TASK.md.template
README.md
adapters
init-ralph.sh
ralph.sh
tasks

---

## Your Answers

_Add your answers below each question above, or in this section._

