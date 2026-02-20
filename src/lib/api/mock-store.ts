import type {
  ApiDocumentDTO,
  ApiHighlightDTO,
  SyncBatchResponse,
  SyncOperationDTO,
} from "@/types/api";

interface MockStore {
  version: number;
  documents: Map<string, ApiDocumentDTO>;
  highlights: Map<string, ApiHighlightDTO>;
  appliedOperationIds: Set<string>;
}

declare global {
  var __glyphMockStore: MockStore | undefined;
}

function createStore(): MockStore {
  return {
    version: 1,
    documents: new Map(),
    highlights: new Map(),
    appliedOperationIds: new Set(),
  };
}

export function getMockStore(): MockStore {
  if (!globalThis.__glyphMockStore) {
    globalThis.__glyphMockStore = createStore();
  }
  return globalThis.__glyphMockStore;
}

export function nextVersion(): number {
  const store = getMockStore();
  store.version += 1;
  return store.version;
}

export function applyOperations(ops: SyncOperationDTO[]): SyncBatchResponse {
  const store = getMockStore();
  const acknowledged: string[] = [];

  ops.forEach((op) => {
    if (store.appliedOperationIds.has(op.id)) {
      acknowledged.push(op.id);
      return;
    }

    store.appliedOperationIds.add(op.id);
    acknowledged.push(op.id);
    store.version += 1;
  });

  return {
    acknowledged,
    remoteChanges: [],
    newVersion: store.version,
  };
}
