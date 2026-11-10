#!/usr/bin/env node
/**
 * Batch-ingest media from a local directory through the running ClipScript API.
 *
 * Usage:
 *   node scripts/ingest-dir.mjs /path/to/media [http://127.0.0.1:3847]
 */

const directory = process.argv[2];
const baseUrl = process.argv[3] || "http://127.0.0.1:3847";

if (!directory) {
  console.error("Usage: node scripts/ingest-dir.mjs <directory> [baseUrl]");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/ingest/local`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ directory }),
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
