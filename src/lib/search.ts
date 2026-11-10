import {
  getTranscript,
  keywordSearch,
  listCompletedWithEmbeddings,
  updateTranscript,
} from "./db";
import { cosineSimilarity, embedText } from "./embeddings";
import type { SearchHit, SearchMode } from "./types";

export async function ensureEmbedding(id: string): Promise<void> {
  const rows = listCompletedWithEmbeddings();
  const row = rows.find((r) => r.id === id);
  if (!row?.transcriptText || row.embedding) return;
  const { embedding } = await embedText(row.transcriptText);
  updateTranscript(id, { embedding });
}

export async function ensureAllEmbeddings(): Promise<number> {
  const rows = listCompletedWithEmbeddings();
  let updated = 0;
  for (const row of rows) {
    if (!row.transcriptText || row.embedding) continue;
    const { embedding } = await embedText(row.transcriptText);
    updateTranscript(row.id, { embedding });
    updated += 1;
  }
  return updated;
}

export async function searchTranscripts(options: {
  query: string;
  mode?: SearchMode;
  limit?: number;
}): Promise<SearchHit[]> {
  const query = options.query.trim();
  const mode = options.mode ?? "hybrid";
  const limit = options.limit ?? 20;
  if (!query) return [];

  await ensureAllEmbeddings();

  if (mode === "keyword") {
    return keywordHits(query, limit);
  }

  if (mode === "semantic") {
    return semanticHits(query, limit);
  }

  return hybridHits(query, limit);
}

async function keywordHits(query: string, limit: number): Promise<SearchHit[]> {
  const matches = keywordSearch(query, limit);
  return matches
    .map((match) => {
      const record = getTranscript(match.id);
      if (!record) return null;
      return {
        ...record,
        score: Math.max(0, 1 / (1 + Math.abs(match.rank))),
        snippet: match.snippet || snippetFrom(record.transcriptText, query),
      };
    })
    .filter((hit): hit is SearchHit => Boolean(hit));
}

async function semanticHits(
  query: string,
  limit: number,
): Promise<SearchHit[]> {
  const { embedding: queryEmbedding } = await embedText(query);
  const rows = listCompletedWithEmbeddings();

  return rows
    .map((row) => {
      const score = row.embedding
        ? cosineSimilarity(queryEmbedding, row.embedding)
        : 0;
      const { embedding: _embedding, ...record } = row;
      return {
        ...record,
        score,
        snippet: snippetFrom(row.transcriptText, query),
      };
    })
    .filter((hit) => hit.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function hybridHits(query: string, limit: number): Promise<SearchHit[]> {
  const [keyword, semantic] = await Promise.all([
    keywordHits(query, limit),
    semanticHits(query, limit),
  ]);

  const merged = new Map<string, SearchHit>();
  for (const hit of keyword) {
    merged.set(hit.id, { ...hit, score: hit.score * 0.55 });
  }
  for (const hit of semantic) {
    const existing = merged.get(hit.id);
    if (existing) {
      existing.score += hit.score * 0.45;
      if (!existing.snippet.includes("⟨") && hit.snippet) {
        existing.snippet = hit.snippet;
      }
    } else {
      merged.set(hit.id, { ...hit, score: hit.score * 0.45 });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function snippetFrom(text: string | null, query: string): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const token = query.toLowerCase().split(/\s+/).find(Boolean) || "";
  const index = token ? lower.indexOf(token) : 0;
  const start = Math.max(0, (index >= 0 ? index : 0) - 80);
  const end = Math.min(text.length, start + 220);
  const slice = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}
