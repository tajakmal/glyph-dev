import type { DocumentKind, HighlightColor } from "@/types";

export interface ApiDocumentDTO {
  id: string;
  kind: DocumentKind;
  title: string;
  fileName?: string;
  pageCount?: number;
  wordCount?: number;
  previewText?: string;
  updatedAt: string;
}

export interface CreateDocumentRequest {
  kind: DocumentKind;
  title?: string;
  content?: string;
  fileName?: string;
  pageCount?: number;
  wordCount?: number;
  previewText?: string;
  clientOperationId: string;
}

export interface CreateDocumentResponse {
  document: ApiDocumentDTO;
  syncVersion: number;
}

export interface ApiHighlightDTO {
  id: string;
  documentId: string;
  kind: DocumentKind;
  color: HighlightColor;
  textExcerpt: string;
  note?: string;
  page?: number;
  rectsJson?: Array<{ x: number; y: number; width: number; height: number }>;
  startWord?: number;
  endWord?: number;
  updatedAt: string;
  version: number;
}

export interface UpsertHighlightRequest {
  id: string;
  documentId: string;
  kind: DocumentKind;
  color: HighlightColor;
  textExcerpt: string;
  note?: string;
  page?: number;
  rectsJson?: Array<{ x: number; y: number; width: number; height: number }>;
  startWord?: number;
  endWord?: number;
  clientOperationId: string;
}

export interface UpsertHighlightResponse {
  highlight: ApiHighlightDTO;
}

export type SyncOperationType =
  | "UPSERT_DOCUMENT"
  | "UPSERT_BOOKMARK"
  | "UPSERT_HIGHLIGHT"
  | "DELETE_HIGHLIGHT"
  | "UPSERT_READING_POSITION";

export interface SyncOperationDTO<TPayload = unknown> {
  id: string;
  type: SyncOperationType;
  documentId?: string;
  payload: TPayload;
}

export interface SyncBatchRequest {
  clientId: string;
  sinceVersion: number;
  operations: SyncOperationDTO[];
}

export interface SyncBatchResponse {
  acknowledged: string[];
  remoteChanges: SyncOperationDTO[];
  newVersion: number;
}

