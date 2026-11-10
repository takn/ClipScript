import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ingestS3Object } from "@/lib/pipeline";
import { listS3Media } from "@/lib/s3";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  keys: z.array(z.string().min(1)).min(1).optional(),
  prefix: z.string().optional(),
  ingestAll: z.boolean().optional(),
});

export async function POST(request: Request) {
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
      keys = objects.map((object) => object.key);
    }

    if (keys.length === 0) {
      return NextResponse.json(
        { error: "No S3 media objects matched." },
        { status: 404 },
      );
    }

    const results = [];
    for (const key of keys) {
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
