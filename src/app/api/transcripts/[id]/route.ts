import { NextResponse } from "next/server";
import { getDb, getTranscript } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  getDb();
  const { id } = await context.params;
  const transcript = getTranscript(id);
  if (!transcript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ transcript });
}
