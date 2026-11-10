import { NextResponse } from "next/server";
import { z } from "zod";
import { isMediaFileName } from "@/lib/config";
import { getDb } from "@/lib/db";
import { ingestLocalDirectory, ingestLocalFile } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

const directorySchema = z.object({
  directory: z.string().min(1),
});

export async function POST(request: Request) {
  getDb();
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await request.json().catch(() => null);
    const parsed = directorySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Provide a local directory path." },
        { status: 400 },
      );
    }

    try {
      const results = await ingestLocalDirectory(parsed.data.directory);
      return NextResponse.json({ results });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Directory ingest failed",
        },
        { status: 400 },
      );
    }
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Attach one or more media files under the files field." },
      { status: 400 },
    );
  }

  const results = [];
  for (const file of files) {
    if (!isMediaFileName(file.name)) {
      results.push({
        id: "",
        fileName: file.name,
        status: "error" as const,
        provider: "none",
        errorMessage: "Unsupported media type",
      });
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    results.push(
      await ingestLocalFile({
        buffer,
        fileName: file.name,
        sourcePath: `upload://${file.name}`,
      }),
    );
  }

  return NextResponse.json({ results });
}
