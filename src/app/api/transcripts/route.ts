import { NextResponse } from "next/server";
import { getDb, listTranscripts } from "@/lib/db";
import { ensureAllEmbeddings } from "@/lib/search";

export const runtime = "nodejs";

export async function GET() {
  getDb();
  await ensureAllEmbeddings();
  return NextResponse.json({ transcripts: listTranscripts() });
}
