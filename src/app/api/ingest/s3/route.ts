import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthFailure, requireViewer } from "@/lib/auth";
import { isMediaFileName } from "@/lib/config";
import { getDb } from "@/lib/db";
import { MAX_S3_KEYS_PER_REQUEST, checkRateLimit } from "@/lib/limits";
import { ingestS3Object } from "@/lib/pipeline";
import { isSafeS3Key, listS3Media } from "@/lib/s3";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  keys: z.array(z.string().min(1).max(1024)).max(MAX_S3_KEYS_PER_REQUEST).optional(),
  prefix: z.string().max(512).optional(),
  ingestAll: z.boolean().optional(),
});

export async function POST(request: Request) {
  const identity = await requireViewer(request);
  if (isAuthFailure(identity)) return identity;

  const limited = checkRateLimit(identity, "ingest-s3", 5);
  if (limited) return limited;

  getDb();
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide keys or ingestAll with an optional prefix." },
      { status: 400 },
    );
  }

  try {
    let keys = parsed.data.keys ?? [];
    if (parsed.data.ingestAll) {
      const objects = await listS3Media(parsed.data.prefix || "");
      keys = objects.map((object) => object.key).slice(0, MAX_S3_KEYS_PER_REQUEST);
    }

    if (keys.length === 0) {
      return NextResponse.json(
        { error: "No S3 media objects matched." },
        { status: 404 },
      );
    }

    if (keys.length > MAX_S3_KEYS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Ingest at most ${MAX_S3_KEYS_PER_REQUEST} S3 objects per request.` },
        { status: 400 },
      );
    }

    const results = [];
    for (const key of keys) {
      if (!isSafeS3Key(key) || !isMediaFileName(key)) {
        results.push({
          id: "",
          fileName: key,
          status: "error" as const,
          provider: "none",
          errorMessage: "Rejected unsafe or non-media S3 key",
        });
        continue;
      }
      results.push(await ingestS3Object(key));
    }
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "S3 ingest failed" },
      { status: 400 },
    );
  }
}
