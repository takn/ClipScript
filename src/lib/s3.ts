import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { getConfigStatus, isMediaFileName } from "./config";
import { MAX_UPLOAD_BYTES } from "./limits";

export type S3ObjectInfo = {
  key: string;
  size: number | null;
  lastModified: string | null;
};

function requireS3() {
  const status = getConfigStatus();
  if (!status.s3Configured) {
    throw new Error(
      "S3 is not configured. Set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, and S3_BUCKET.",
    );
  }

  const client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  return { client, bucket: process.env.S3_BUCKET! };
}

function allowedPrefix(): string {
  return (process.env.S3_ALLOWED_PREFIX || "").trim();
}

export function isSafeS3Key(key: string): boolean {
  if (!key || key.length > 1024) return false;
  if (key.startsWith("/") || key.includes("\\")) return false;
  if (key.split("/").some((part) => part === ".." || part === "")) return false;
  const prefix = allowedPrefix();
  if (prefix && !key.startsWith(prefix)) return false;
  return true;
}

export async function listS3Media(prefix = ""): Promise<S3ObjectInfo[]> {
  const { client, bucket } = requireS3();
  const configuredPrefix = allowedPrefix();
  const effectivePrefix = configuredPrefix
    ? prefix
      ? prefix.startsWith(configuredPrefix)
        ? prefix
        : `${configuredPrefix}${prefix}`
      : configuredPrefix
    : prefix;

  if (
    effectivePrefix &&
    (effectivePrefix.includes("..") ||
      effectivePrefix.startsWith("/") ||
      effectivePrefix.includes("\\"))
  ) {
    throw new Error("Invalid S3 prefix");
  }

  const objects: S3ObjectInfo[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: effectivePrefix || undefined,
        ContinuationToken: continuationToken,
        MaxKeys: 200,
      }),
    );

    for (const item of page.Contents ?? []) {
      if (!item.Key || item.Key.endsWith("/")) continue;
      if (!isSafeS3Key(item.Key)) continue;
      if (!isMediaFileName(item.Key)) continue;
      objects.push({
        key: item.Key,
        size: typeof item.Size === "number" ? item.Size : null,
        lastModified: item.LastModified
          ? item.LastModified.toISOString()
          : null,
      });
    }

    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken && objects.length < 500);

  return objects;
}

export async function downloadS3Object(key: string): Promise<Buffer> {
  if (!isSafeS3Key(key) || !isMediaFileName(key)) {
    throw new Error("Rejected unsafe or non-media S3 key");
  }

  const { client, bucket } = requireS3();
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );

  if (!response.Body) {
    throw new Error(`S3 object ${key} had an empty body`);
  }

  if (
    typeof response.ContentLength === "number" &&
    response.ContentLength > MAX_UPLOAD_BYTES
  ) {
    throw new Error(`S3 object exceeds ${MAX_UPLOAD_BYTES} byte limit`);
  }

  const buffer = await streamToBuffer(
    response.Body as Readable,
    MAX_UPLOAD_BYTES,
  );
  return buffer;
}

async function streamToBuffer(
  body: Readable,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.byteLength;
    if (total > maxBytes) {
      throw new Error(`S3 object exceeds ${maxBytes} byte limit`);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}
