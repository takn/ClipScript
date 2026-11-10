import type { VerifiedIdentity } from "../../cursor/identity";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_UPLOAD_FILES = 5;
export const MAX_S3_KEYS_PER_REQUEST = 20;
export const MAX_SEARCH_QUERY_CHARS = 500;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Simple per-viewer sliding window to bound paid API spend. */
export function checkRateLimit(
  identity: VerifiedIdentity,
  action: string,
  limit: number,
  windowMs = 60_000,
): Response | null {
  const key = `${identity.sub}:${action}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (current.count >= limit) {
    return Response.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429 },
    );
  }

  current.count += 1;
  return null;
}

export function sanitizeUploadFileName(fileName: string): string | null {
  const base = fileName.replace(/\\/g, "/").split("/").pop() || "";
  if (!base || base === "." || base === "..") return null;
  if (base.length > 200) return null;
  return base;
}
