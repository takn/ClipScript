import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthFailure, requireViewer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { MAX_SEARCH_QUERY_CHARS, checkRateLimit } from "@/lib/limits";
import { searchTranscripts } from "@/lib/search";

export const runtime = "nodejs";

const bodySchema = z.object({
  query: z.string().min(1).max(MAX_SEARCH_QUERY_CHARS),
  mode: z.enum(["keyword", "semantic", "hybrid"]).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function POST(request: Request) {
  const identity = await requireViewer(request);
  if (isAuthFailure(identity)) return identity;

  const limited = checkRateLimit(identity, "search", 30);
  if (limited) return limited;

  getDb();
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a non-empty query string." },
      { status: 400 },
    );
  }

  const hits = await searchTranscripts(parsed.data);
  return NextResponse.json({ hits, mode: parsed.data.mode ?? "hybrid" });
}
