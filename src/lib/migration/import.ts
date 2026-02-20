"use client";

import { getDocuments, getBookmarks, getHighlights } from "@/lib/storage";
import type { DocumentMeta, Bookmark, Highlight } from "@/types";
import type { SyncOperationDTO } from "@/types/api";

const IMPORTED_OPS_KEY = "glyph:migration-imported-ops";

function readImportedOpIds(): Set<string> {
  try {
    const raw = localStorage.getItem(IMPORTED_OPS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeImportedOpIds(ids: Set<string>): void {
  localStorage.setItem(IMPORTED_OPS_KEY, JSON.stringify(Array.from(ids)));
}

function buildDocumentOp(document: DocumentMeta): SyncOperationDTO {
  return {
    id: `import:document:${document.id}`,
    type: "UPSERT_DOCUMENT",
    documentId: document.id,
    payload: {
      kind: document.kind,
      title: document.title,
      fileName: document.fileName,
      pageCount: document.pageCount,
      wordCount: document.wordCount,
      previewText: document.textPreview,
      addedAt: document.addedAt,
      lastOpenedAt: document.lastOpenedAt,
      lastReadPage: document.lastReadPage,
    },
  };
}

function buildBookmarkOp(bookmark: Bookmark): SyncOperationDTO {
  return {
    id: `import:bookmark:${bookmark.id}`,
    type: "UPSERT_BOOKMARK",
    documentId: bookmark.documentId,
    payload:
      bookmark.kind === "pdf"
        ? {
            kind: "pdf",
            page: bookmark.page,
            label: bookmark.label,
            createdAt: bookmark.createdAt,
          }
        : {
            kind: "text",
            wordIndex: bookmark.wordIndex,
            label: bookmark.label,
            createdAt: bookmark.createdAt,
          },
  };
}

function buildHighlightOp(highlight: Highlight): SyncOperationDTO {
  return {
    id: `import:highlight:${highlight.id}`,
    type: "UPSERT_HIGHLIGHT",
    documentId: highlight.documentId,
    payload:
      highlight.kind === "pdf"
        ? {
            kind: "pdf",
            color: highlight.color,
            textExcerpt: highlight.text,
            note: highlight.note,
            page: highlight.page,
            rectsJson: highlight.rects,
            createdAt: highlight.createdAt,
            updatedAt: highlight.updatedAt,
          }
        : {
            kind: "text",
            color: highlight.color,
            textExcerpt: highlight.text,
            note: highlight.note,
            startWord: highlight.startWord,
            endWord: highlight.endWord,
            createdAt: highlight.createdAt,
            updatedAt: highlight.updatedAt,
          },
  };
}

export function buildImportOperations(): SyncOperationDTO[] {
  const imported = readImportedOpIds();

  const operations = [
    ...getDocuments().map(buildDocumentOp),
    ...getBookmarks().map(buildBookmarkOp),
    ...getHighlights().map(buildHighlightOp),
  ];

  return operations.filter((op) => !imported.has(op.id));
}

export async function importLocalData(options?: {
  endpoint?: string;
  dryRun?: boolean;
}): Promise<{ imported: number; skipped: number }> {
  const endpoint = options?.endpoint || "/api/v1/sync/batch";
  const dryRun = options?.dryRun ?? false;
  const operations = buildImportOperations();

  if (operations.length === 0) {
    return { imported: 0, skipped: 0 };
  }

  if (dryRun) {
    return { imported: 0, skipped: operations.length };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId: "local-import",
      sinceVersion: 0,
      operations,
    }),
  });

  if (!response.ok) {
    throw new Error(`Import failed: ${response.status}`);
  }

  const body = (await response.json()) as {
    acknowledged?: string[];
  };

  const acknowledged = body.acknowledged || [];
  const importedSet = readImportedOpIds();
  acknowledged.forEach((id) => importedSet.add(id));
  writeImportedOpIds(importedSet);

  return {
    imported: acknowledged.length,
    skipped: operations.length - acknowledged.length,
  };
}

