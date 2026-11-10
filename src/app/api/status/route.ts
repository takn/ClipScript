import { NextResponse } from "next/server";
import { isAuthFailure, requireViewer } from "@/lib/auth";
import { getConfigStatus } from "@/lib/config";
import { countTranscripts, getDb } from "@/lib/db";
import { ensureAllEmbeddings } from "@/lib/search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const identity = await requireViewer(request);
  if (isAuthFailure(identity)) return identity;

  getDb();
  await ensureAllEmbeddings();
  return NextResponse.json({
    ...getConfigStatus(),
    counts: countTranscripts(),
    viewer: {
      email: identity.email || null,
      name: identity.name || null,
      simulated: identity.simulated,
    },
  });
}
