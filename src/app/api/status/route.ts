import { NextResponse } from "next/server";
import { getConfigStatus } from "@/lib/config";
import { countTranscripts, getDb } from "@/lib/db";
import { ensureAllEmbeddings } from "@/lib/search";

export const runtime = "nodejs";

export async function GET() {
  getDb();
  await ensureAllEmbeddings();
  return NextResponse.json({
    ...getConfigStatus(),
    counts: countTranscripts(),
  });
}
