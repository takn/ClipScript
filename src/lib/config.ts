import type { ConfigStatus } from "./types";

export function getConfigStatus(): ConfigStatus {
  const assemblyAiConfigured = Boolean(process.env.ASSEMBLYAI_API_KEY?.trim());
  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const accessKey = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const region = process.env.S3_REGION?.trim();
  const bucket = process.env.S3_BUCKET?.trim() || null;
  const s3Configured = Boolean(accessKey && secretKey && region && bucket);

  return {
    assemblyAiConfigured,
    openAiConfigured,
    s3Configured,
    s3Bucket: bucket,
    transcriptionMode: assemblyAiConfigured ? "assemblyai" : "mock",
    embeddingMode: openAiConfigured ? "openai" : "local",
  };
}

export const MEDIA_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".avi",
  ".mp3",
  ".wav",
  ".m4a",
  ".flac",
  ".ogg",
] as const;

export function isMediaFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return MEDIA_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
