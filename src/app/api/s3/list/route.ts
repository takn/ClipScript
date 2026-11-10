import { NextResponse } from "next/server";
import { isAuthFailure, requireViewer } from "@/lib/auth";
import { getConfigStatus } from "@/lib/config";
import { checkRateLimit } from "@/lib/limits";
import { listS3Media } from "@/lib/s3";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const identity = await requireViewer(request);
  if (isAuthFailure(identity)) return identity;

  const limited = checkRateLimit(identity, "s3-list", 30);
  if (limited) return limited;

  const status = getConfigStatus();
  if (!status.s3Configured) {
    return NextResponse.json(
      {
        error:
          "S3 is not configured. Add S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, and S3_BUCKET.",
        objects: [],
      },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix") || "";
  if (prefix.length > 512 || prefix.includes("..") || prefix.startsWith("/")) {
    return NextResponse.json({ error: "Invalid prefix", objects: [] }, { status: 400 });
  }

  try {
    const objects = await listS3Media(prefix);
    return NextResponse.json({
      bucket: status.s3Bucket,
      prefix,
      objects,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list S3 objects",
        objects: [],
      },
      { status: 400 },
    );
  }
}
