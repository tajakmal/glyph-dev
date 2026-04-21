import { NextResponse } from "next/server";
import { getMockStore, nextVersion } from "@/lib/api/mock-store";
import type { UpsertHighlightRequest, UpsertHighlightResponse } from "@/types/api";

// NOTE: this route is a development-only mock. See documents/route.ts for the
// full caveat — no real auth, in-memory storage, no user isolation.
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

export async function POST(request: Request): Promise<NextResponse> {
  if (shouldRequireAuth() && !hasAuthHeader(request)) return unauthorized();

  const body = (await request.json()) as UpsertHighlightRequest;
  if (!body?.id || !body?.documentId || !body?.kind || !body?.clientOperationId) {
    return NextResponse.json(
      { error: "id, documentId, kind, and clientOperationId are required" },
      { status: 400 }
    );
  }

  const store = getMockStore();
  const version = nextVersion();
  const updatedAt = new Date().toISOString();

  const highlight = {
    id: body.id,
    documentId: body.documentId,
    kind: body.kind,
    color: body.color,
    textExcerpt: body.textExcerpt,
    note: body.note,
    page: body.page,
    rectsJson: body.rectsJson,
    startWord: body.startWord,
    endWord: body.endWord,
    updatedAt,
    version,
  };

  store.highlights.set(highlight.id, highlight);

  const response: UpsertHighlightResponse = {
    highlight,
  };

  return NextResponse.json(response, { status: 200 });
}
