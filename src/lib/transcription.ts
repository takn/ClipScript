import { AssemblyAI } from "assemblyai";
import fs from "fs";
import path from "path";
import { getConfigStatus } from "./config";

export type TranscriptionOutput = {
  text: string;
  language: string | null;
  durationMs: number | null;
  provider: "assemblyai" | "mock";
  providerId: string | null;
};

export async function transcribeMediaFile(
  filePath: string,
  fileName: string,
): Promise<TranscriptionOutput> {
  const status = getConfigStatus();
  if (!status.assemblyAiConfigured) {
    return mockTranscribe(fileName);
  }

  const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
  const transcript = await client.transcripts.transcribe({
    audio: filePath,
    language_detection: true,
  });

  if (transcript.status === "error") {
    throw new Error(transcript.error || "AssemblyAI transcription failed");
  }

  return {
    text: transcript.text?.trim() || "",
    language: transcript.language_code ?? null,
    durationMs:
      typeof transcript.audio_duration === "number"
        ? Math.round(transcript.audio_duration * 1000)
        : null,
    provider: "assemblyai",
    providerId: transcript.id ?? null,
  };
}

export async function transcribeMediaBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<TranscriptionOutput> {
  const status = getConfigStatus();
  if (!status.assemblyAiConfigured) {
    return mockTranscribe(fileName);
  }

  const tmpDir = path.join(process.cwd(), "data", "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${Date.now()}-${sanitize(fileName)}`);
  fs.writeFileSync(tmpPath, buffer);

  try {
    return await transcribeMediaFile(tmpPath, fileName);
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

function mockTranscribe(fileName: string): TranscriptionOutput {
  const base = path.parse(fileName).name.replace(/[-_]/g, " ");
  const text = [
    `Mock transcript for ${fileName}.`,
    `ClipScript is running without ASSEMBLYAI_API_KEY, so this placeholder text stands in for a commercial transcription.`,
    `The original media title suggests topics around: ${base || "general discussion"}.`,
    `Add an AssemblyAI API key to extract real speech from MP4, MOV, WAV, MP3, and other supported formats.`,
    `Once transcribed, this content becomes available for keyword and semantic search in the local database.`,
  ].join(" ");

  return {
    text,
    language: "en",
    durationMs: 60000,
    provider: "mock",
    providerId: null,
  };
}

function sanitize(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}
