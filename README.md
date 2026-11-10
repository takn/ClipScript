# ClipScript

ClipScript is a transcript extraction pipeline for video and audio. It ingests media from a **local directory** or an **S3 bucket**, sends files through **AssemblyAI** (a commercial speech-to-text API that accepts common video and audio formats), stores the text in a local SQLite database, and exposes **keyword**, **semantic**, and **hybrid** search.

## What you can do

- Upload media in the browser or point the API at a folder
- List and ingest media keys from S3
- Browse completed transcripts
- Search with exact terms (SQLite FTS5), meaning (embeddings), or both

Without API keys the app still runs in mock mode with sample transcripts so you can exercise ingest and search end to end.

## Quick start

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

Copy `.env.example` to `.env.local` and fill in secrets as needed:

| Variable | Purpose |
| --- | --- |
| `ASSEMBLYAI_API_KEY` | Real transcription for MP4, MOV, WAV, MP3, and similar |
| `OPENAI_API_KEY` | OpenAI `text-embedding-3-small` for semantic search |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_REGION` / `S3_BUCKET` | S3 listing and ingest |

## Batch directory ingest

With the dev server running:

```bash
npm run ingest:dir -- /path/to/media
```

## API surface

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/status` | Provider + library status |
| `GET` | `/api/transcripts` | List transcripts |
| `GET` | `/api/transcripts/:id` | Fetch one transcript |
| `POST` | `/api/search` | `{ query, mode?: "keyword" \| "semantic" \| "hybrid" }` |
| `POST` | `/api/ingest/local` | multipart `files` or JSON `{ directory }` |
| `GET` | `/api/s3/list?prefix=` | List media objects |
| `POST` | `/api/ingest/s3` | `{ keys }` or `{ ingestAll, prefix }` |

## Architecture

- **Next.js** app router UI + route handlers
- **AssemblyAI** for commercial multi-format transcription
- **SQLite** (`better-sqlite3`) with FTS5 for keyword search
- **OpenAI embeddings** when configured, otherwise a deterministic local embedding fallback
- **AWS SDK** for S3 list/get using non-reserved `S3_*` env names

Transcripts live in `data/transcripts.db` by default.
