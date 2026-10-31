// Turns ingredient text into rated ingredients.

import { ADDITIVES, displayName, findAdditive, normalizeCode } from "./data/additives";
import { findIngredient } from "./data/ingredients";
import { kvGet, kvPut } from "./db";
import { geminiJson } from "./gemini";
import { urlExists } from "./http";
import type { Category, Ref, RatedIngredient, RiskLevel } from "./types";
import { config } from "./config";

const NOISE = [
  /^\s*ingredients?(?:\s*\/\s*ingredients?)?\s*:?\s*/i,
  /contains\s+(?:\d+(?:\.\d+)?\s*%\s+)?(?:or\s+)?less\s+(?:than\s+\d+(?:\.\d+)?\s*%\s+)?of(?:\s+the\s+following)?\s*:?\s*/gi,
  /less than \d+(?:\.\d+)?\s*% of\s*:?\s*/gi,
  /may contain\s*:?\s*/gi,
  /\band\/or\b/gi,
];

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[*†‡°]+/g, "")
    .replace(/\b\d+(?:[.,]\d+)?\s*%/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s.:;,-]+|[\s.:;,-]+$/g, "")
    .trim();
}

/** Splits an ingredient list at top-level commas, semicolons and sentence periods; keeps sub-ingredients too. */
export function splitIngredients(text: string): string[] {
  let t = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\r?\n/g, " ");
  for (const re of NOISE) t = t.replace(re, ", ");
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  const push = () => {
    const n = normalizeName(cur);
    if (n && n.length < 120) out.push(n);
    cur = "";
  };
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === "(" || ch === "[") {
      depth++;
      cur += ch;
    } else if (ch === ")" || ch === "]") {
      depth = Math.max(0, depth - 1);
      cur += ch;
    } else if (depth === 0 && (ch === "," || ch === ";" || (ch === "." && (t[i + 1] === " " || i === t.length - 1) && !/\d/.test(t[i - 1] ?? "")))) {
      push();
    } else cur += ch;
  }
  push();

  // Flatten "enriched flour (wheat flour, niacin)" into the parent and its parts.
  const flat: string[] = [];
  for (const item of out) {
    const m = item.match(/^([^([]+)[([](.+)[)\]]$/);
    if (m) {
      flat.push(normalizeName(m[1]));
      for (const sub of splitIngredients(m[2])) flat.push(sub);
    } else flat.push(item);
  }
  return [...new Set(flat.filter(Boolean))];
}

const FOOD: Category[] = ["food", "beverage"];

/** Food: additives only (Yuka's food method). Codes from Open Food Facts win; otherwise detect from names. */
export async function rateAdditives(codes: string[], ingredientNames: string[], useAi = true): Promise<RatedIngredient[]> {
  const found = new Map<string, RatedIngredient>();
  const unknownCodes: string[] = [];
  const addCode = (code: string) => {
    const c = normalizeCode(code);
    if (!c || found.has(c)) return;
    const hit = findAdditive(c);
    if (hit) found.set(c, rated(displayName(hit.entry, c), hit.entry.level, hit.entry.concern, hit.entry.refs, c));
    else unknownCodes.push(c);
  };
  // Open Food Facts lists both a family and its member (e340 and e340iii): keep only the most specific.
  const norm = codes.map((c) => normalizeCode(c)).filter((c): c is string => !!c);
  norm.filter((c) => !norm.some((o) => o !== c && o.startsWith(c))).forEach(addCode);
  for (const name of ingredientNames) {
    const inline = name.match(/\be\s?-?\d{3,4}[a-z]?\b/gi);
    inline?.forEach(addCode);
    const hit = findAdditive(name.replace(/\s*\(e\s?\d+[a-z]?\)/i, ""));
    if (hit) {
      const key = hit.code || name;
      if (!found.has(key) && ![...found.values()].some((f) => f.name === displayName(hit.entry, hit.code))) {
        found.set(key, rated(displayName(hit.entry, hit.code || undefined), hit.entry.level, hit.entry.concern, hit.entry.refs, hit.code || undefined));
      }
    }
  }
  if (unknownCodes.length) {
    const ai = useAi ? await aiRate(unknownCodes, "food") : await cachedOnly(unknownCodes, "additive");
    for (const r of ai) found.set(r.code ?? r.name, r);
  }
  return [...found.values()].sort((a, b) => b.level - a.level);
}

/** Cosmetics-style: every ingredient gets a level. */
export async function rateIngredients(names: string[], category: Category, useAi = true): Promise<RatedIngredient[]> {
  const results: RatedIngredient[] = [];
  const unknown: string[] = [];
  for (const raw of names) {
    const hit = lookupNonFood(raw);
    if (hit) results.push(hit);
    else unknown.push(raw);
  }
  if (unknown.length) results.push(...(useAi ? await aiRate(unknown, category) : await cachedOnly(unknown, "ingredient")));
  return results;
}

function lookupNonFood(raw: string): RatedIngredient | null {
  const tries = [raw];
  if (raw.includes("/") && !findIngredient(raw)) tries.push(raw.split("/")[0].trim());
  tries.push(raw.replace(/\s*\(.*\)\s*/g, " ").trim());
  for (const t of tries) {
    const e = findIngredient(t);
    if (e) return rated(pretty(t), e.level, e.concern, e.refs);
    const a = findAdditive(t);
    if (a) return rated(pretty(t), a.entry.level, a.entry.concern, a.entry.refs, a.code || undefined);
  }
  return null;
}

function rated(name: string, level: RiskLevel, concern: string, refs: Ref[], code?: string, aiRated?: boolean): RatedIngredient {
  return { name, level, concern, refs, ...(code ? { code } : {}), ...(aiRated ? { aiRated } : {}) };
}

function pretty(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface AiRating {
  name: string;
  level: number;
  concern: string;
  refs: { org: string; note: string }[];
}

const AI_SCHEMA = {
  type: "object",
  properties: {
    ratings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          level: { type: "integer", minimum: 0, maximum: 3 },
          concern: { type: "string" },
          refs: { type: "array", items: { type: "object", properties: { org: { type: "string" }, note: { type: "string" } }, required: ["org", "note"] } },
        },
        required: ["name", "level", "concern", "refs"],
      },
    },
  },
  required: ["ratings"],
};

