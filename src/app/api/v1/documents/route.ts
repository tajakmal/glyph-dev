import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { getMockStore, nextVersion } from "@/lib/api/mock-store";
import type { CreateDocumentRequest, CreateDocumentResponse } from "@/types/api";

// NOTE: this route is a development-only mock. It stores data in an in-memory
// process-wide map (see src/lib/api/mock-store.ts) and performs NO real auth —
// the presence check below only exists so client sync code can be wired up
// ahead of the real backend. Do not deploy as-is: there's no user isolation,
// no token validation, and no persistence.
function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function hasAuthHeader(request: Request): boolean {
  const auth = request.headers.get("authorization");
  return Boolean(auth && auth.trim().length > 0);
}

function shouldRequireAuth(): boolean {
  return process.env.NEXT_PUBLIC_FLAG_AUTH_REQUIRED === "true";
}

export async function GET(request: Request): Promise<NextResponse> {
  if (shouldRequireAuth() && !hasAuthHeader(request)) return unauthorized();

  const store = getMockStore();
  return NextResponse.json({
    documents: Array.from(store.documents.values()),
    syncVersion: store.version,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (shouldRequireAuth() && !hasAuthHeader(request)) return unauthorized();

  const body = (await request.json()) as CreateDocumentRequest;
  if (!body?.kind || !body?.clientOperationId) {
    return NextResponse.json(
      { error: "kind and clientOperationId are required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const id = uuidv4();
  const title = body.title?.trim() || "Untitled";

  const document = {
    id,
    kind: body.kind,
    title,
    fileName: body.fileName,
    pageCount: body.pageCount,
    wordCount: body.wordCount,
    previewText: body.previewText || body.content?.slice(0, 160),
    updatedAt: now,
  };

  const store = getMockStore();
  store.documents.set(id, document);

  const response: CreateDocumentResponse = {
    document,
    syncVersion: nextVersion(),
  };

  return NextResponse.json(response, { status: 201 });
}
