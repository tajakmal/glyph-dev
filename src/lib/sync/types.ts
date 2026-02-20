import type { SyncOperationType } from "@/types/api";

export interface SyncOperation<TPayload = unknown> {
  id: string;
  type: SyncOperationType;
  documentId?: string;
  payload: TPayload;
  createdAt: number;
  retryCount: number;
}

export interface SyncFlushResult {
  acknowledged: string[];
  failed: string[];
}

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

