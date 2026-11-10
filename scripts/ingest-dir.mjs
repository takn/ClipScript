#!/usr/bin/env node
/**
 * Batch-upload media from a local directory through ClipScript's authenticated
 * multipart upload API. The server never receives a filesystem path.
 *
 * Usage:
 *   node scripts/ingest-dir.mjs /path/to/media [http://127.0.0.1:3847]
 */

import fs from "fs";
import path from "path";

const directory = process.argv[2];
const baseUrl = process.argv[3] || "http://127.0.0.1:3847";
const mediaExt = new Set([
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
]);

if (!directory) {
  console.error("Usage: node scripts/ingest-dir.mjs <directory> [baseUrl]");
  process.exit(1);
}

const absolute = path.resolve(directory);
if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
  console.error(`Directory not found: ${absolute}`);
  process.exit(1);
}

const files = fs
  .readdirSync(absolute)
  .filter((name) => mediaExt.has(path.extname(name).toLowerCase()))
  .map((name) => path.join(absolute, name));

if (files.length === 0) {
  console.error("No supported media files found.");
  process.exit(1);
}

const form = new FormData();
for (const filePath of files.slice(0, 5)) {
  const bytes = fs.readFileSync(filePath);
  form.append(
    "files",
    new Blob([bytes]),
    path.basename(filePath),
  );
}

const response = await fetch(`${baseUrl}/api/ingest/local`, {
  method: "POST",
  body: form,
});

const json = await response.json();
if (!response.ok) {
  console.error(json.error || "Ingest failed");
  process.exit(1);
}

for (const result of json.results || []) {
  const mark = result.status === "completed" ? "ok" : "err";
  console.log(`[${mark}] ${result.fileName} (${result.provider})`);
  if (result.errorMessage) console.log(`      ${result.errorMessage}`);
}

if (files.length > 5) {
  console.log(`Note: uploaded first 5 of ${files.length} files (API batch limit).`);
}