/** Rates unknown ingredients with Gemini, one cache entry per ingredient. Falls back to "unknown" on failure. */
export async function aiRate(names: string[], category: Category): Promise<RatedIngredient[]> {
  const ns = FOOD.includes(category) ? "additive" : "ingredient";
  const out: RatedIngredient[] = [];
  const todo: string[] = [];
  for (const n of [...new Set(names)]) {
    const cached = await kvGet<RatedIngredient>(ns, n).catch(() => null);
    if (cached) out.push(cached.data);
    else todo.push(n);
  }
  if (!todo.length) return out;
  if (!config.geminiKey) return [...out, ...todo.map(unknownIngredient)];

  for (let i = 0; i < todo.length; i += 40) {
    const batch = todo.slice(i, i + 40);
    try {
      const { data } = await geminiJson<{ ratings: AiRating[] }>({
        system:
          "You are a regulatory toxicologist. Rate ingredients for consumer products on a 4-step scale: " +
          "0 risk-free, 1 low risk, 2 moderate risk, 3 high risk. Base it only on positions of EFSA, the EU Cosmetics Regulation and SCCS, IARC, the US FDA, the Cosmetic Ingredient Review (CIR), ECHA, and peer-reviewed studies. " +
          "High risk = banned or restricted for health reasons, IARC Group 1/2A, or confirmed endocrine disruptor. Moderate = IARC 2B, suspected endocrine disruptor, strong allergen or restricted. Low = irritant, minor allergen, or environmental concern. " +
          "Plant extracts, oils, vitamins, minerals, sugars and ordinary foods are 0 unless a specific concern exists. Do not invent studies. If you do not recognize an ingredient, give level 0 and concern 'Unknown ingredient'. Keep concern under 15 words.",
        prompt: `Product type: ${category}. Rate each of these ingredients and return them in the same order, with the name exactly as given:\n${batch.map((b, j) => `${j + 1}. ${b}`).join("\n")}`,
        schema: AI_SCHEMA,
      });
      for (const name of batch) {
        const r = data.ratings.find((x) => normalizeName(x.name) === name) ?? data.ratings[batch.indexOf(name)];
        const lvl = Math.max(0, Math.min(3, Math.round(r?.level ?? 0))) as RiskLevel;
        const unknown = !r || /unknown ingredient/i.test(r.concern);
        const item: RatedIngredient = unknown
          ? unknownIngredient(name)
          : { name: pretty(name), level: lvl, concern: r.concern, refs: (r.refs ?? []).slice(0, 3), aiRated: true, ...(normalizeCode(name) ? { code: normalizeCode(name)! } : {}) };
        out.push(item);
        if (!unknown) await kvPut(ns, name, item).catch(() => {});
      }
    } catch {
      out.push(...batch.map(unknownIngredient));
    }
  }
  return out;
}

