import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { SourceType, TranscriptRecord, TranscriptStatus } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, "transcripts.db");

let dbInstance: Database.Database | null = null;

type TranscriptRow = {
  id: string;
  source_type: string;
  source_path: string;
  file_name: string;
  media_type: string | null;
  status: string;
  transcript_text: string | null;
  language: string | null;
  duration_ms: number | null;
  provider: string | null;
  provider_id: string | null;
  error_message: string | null;
  embedding: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: TranscriptRow): TranscriptRecord {
  return {
    id: row.id,
    sourceType: row.source_type as SourceType,
    sourcePath: row.source_path,
    fileName: row.file_name,
    mediaType: row.media_type,
    status: row.status as TranscriptStatus,
    transcriptText: row.transcript_text,
    language: row.language,
    durationMs: row.duration_ms,
    provider: row.provider,
    providerId: row.provider_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDb() {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      media_type TEXT,
      status TEXT NOT NULL,
      transcript_text TEXT,
      language TEXT,
      duration_ms INTEGER,
      provider TEXT,
      provider_id TEXT,
      error_message TEXT,
      embedding TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS transcripts_fts USING fts5(
      id UNINDEXED,
      file_name,
      transcript_text,
      tokenize = 'porter'
    );

    CREATE INDEX IF NOT EXISTS idx_transcripts_status ON transcripts(status);
    CREATE INDEX IF NOT EXISTS idx_transcripts_created ON transcripts(created_at DESC);
  `);

  seedSamplesIfEmpty(db);
  dbInstance = db;
  return db;
}

function seedSamplesIfEmpty(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) AS c FROM transcripts").get() as {
    c: number;
  };
  if (count.c > 0) return;

  const now = new Date().toISOString();
  const samples = [
    {
      fileName: "product-demo-walkthrough.mp4",
      sourcePath: "samples/product-demo-walkthrough.mp4",
      text: `Welcome to the ClipScript product demo. In this walkthrough we show how media files move from a local folder or an S3 bucket into a searchable transcript library. First, upload a video or audio clip. AssemblyAI handles most common formats, including MP4, MOV, WAV, and MP3. After transcription finishes, the full text is stored in the database with keyword and semantic indexes so you can find discussions about pricing, onboarding, or customer objections without scrubbing the timeline.`,
    },
    {
      fileName: "customer-interview-acme.wav",
      sourcePath: "samples/customer-interview-acme.wav",
      text: `Interviewer: What made you evaluate a transcription pipeline this quarter? Customer: Our support team records dozens of Zoom calls every week, and searching those recordings by hand is impossible. We need keyword search for exact phrases like refund policy, and semantic search for themes like churn risk or onboarding friction. Interviewer: How do your files arrive today? Customer: Some sit on analyst laptops, others land in an S3 intake bucket overnight.`,
    },
    {
      fileName: "weekly-standup-notes.m4a",
      sourcePath: "samples/weekly-standup-notes.m4a",
      text: `Today's standup covered the ingestion workers, S3 prefix scanning, and embedding quality. We decided to keep AssemblyAI as the commercial transcription provider because it accepts video and audio without a separate transcoding step. Semantic search will use OpenAI embeddings when configured, with a local hashing fallback so demos still work offline. Next milestone is batch directory ingest and clearer error states when a media file fails.`,
    },
  ];

  const insert = db.prepare(`
    INSERT INTO transcripts (
      id, source_type, source_path, file_name, media_type, status,
      transcript_text, language, duration_ms, provider, provider_id,
      error_message, embedding, created_at, updated_at
    ) VALUES (
      @id, 'sample', @sourcePath, @fileName, @mediaType, 'completed',
      @text, 'en', @durationMs, 'sample', null,
      null, null, @now, @now
    )
  `);
  const insertFts = db.prepare(`
    INSERT INTO transcripts_fts (id, file_name, transcript_text)
    VALUES (@id, @fileName, @text)
  `);

  const tx = db.transaction(() => {
    for (const sample of samples) {
      const id = randomUUID();
      insert.run({
        id,
        sourcePath: sample.sourcePath,
        fileName: sample.fileName,
        mediaType: guessMediaType(sample.fileName),
        text: sample.text,
        durationMs: 120000,
        now,
      });
      insertFts.run({ id, fileName: sample.fileName, text: sample.text });
    }
  });
  tx();
}

export function guessMediaType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
  };
  return map[ext] || "application/octet-stream";
}

