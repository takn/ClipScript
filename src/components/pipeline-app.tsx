"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileAudio,
  Cloud,
  Search,
  Sparkles,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ConfigStatus,
  IngestResult,
  SearchHit,
  SearchMode,
  TranscriptRecord,
} from "@/lib/types";

type StatusResponse = ConfigStatus & {
  counts: { total: number; completed: number };
};

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  const seconds = Math.round(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PipelineApp() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("onboarding friction");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [s3Prefix, setS3Prefix] = useState("");
  const [s3Objects, setS3Objects] = useState<
    Array<{ key: string; size: number | null }>
  >([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const selected = useMemo(
    () => transcripts.find((item) => item.id === selectedId) ?? null,
    [transcripts, selectedId],
  );

  const refresh = useCallback(async () => {
    const [statusRes, listRes] = await Promise.all([
      fetch("/api/status"),
      fetch("/api/transcripts"),
    ]);
    const statusJson = (await statusRes.json()) as StatusResponse;
    const listJson = (await listRes.json()) as { transcripts: TranscriptRecord[] };
    setStatus(statusJson);
    setTranscripts(listJson.transcripts);
    setSelectedId((current) => current ?? listJson.transcripts[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load"),
    );
  }, [refresh]);

  async function runSearch() {
    setBusy("search");
    setError(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Search failed");
      setHits(json.hits as SearchHit[]);
      if (json.hits?.[0]?.id) setSelectedId(json.hits[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(null);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));
      const response = await fetch("/api/ingest/local", {
        method: "POST",
        body: form,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Upload failed");
      const results = json.results as IngestResult[];
      const ok = results.filter((r) => r.status === "completed").length;
      setMessage(`Ingested ${ok}/${results.length} local file(s).`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function listS3() {
    setBusy("s3-list");
    setError(null);
    try {
      const response = await fetch(
        `/api/s3/list?prefix=${encodeURIComponent(s3Prefix)}`,
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "S3 list failed");
      setS3Objects(json.objects || []);
      setSelectedKeys([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "S3 list failed");
    } finally {
      setBusy(null);
    }
  }

  async function ingestS3(keys?: string[]) {
    setBusy("s3-ingest");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/ingest/s3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          keys?.length
            ? { keys }
            : { ingestAll: true, prefix: s3Prefix || undefined },
        ),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "S3 ingest failed");
      const results = json.results as IngestResult[];
      setMessage(`S3 ingest finished: ${results.length} object(s).`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "S3 ingest failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(14,116,144,0.22),_transparent_45%),radial-gradient(ellipse_at_bottom_right,_rgba(217,119,6,0.16),_transparent_40%),linear-gradient(160deg,#07131a_0%,#102832_48%,#0b1c24_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <p className="font-display text-4xl tracking-tight text-[#f4efe6] sm:text-5xl">
              ClipScript
            </p>
            <p className="max-w-xl text-base leading-relaxed text-[#c7d5d8] sm:text-lg">
              Pull speech out of video and audio from a local folder or S3,
              store searchable transcripts, and find moments with keyword or
              semantic search.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-0 bg-[#124a57] text-[#d7f3f8] hover:bg-[#124a57]">
              Transcription: {status?.transcriptionMode ?? "…"}
            </Badge>
            <Badge className="border-0 bg-[#5a3a12] text-[#ffe6b8] hover:bg-[#5a3a12]">
              Embeddings: {status?.embeddingMode ?? "…"}
            </Badge>
            <Badge className="border-0 bg-[#1d3a2c] text-[#d7f5e4] hover:bg-[#1d3a2c]">
              Library: {status?.counts.completed ?? 0}/
              {status?.counts.total ?? 0}
            </Badge>
          </div>
        </header>

        {(message || error) && (
          <div
            className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
              error
                ? "bg-[#3a1717]/80 text-[#ffd2d2]"
                : "bg-[#143328]/80 text-[#d9ffe8]"
            }`}
          >
            {error ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p>{error || message}</p>
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-white/10 bg-[#0c1c24]/75 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="mb-4 flex items-center gap-2 text-[#f4efe6]">
              <Upload className="h-4 w-4 text-[#f0b45a]" />
              <h2 className="font-display text-2xl">Ingest</h2>
            </div>
            <Tabs defaultValue="upload">
              <TabsList className="grid w-full grid-cols-2 bg-[#10262f]">
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="s3">S3</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4 space-y-4">
                <p className="text-sm text-[#9fb4ba]">
                  Drop MP4, MOV, WAV, MP3, M4A, and other common media. AssemblyAI
                  is used when configured; otherwise mock transcripts keep the
                  pipeline usable. For folders on your machine, use{" "}
                  <code className="text-[#d7e6ea]">npm run ingest:dir</code>.
                </p>
                <Label
                  htmlFor="file-input"
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#2f5b68] bg-[#0a171d] px-6 py-10 text-center transition hover:border-[#f0b45a]/60 hover:bg-[#102029]"
                >
                  <FileAudio className="h-8 w-8 text-[#7fd0df]" />
                  <span className="text-sm text-[#d7e6ea]">
                    Choose media files to transcribe
                  </span>
                  <Input
                    id="file-input"
                    type="file"
                    multiple
                    accept="audio/*,video/*,.mp4,.mov,.mkv,.webm,.avi,.mp3,.wav,.m4a,.flac,.ogg"
                    className="hidden"
                    onChange={(event) => void uploadFiles(event.target.files)}
                  />
                </Label>
              </TabsContent>

              <TabsContent value="s3" className="mt-4 space-y-4">
                <p className="text-sm text-[#9fb4ba]">
                  List media under a bucket prefix, then ingest selected keys or
                  everything matched. Requires S3_* secrets.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefix</Label>
                  <Input
                    id="prefix"
                    value={s3Prefix}
                    onChange={(event) => setS3Prefix(event.target.value)}
                    placeholder="intake/calls/"
                    className="border-white/10 bg-[#0a171d] text-[#f4efe6]"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => void listS3()}
                    disabled={busy === "s3-list"}
                    className="bg-[#1a3640] text-[#d7eef3] hover:bg-[#234652]"
                  >
                    {busy === "s3-list" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Cloud className="mr-2 h-4 w-4" />
                    )}
                    List objects
                  </Button>
                  <Button
                    onClick={() => void ingestS3(selectedKeys)}
                    disabled={busy === "s3-ingest" || selectedKeys.length === 0}
                    className="bg-[#f0b45a] text-[#1a1205] hover:bg-[#ffc76f]"
                  >
                    Ingest selected
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void ingestS3()}
                    disabled={busy === "s3-ingest"}
                    className="border-white/15 bg-transparent text-[#d7eef3] hover:bg-white/5"
                  >
                    Ingest all under prefix
                  </Button>
                </div>
                <div className="max-h-48 space-y-2 overflow-auto rounded-xl border border-white/10 bg-[#0a171d] p-3">
                  {s3Objects.length === 0 ? (
                    <p className="text-sm text-[#7f969c]">
                      No objects listed yet
                      {status && !status.s3Configured
                        ? " — S3 secrets are not configured."
                        : "."}
                    </p>
                  ) : (
                    s3Objects.map((object) => {
                      const checked = selectedKeys.includes(object.key);
                      return (
                        <label
                          key={object.key}
                          className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 text-sm text-[#d5e6ea] hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedKeys((current) =>
                                checked
                                  ? current.filter((key) => key !== object.key)
                                  : [...current, object.key],
                              )
                            }
                            className="mt-1"
                          />
                          <span className="break-all">{object.key}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0c1c24]/75 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="mb-4 flex items-center gap-2 text-[#f4efe6]">
              <Search className="h-4 w-4 text-[#7fd0df]" />
              <h2 className="font-display text-2xl">Search</h2>
            </div>
            <div className="space-y-4">
              <Textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={3}
                className="border-white/10 bg-[#0a171d] text-[#f4efe6]"
                placeholder="refund policy, churn risk, pricing discussion…"
              />
              <div className="flex flex-wrap gap-2">
                {(["hybrid", "keyword", "semantic"] as SearchMode[]).map(
                  (value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={mode === value ? "default" : "outline"}
                      onClick={() => setMode(value)}
                      className={
                        mode === value
                          ? "bg-[#1f6f7d] text-white hover:bg-[#258496]"
                          : "border-white/15 bg-transparent text-[#d7eef3] hover:bg-white/5"
                      }
                    >
                      {value === "semantic" && (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {value}
                    </Button>
                  ),
                )}
                <Button
                  onClick={() => void runSearch()}
                  disabled={!query.trim() || busy === "search"}
                  className="ml-auto bg-[#f0b45a] text-[#1a1205] hover:bg-[#ffc76f]"
                >
                  {busy === "search" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Search library
                </Button>
              </div>
              <div className="max-h-72 space-y-2 overflow-auto">
                {hits.length === 0 ? (
                  <p className="text-sm text-[#7f969c]">
                    Run a search to rank transcripts by exact terms, meaning, or
                    both.
                  </p>
                ) : (
                  hits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => setSelectedId(hit.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        selectedId === hit.id
                          ? "border-[#f0b45a]/50 bg-[#173039]"
                          : "border-white/10 bg-[#0a171d] hover:border-white/20"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-[#f4efe6]">
                          {hit.fileName}
                        </span>
                        <span className="text-xs text-[#9fb4ba]">
                          {(hit.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-[#9fb4ba]">
                        {hit.snippet}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-white/10 bg-[#0c1c24]/75 p-5 backdrop-blur">
            <h2 className="mb-4 font-display text-2xl text-[#f4efe6]">Library</h2>
            <div className="max-h-[28rem] space-y-2 overflow-auto">
              {transcripts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    selectedId === item.id
                      ? "border-[#7fd0df]/40 bg-[#14323b]"
                      : "border-white/10 bg-[#0a171d] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-[#f4efe6]">
                      {item.fileName}
                    </span>
                    <Badge
                      className={`border-0 ${
                        item.status === "completed"
                          ? "bg-[#1d3a2c] text-[#d7f5e4]"
                          : item.status === "error"
                            ? "bg-[#3a1717] text-[#ffd2d2]"
                            : "bg-[#3a3017] text-[#ffe6b8]"
                      }`}
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[#7f969c]">
                    {item.sourceType} · {item.provider || "—"} ·{" "}
                    {formatDuration(item.durationMs)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0c1c24]/75 p-5 backdrop-blur">
            <h2 className="mb-4 font-display text-2xl text-[#f4efe6]">
              Transcript
            </h2>
            {selected ? (
              <div className="space-y-4">
                <div>
                  <p className="text-lg text-[#f4efe6]">{selected.fileName}</p>
                  <p className="text-sm text-[#9fb4ba]">
                    {selected.sourcePath}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-0 bg-[#124a57] text-[#d7f3f8]">
                    {selected.sourceType}
                  </Badge>
                  <Badge className="border-0 bg-[#5a3a12] text-[#ffe6b8]">
                    {selected.language || "language unknown"}
                  </Badge>
                  <Badge className="border-0 bg-[#1d3a2c] text-[#d7f5e4]">
                    {selected.provider || "no provider"}
                  </Badge>
                </div>
                {selected.errorMessage ? (
                  <p className="rounded-xl bg-[#3a1717]/80 px-3 py-2 text-sm text-[#ffd2d2]">
                    {selected.errorMessage}
                  </p>
                ) : (
                  <div className="max-h-[22rem] overflow-auto rounded-xl border border-white/10 bg-[#0a171d] p-4 text-sm leading-7 text-[#d5e6ea]">
                    {selected.transcriptText || "No transcript text yet."}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#7f969c]">
                Select a transcript from the library.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