async function cachedOnly(names: string[], ns: string): Promise<RatedIngredient[]> {
  return Promise.all(names.map(async (n) => (await kvGet<RatedIngredient>(ns, n).catch(() => null))?.data ?? unknownIngredient(n)));
}

function unknownIngredient(name: string): RatedIngredient {
  return { name: pretty(name), level: 0, concern: "Not in our list yet", refs: [], unknown: true };
}

// ---------- EWG (on demand, per ingredient) ----------

export interface EwgRating {
  found: boolean;
  score?: number;
  dataAvailability?: string;
  url?: string;
  checkedAt: string;
}

export async function ewgRating(name: string): Promise<EwgRating> {
  const key = normalizeName(name);
  const cached = await kvGet<EwgRating>("ewg", key).catch(() => null);
  if (cached) return cached.data;
  const none: EwgRating = { found: false, checkedAt: new Date().toISOString() };
  if (!config.geminiKey) return none;
  try {
    const { data, citations } = await geminiJson<{ found: boolean; score?: number; dataAvailability?: string; url?: string }>({
      search: true,
      prompt: `Look up the ingredient "${name}" in the EWG Skin Deep database (ewg.org/skindeep). Return its hazard score (1 to 10), its data availability (None, Limited, Fair, Good, Robust), and the exact ewg.org page URL. If you cannot find an EWG Skin Deep page for this exact ingredient, return found: false. Never guess a score.`,
      schema: {
        type: "object",
        properties: { found: { type: "boolean" }, score: { type: "integer", minimum: 1, maximum: 10 }, dataAvailability: { type: "string" }, url: { type: "string" } },
        required: ["found"],
      },
    });
    let result = none;
    const url = data.url && /ewg\.org/i.test(data.url) ? data.url : citations.find((c) => /ewg\.org/i.test(c.url))?.url;
    if (data.found && data.score && url && (await urlExists(url))) {
      result = { found: true, score: data.score, dataAvailability: data.dataAvailability, url, checkedAt: new Date().toISOString() };
    }
    await kvPut("ewg", key, result).catch(() => {});
    return result;
  } catch {
    return none;
  }
}

export async function ingredientDetail(name: string, category: Category) {
  const key = normalizeName(name);
  let rating: RatedIngredient | null;
  if (FOOD.includes(category)) {
    const hit = findAdditive(key);
    rating = hit ? rated(displayName(hit.entry, hit.code || undefined), hit.entry.level, hit.entry.concern, hit.entry.refs, hit.code || undefined) : null;
  } else rating = lookupNonFood(key);
  if (!rating) rating = (await aiRate([key], category))[0];
  const ewg = FOOD.includes(category) ? null : await ewgRating(key);
  const otherNames = FOOD.includes(category) ? ADDITIVES.find((a) => a.names.includes(key) || a.codes.includes(normalizeCode(key) ?? ""))?.names ?? [] : [];
  return { ...rating, otherNames, ewg };
}
