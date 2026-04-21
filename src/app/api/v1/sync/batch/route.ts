import { NextResponse } from "next/server";
import { applyOperations } from "@/lib/api/mock-store";
import type { SyncBatchRequest, SyncBatchResponse } from "@/types/api";

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

  const body = (await request.json()) as SyncBatchRequest;
  if (!body || !Array.isArray(body.operations)) {
    return NextResponse.json({ error: "operations array is required" }, { status: 400 });
  }

  const result: SyncBatchResponse = applyOperations(body.operations);
  return NextResponse.json(result, { status: 200 });
}
