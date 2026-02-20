import { v4 as uuidv4 } from "uuid";
import type { SyncBatchRequest, SyncBatchResponse, SyncOperationDTO } from "@/types/api";
import type { SyncFlushResult, SyncOperation, SyncStatus } from "./types";

const STORAGE_KEY = "glyph:sync-operations";
const VERSION_KEY = "glyph:sync-version";
const CLIENT_ID_KEY = "glyph:sync-client-id";

function readQueue(): SyncOperation[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: SyncOperation[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
}

function getClientId(): string {
  if (typeof window === "undefined") return "server";
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const next = `web-${uuidv4()}`;
  localStorage.setItem(CLIENT_ID_KEY, next);
  return next;
}

function getVersion(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(VERSION_KEY);
  const parsed = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function setVersion(version: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VERSION_KEY, String(version));
}

class LocalSyncQueue {
  private status: SyncStatus = "idle";
  private listeners = new Set<(status: SyncStatus) => void>();

  private setStatus(next: SyncStatus): void {
    this.status = next;
    this.listeners.forEach((listener) => listener(next));
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  enqueue<TPayload>(
    operation: Omit<SyncOperation<TPayload>, "createdAt" | "retryCount"> & { createdAt?: number }
  ): SyncOperation<TPayload> {
    const queue = readQueue();
    const nextOperation: SyncOperation<TPayload> = {
      ...operation,
      createdAt: operation.createdAt ?? Date.now(),
      retryCount: 0,
    };
    queue.push(nextOperation);
    writeQueue(queue);
    return nextOperation;
  }

  async flush(): Promise<SyncFlushResult> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setStatus("offline");
      return { acknowledged: [], failed: [] };
    }

    const queue = readQueue();
    if (queue.length === 0) {
      this.setStatus("idle");
      return { acknowledged: [], failed: [] };
    }

    this.setStatus("syncing");

    const payload: SyncBatchRequest = {
      clientId: getClientId(),
      sinceVersion: getVersion(),
      operations: queue.map((op) => ({
        id: op.id,
        type: op.type,
        documentId: op.documentId,
        payload: op.payload,
      })) as SyncOperationDTO[],
    };

    try {
      const response = await fetch("/api/v1/sync/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Sync failed with status ${response.status}`);
      }

      const result = (await response.json()) as SyncBatchResponse;
      const ackSet = new Set(result.acknowledged);

      const nextQueue = queue
        .filter((op) => !ackSet.has(op.id))
        .map((op) => ({ ...op, retryCount: op.retryCount + 1 }));

      writeQueue(nextQueue);
      setVersion(result.newVersion);
      this.setStatus("idle");

      return {
        acknowledged: result.acknowledged,
        failed: nextQueue.map((op) => op.id),
      };
    } catch {
      const nextQueue = queue.map((op) => ({ ...op, retryCount: op.retryCount + 1 }));
      writeQueue(nextQueue);
      this.setStatus("error");
      return {
        acknowledged: [],
        failed: nextQueue.map((op) => op.id),
      };
    }
  }
}

let queueInstance: LocalSyncQueue | null = null;

export function getSyncQueue(): LocalSyncQueue {
  if (!queueInstance) {
    queueInstance = new LocalSyncQueue();
  }
  return queueInstance;
}

