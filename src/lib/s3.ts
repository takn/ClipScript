import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { getConfigStatus, isMediaFileName } from "./config";

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

export async function listS3Media(prefix = ""): Promise<S3ObjectInfo[]> {
  const { client, bucket } = requireS3();
  const objects: S3ObjectInfo[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
        MaxKeys: 200,
      }),
    );

    for (const item of page.Contents ?? []) {
      if (!item.Key || item.Key.endsWith("/")) continue;
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
  const { client, bucket } = requireS3();
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );

  if (!response.Body) {
    throw new Error(`S3 object ${key} had an empty body`);
  }

  return streamToBuffer(response.Body as Readable);
}

async function streamToBuffer(body: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