export function listTranscripts(limit = 100): TranscriptRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM transcripts ORDER BY datetime(created_at) DESC LIMIT ?`,
    )
    .all(limit) as TranscriptRow[];
  return rows.map(mapRow);
}

export function getTranscript(id: string): TranscriptRecord | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM transcripts WHERE id = ?`).get(id) as
    | TranscriptRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function createTranscript(input: {
  sourceType: SourceType;
  sourcePath: string;
  fileName: string;
  mediaType?: string | null;
  status?: TranscriptStatus;
}): TranscriptRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO transcripts (
      id, source_type, source_path, file_name, media_type, status,
      transcript_text, language, duration_ms, provider, provider_id,
      error_message, embedding, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, null, null, null, null, null, null, null, ?, ?)`,
  ).run(
    id,
    input.sourceType,
    input.sourcePath,
    input.fileName,
    input.mediaType ?? guessMediaType(input.fileName),
    input.status ?? "pending",
    now,
    now,
  );
  return getTranscript(id)!;
}

export function updateTranscript(
  id: string,
  patch: Partial<{
    status: TranscriptStatus;
    transcriptText: string | null;
    language: string | null;
    durationMs: number | null;
    provider: string | null;
    providerId: string | null;
    errorMessage: string | null;
    embedding: number[] | null;
  }>,
): TranscriptRecord | null {
  const db = getDb();
  const current = db.prepare(`SELECT * FROM transcripts WHERE id = ?`).get(id) as
    | TranscriptRow
    | undefined;
  if (!current) return null;

  const next = {
    status: patch.status ?? current.status,
    transcript_text:
      patch.transcriptText !== undefined
        ? patch.transcriptText
        : current.transcript_text,
    language: patch.language !== undefined ? patch.language : current.language,
    duration_ms:
      patch.durationMs !== undefined ? patch.durationMs : current.duration_ms,
    provider: patch.provider !== undefined ? patch.provider : current.provider,
    provider_id:
      patch.providerId !== undefined ? patch.providerId : current.provider_id,
    error_message:
      patch.errorMessage !== undefined
        ? patch.errorMessage
        : current.error_message,
    embedding:
      patch.embedding !== undefined
        ? patch.embedding
          ? JSON.stringify(patch.embedding)
          : null
        : current.embedding,
    updated_at: new Date().toISOString(),
  };

  db.prepare(
    `UPDATE transcripts SET
      status = @status,
      transcript_text = @transcript_text,
      language = @language,
      duration_ms = @duration_ms,
      provider = @provider,
      provider_id = @provider_id,
      error_message = @error_message,
      embedding = @embedding,
      updated_at = @updated_at
    WHERE id = @id`,
  ).run({ id, ...next });

  if (next.transcript_text) {
    db.prepare(`DELETE FROM transcripts_fts WHERE id = ?`).run(id);
    db.prepare(
      `INSERT INTO transcripts_fts (id, file_name, transcript_text) VALUES (?, ?, ?)`,
    ).run(id, current.file_name, next.transcript_text);
  }

  return getTranscript(id);
}

export function keywordSearch(query: string, limit = 20): Array<{
  id: string;
  rank: number;
  snippet: string;
}> {
  const db = getDb();
  const q = query.trim();
  if (!q) return [];

  const rows = db
    .prepare(
      `SELECT id,
              bm25(transcripts_fts) AS rank,
              snippet(transcripts_fts, 2, '⟨', '⟩', '…', 18) AS snippet
       FROM transcripts_fts
       WHERE transcripts_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    )
    .all(toFtsQuery(q), limit) as Array<{
    id: string;
    rank: number;
    snippet: string;
  }>;

  return rows;
}

function toFtsQuery(input: string): string {
  return input
    .split(/\s+/)
    .map((token) => token.replace(/["']/g, ""))
    .filter(Boolean)
    .map((token) => `"${token}"*`)
    .join(" AND ");
}

export function listCompletedWithEmbeddings(): Array<
  TranscriptRecord & { embedding: number[] | null }
> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM transcripts WHERE status = 'completed' AND transcript_text IS NOT NULL`,
    )
    .all() as TranscriptRow[];

  return rows.map((row) => ({
    ...mapRow(row),
    embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : null,
  }));
}

export function countTranscripts(): { total: number; completed: number } {
  const db = getDb();
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM transcripts`).get() as { c: number }
  ).c;
  const completed = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM transcripts WHERE status = 'completed'`)
      .get() as { c: number }
  ).c;
  return { total, completed };
}
