import path from "path";
import {
  createTranscript,
  guessMediaType,
  updateTranscript,
} from "./db";
import { embedText } from "./embeddings";
import { isMediaFileName } from "./config";
import { downloadS3Object } from "./s3";
import { transcribeMediaBuffer, transcribeMediaFile } from "./transcription";
import type { IngestResult, SourceType } from "./types";

export async function ingestLocalFile(input: {
  filePath?: string;
  buffer?: Buffer;
  fileName: string;
  sourcePath?: string;
}): Promise<IngestResult> {
  const record = createTranscript({
    sourceType: "local",
    sourcePath: input.sourcePath || input.filePath || input.fileName,
    fileName: input.fileName,
    mediaType: guessMediaType(input.fileName),
    status: "processing",
  });

  try {
    const result = input.buffer
      ? await transcribeMediaBuffer(input.buffer, input.fileName)
      : await transcribeMediaFile(input.filePath!, input.fileName);

    if (!result.text) {
      throw new Error("Transcription returned empty text");
    }

    const { embedding } = await embedText(result.text);
    updateTranscript(record.id, {
      status: "completed",
      transcriptText: result.text,
      language: result.language,
      durationMs: result.durationMs,
      provider: result.provider,
      providerId: result.providerId,
      embedding,
      errorMessage: null,
    });

    return {
      id: record.id,
      fileName: input.fileName,
      status: "completed",
      provider: result.provider,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    updateTranscript(record.id, {
      status: "error",
      errorMessage: message,
    });
    return {
      id: record.id,
      fileName: input.fileName,
      status: "error",
      provider: "none",
      errorMessage: message,
    };
  }
}

export async function ingestS3Object(key: string): Promise<IngestResult> {
  const fileName = path.basename(key);
  if (!isMediaFileName(fileName)) {
    return {
      id: "",
      fileName,
      status: "error",
      provider: "none",
      errorMessage: "Rejected non-media S3 key",
    };
  }

  const record = createTranscript({
    sourceType: "s3" satisfies SourceType,
    sourcePath: key,
    fileName,
    mediaType: guessMediaType(fileName),
    status: "processing",
  });

  try {
    const buffer = await downloadS3Object(key);
    const result = await transcribeMediaBuffer(buffer, fileName);
    if (!result.text) {
      throw new Error("Transcription returned empty text");
    }

    const { embedding } = await embedText(result.text);
    updateTranscript(record.id, {
      status: "completed",
      transcriptText: result.text,
      language: result.language,
      durationMs: result.durationMs,
      provider: result.provider,
      providerId: result.providerId,
      embedding,
      errorMessage: null,
    });

    return {
      id: record.id,
      fileName,
      status: "completed",
      provider: result.provider,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "S3 ingest failed";
    updateTranscript(record.id, {
      status: "error",
      errorMessage: message,
    });
    return {
      id: record.id,
      fileName,
      status: "error",
      provider: "none",
      errorMessage: message,
    };
  }
}
