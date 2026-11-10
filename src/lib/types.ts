export type SourceType = "local" | "s3" | "sample";
export type TranscriptStatus = "pending" | "processing" | "completed" | "error";
export type SearchMode = "keyword" | "semantic" | "hybrid";

export type TranscriptRecord = {
  id: string;
  sourceType: SourceType;
  sourcePath: string;
  fileName: string;
  mediaType: string | null;
  status: TranscriptStatus;
  transcriptText: string | null;
  language: string | null;
  durationMs: number | null;
  provider: string | null;
  providerId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SearchHit = TranscriptRecord & {
  score: number;
  snippet: string;
};

export type IngestResult = {
  id: string;
  fileName: string;
  status: TranscriptStatus;
  provider: string;
  errorMessage?: string;
};

export type ConfigStatus = {
  assemblyAiConfigured: boolean;
  openAiConfigured: boolean;
  s3Configured: boolean;
  s3Bucket: string | null;
  transcriptionMode: "assemblyai" | "mock";
  embeddingMode: "openai" | "local";
};
