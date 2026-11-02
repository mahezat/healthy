// Gemini calls through Google's Interactions API (@google/genai).
// Docs: ai.google.dev/gemini-api/docs/structured-output and /google-search (Oct 2026).

import { GoogleGenAI } from "@google/genai";
import { config, HttpError, requireGemini } from "./config";

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  requireGemini();
  if (!client) client = new GoogleGenAI({ apiKey: config.geminiKey });
  return client;
}

export interface ImageInput {
  /** base64 without the data: prefix */
  data: string;
  mimeType: string;
}

export interface Citation {
  url: string;
  title?: string;
}

/** Accepts "data:image/jpeg;base64,..." or raw base64 (assumed JPEG). */
export function parseImage(input: string): ImageInput {
  const m = input.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: "image/jpeg", data: input };
}

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new HttpError(502, "The AI did not return valid JSON.");
  }
}

interface Step {
  type: string;
  content?: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[];
}

function citationsFrom(steps: Step[] | undefined): Citation[] {
  const out = new Map<string, Citation>();
  for (const s of steps ?? []) {
    if (s.type !== "model_output") continue;
    for (const c of s.content ?? []) {
      for (const a of c.annotations ?? []) {
        if (a.type === "url_citation" && a.url) out.set(a.url, { url: a.url, title: a.title });
      }
    }
  }
  return [...out.values()];
}

export async function geminiJson<T>(opts: {
  prompt: string;
  schema: Record<string, unknown>;
  images?: ImageInput[];
  system?: string;
  search?: boolean;
  model?: string;
  timeoutMs?: number;
}): Promise<{ data: T; citations: Citation[] }> {
  const input = [
    { type: "text" as const, text: opts.prompt },
    ...(opts.images ?? []).map((i) => ({ type: "image" as const, data: i.data, mime_type: i.mimeType })),
  ];
  const base = {
    model: opts.model ?? config.geminiModel,
    input,
    system_instruction: opts.system,
    store: false,
    ...(opts.search ? { tools: [{ type: "google_search" as const }] } : {}),
  };
  const timeout = opts.timeoutMs ?? 45000;
  const format = { response_format: { type: "text", mime_type: "application/json", schema: opts.schema } };
  const jsonInPrompt = {
    input: [{ type: "text" as const, text: `${opts.prompt}\n\nReply with only a JSON object matching this JSON Schema, no other text:\n${JSON.stringify(opts.schema)}` }, ...input.slice(1)],
  };

  // Fastest settings first. If the model rejects an option (thinking level, or structured output
  // together with Google Search, which is a preview feature), fall back step by step.
  const attempts: Record<string, unknown>[] = [
    { ...base, ...format, generation_config: { temperature: 0.1, thinking_level: "minimal" } },
    { ...base, ...format, generation_config: { temperature: 0.1 } },
    ...(opts.search ? [{ ...base, ...jsonInPrompt, generation_config: { temperature: 0.1 } }] : []),
  ];

  let interaction: { output_text?: string; steps?: unknown[] } | undefined;
  let lastError: unknown;
  for (const params of attempts) {
    try {
      interaction = (await ai().interactions.create({ ...(params as { model: string }), stream: false }, { timeout })) as { output_text?: string; steps?: unknown[] };
      break;
    } catch (e) {
      lastError = e;
      const msg = String((e as Error)?.message ?? e);
      if (!/INVALID_ARGUMENT|400|not supported|unsupported|thinking|response_format|schema/i.test(msg)) break;
    }
  }
  if (!interaction) throw wrap(lastError);

  const text = interaction.output_text ?? "";
  if (!text) throw new HttpError(502, "The AI returned an empty answer.");
  return { data: extractJson(text) as T, citations: citationsFrom(interaction.steps as Step[] | undefined) };
}

function wrap(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  const msg = String((e as Error)?.message ?? e);
  if (/API key|PERMISSION_DENIED|401|403/i.test(msg)) return new HttpError(502, `Gemini rejected the API key: ${msg}`);
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) return new HttpError(429, "Gemini rate limit reached. Try again in a minute.");
  if (/404|not found/i.test(msg) && /model/i.test(msg)) return new HttpError(502, `Gemini model not found. Check GEMINI_MODEL in Vercel. ${msg}`);
  return new HttpError(502, `Gemini error: ${msg}`);
}

/** Cheap call used by /api/status to confirm the key and model work. */
export async function geminiPing(): Promise<string> {
  try {
    const r = await ai().interactions.create({ model: config.geminiModel, input: "Reply with the word ok.", store: false }, { timeout: 20000 });
    return (r.output_text ?? "").trim() ? "connected" : "empty reply";
  } catch (e) {
    return `error: ${wrap(e).message}`;
  }
}
