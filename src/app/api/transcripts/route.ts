import { NextResponse } from "next/server";
import { isAuthFailure, requireViewer } from "@/lib/auth";
import { getDb, listTranscripts } from "@/lib/db";
import { ensureAllEmbeddings } from "@/lib/search";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const identity = await requireViewer(request);
  if (isAuthFailure(identity)) return identity;

  getDb();
  await ensureAllEmbeddings();
  return NextResponse.json({ transcripts: listTranscripts() });
}
