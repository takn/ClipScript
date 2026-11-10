import { NextResponse } from "next/server";
import { isAuthFailure, requireViewer } from "@/lib/auth";
import { getDb, getTranscript } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const identity = await requireViewer(request);
  if (isAuthFailure(identity)) return identity;

  getDb();
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const transcript = getTranscript(id);
  if (!transcript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ transcript });
}
