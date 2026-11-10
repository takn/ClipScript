import OpenAI from "openai";
import { createHash } from "crypto";
import { getConfigStatus } from "./config";

const LOCAL_DIM = 256;

export async function embedText(text: string): Promise<{
  embedding: number[];
  provider: "openai" | "local";
}> {
  const status = getConfigStatus();
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 12000);
  if (!cleaned) {
    return { embedding: new Array(LOCAL_DIM).fill(0), provider: "local" };
  }

  if (status.openAiConfigured) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleaned,
    });
    return {
      embedding: response.data[0]?.embedding ?? [],
      provider: "openai",
    };
  }

  return { embedding: localEmbed(cleaned), provider: "local" };
}

/** Deterministic hashed bag-of-words embedding for offline / mock mode. */
function localEmbed(text: string): number[] {
  const vector = new Array(LOCAL_DIM).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    const index = digest.readUInt16BE(0) % LOCAL_DIM;
    const sign = digest[2]! % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  return l2Normalize(vector);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}
