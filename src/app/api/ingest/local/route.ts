import { NextResponse } from "next/server";
import { isAuthFailure, requireViewer } from "@/lib/auth";
import { isMediaFileName } from "@/lib/config";
import { getDb } from "@/lib/db";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  checkRateLimit,
  sanitizeUploadFileName,
} from "@/lib/limits";
import { ingestLocalFile } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const identity = await requireViewer(request);
  if (isAuthFailure(identity)) return identity;

  const limited = checkRateLimit(identity, "ingest-local", 10);
  if (limited) return limited;

  getDb();

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return NextResponse.json(
      {
        error:
          "Directory paths are not accepted over the API. Upload media files, or run the local ingest CLI against files on your machine.",
      },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const files = form
    .getAll("files")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Attach one or more media files under the files field." },
      { status: 400 },
    );
  }

  if (files.length > MAX_UPLOAD_FILES) {
    return NextResponse.json(
      { error: `Upload at most ${MAX_UPLOAD_FILES} files per request.` },
      { status: 400 },
    );
  }

  const results = [];
  for (const file of files) {
    const safeName = sanitizeUploadFileName(file.name);
    if (!safeName || !isMediaFileName(safeName)) {
      results.push({
        id: "",
        fileName: file.name,
        status: "error" as const,
        provider: "none",
        errorMessage: "Unsupported or unsafe media file name",
      });
      continue;
    }

    if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
      results.push({
        id: "",
        fileName: safeName,
        status: "error" as const,
        provider: "none",
        errorMessage: `File exceeds ${MAX_UPLOAD_BYTES} byte limit`,
      });
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      results.push({
        id: "",
        fileName: safeName,
        status: "error" as const,
        provider: "none",
        errorMessage: `File exceeds ${MAX_UPLOAD_BYTES} byte limit`,
      });
      continue;
    }

    results.push(
      await ingestLocalFile({
        buffer,
        fileName: safeName,
        sourcePath: `upload://${safeName}`,
      }),
    );
  }

  return NextResponse.json({ results });
}
