// The scan flow: barcode -> database -> (label photo | web) -> score + boycott -> saved.

import { randomUUID } from "crypto";
import { fullBoycott, quickBoycott } from "./boycott";
import { HttpError } from "./config";
import { addHistory, kvGet, kvPut, updateHistoryBoycott } from "./db";
import { parseImage } from "./gemini";
import { labelToInput, readLabel, readNutrition, toPer100, webLookup, type LabelRead } from "./label";
import { lookupBarcode, normalizeBarcode } from "./off";
import { FOOD_METHOD, missingData, scoreProduct } from "./score";
import type { BoycottResult, ProductInput, ScanResult } from "./types";

const OFF_REFRESH_DAYS = 7;

interface StoredProduct {
  input: ProductInput;
  result: ScanResult;
}

interface Draft {
  barcode?: string;
  key: string;
  input?: ProductInput;
  flags?: Omit<LabelRead, "ingredients" | "readable" | "problem">;
  missing?: ("ingredients" | "nutrition")[];
}

export type ScanResponse =
  | { status: "found"; result: ScanResult }
  | { status: "needs_label"; draftId: string; missing: ("ingredients" | "nutrition")[]; preview: Preview }
  | { status: "not_found"; draftId: string; barcode: string }
  | { status: "needs_nutrition"; draftId: string; preview: Preview }
  | { status: "unreadable"; draftId: string; problem: string };

interface Preview {
  name?: string;
  brand?: string;
  imageUrl?: string;
  category?: string;
}

const preview = (p?: ProductInput): Preview => ({ name: p?.name, brand: p?.brand, imageUrl: p?.imageUrl, category: p?.category });

async function saveDraft(d: Draft, id: string = randomUUID()): Promise<string> {
  await kvPut("draft", id, d);
  return id;
}

async function loadDraft(id: string): Promise<Draft> {
  const d = await kvGet<Draft>("draft", id);
  if (!d) throw new HttpError(404, "That scan expired. Scan the barcode again.");
  return d.data;
}

export async function finalize(input: ProductInput, record = true): Promise<ScanResult> {
  const [health, boycott] = await Promise.all([scoreProduct(input), quickBoycott(input)]);
  const result: ScanResult = {
    key: input.key,
    barcode: input.barcode,
    name: input.name,
    brand: input.brand,
    category: input.category,
    categoryTags: input.categoryTags,
    imageUrl: input.imageUrl,
    source: input.source,
    sourceUrl: input.sourceUrl,
    sourceNote: input.sourceNote,
    health,
    boycott,
    showAlternatives: health.score < 50 || !["clear", "checking"].includes(boycott.status),
    updatedAt: new Date().toISOString(),
  };
  await kvPut("product", input.key, { input, result } satisfies StoredProduct);
  if (record) await record_(result);
  return result;
}

async function record_(r: ScanResult) {
  await addHistory({ key: r.key, name: r.name, brand: r.brand, category: r.category, imageUrl: r.imageUrl, score: r.health.score, band: r.health.band, boycottStatus: r.boycott.status }).catch(() => {});
}

export async function getStored(key: string): Promise<StoredProduct | null> {
  return (await kvGet<StoredProduct>("product", key))?.data ?? null;
}

export async function scanBarcode(raw: string): Promise<ScanResponse> {
  const barcode = normalizeBarcode(raw);
  if (!barcode) throw new HttpError(400, "That doesn't look like a barcode.");

  for (const key of [`bc:${barcode}`, `bc:${barcode.padStart(13, "0")}`]) {
    const cached = await kvGet<StoredProduct>("product", key);
    if (!cached) continue;
    const fromDb = cached.data.input.source.startsWith("open_");
    const age = (Date.now() - cached.updatedAt.getTime()) / 86400000;
    if (!fromDb || age < OFF_REFRESH_DAYS) {
      // Same score as last time; refresh only the boycott part from cache.
      const boycott = await quickBoycott(cached.data.input);
      const result = { ...cached.data.result, boycott, showAlternatives: cached.data.result.health.score < 50 || !["clear", "checking"].includes(boycott.status) };
      await record_(result);
      return { status: "found", result };
    }
  }

  const input = await lookupBarcode(barcode).catch(() => null);
  if (!input) return { status: "not_found", barcode, draftId: await saveDraft({ barcode, key: `bc:${barcode}` }) };
  const missing = missingData(input);
  if (missing.length) {
    const draftId = await saveDraft({ barcode: input.barcode, key: input.key, input, missing });
    return { status: "needs_label", draftId, missing, preview: preview(input) };
  }
  return { status: "found", result: await finalize(input) };
}

export interface LabelRequest {
  draftId?: string;
  barcode?: string;
  ingredientsImage?: string;
  nutritionImage?: string;
  skipNutrition?: boolean;
  /** Finish with whatever data we have (partial score). */
  useAvailable?: boolean;
}

export async function labelFlow(req: LabelRequest): Promise<ScanResponse> {
  const barcode = req.barcode ? normalizeBarcode(req.barcode) ?? undefined : undefined;
  let draftId = req.draftId;
  const draft: Draft = draftId ? await loadDraft(draftId) : { barcode, key: barcode ? `bc:${barcode}` : `label:${randomUUID()}` };
  draftId ??= await saveDraft(draft);

  if (req.useAvailable) {
    if (!draft.input) throw new HttpError(400, "Nothing to score yet. Photograph the ingredient list.");
    return { status: "found", result: await finalize(draft.input) };
  }

  let input = draft.input;
  let flags = draft.flags;

  if (req.ingredientsImage) {
    const images = [parseImage(req.ingredientsImage), ...(req.nutritionImage ? [parseImage(req.nutritionImage)] : [])];
    const read = await readLabel(images);
    if (!read.readable || !read.ingredients?.length) {
      return { status: "unreadable", draftId, problem: read.problem || "Couldn't read that. Try closer, with more light." };
    }
    const base: Partial<ProductInput> & { key: string } = draft.input
      ? { ...draft.input, nutrition: draft.input.nutrition }
      : { key: draft.key, barcode: draft.barcode, source: "label_photo" };
    if (draft.input) base.sourceNote = "Database entry completed with your label photo";
    input = labelToInput(read, base);
    if (draft.input) input.source = draft.input.source;
    flags = { category: read.category, organic: read.organic, nutrition: read.nutrition, isBeverage: read.isBeverage, isWater: read.isWater, isCheese: read.isCheese, isFatOilNutsSeeds: read.isFatOilNutsSeeds, isRedMeat: read.isRedMeat, hasNonNutritiveSweeteners: read.hasNonNutritiveSweeteners, fruitVegLegumePercent: read.fruitVegLegumePercent, productName: read.productName, brand: read.brand, brandOwner: read.brandOwner };
  } else if (req.nutritionImage) {
    if (!input || !flags) throw new HttpError(400, "Photograph the ingredient list first.");
    const n = await readNutrition(parseImage(req.nutritionImage));
    if (!n) return { status: "unreadable", draftId, problem: "Couldn't read the nutrition facts. Try closer, with more light." };
    input = { ...input, nutrition: toPer100(n, flags) };
  } else if (!req.skipNutrition) {
    throw new HttpError(400, "Send ingredientsImage, nutritionImage, skipNutrition or useAvailable.");
  }

  if (!input) throw new HttpError(400, "Photograph the ingredient list first.");
  if (FOOD_METHOD.includes(input.category) && !input.nutrition && !input.nutriScore && !req.skipNutrition) {
    await saveDraft({ ...draft, input, flags }, draftId);
    return { status: "needs_nutrition", draftId, preview: preview(input) };
  }
  return { status: "found", result: await finalize(input) };
}

export async function webFlow(req: { draftId?: string; barcode?: string }): Promise<ScanResponse | { status: "not_found_web" }> {
  const draft = req.draftId ? await loadDraft(req.draftId) : undefined;
  const barcode = draft?.barcode ?? (req.barcode ? normalizeBarcode(req.barcode) : null);
  if (!barcode) throw new HttpError(400, "Web search needs a barcode.");
  const hit = await webLookup(barcode, { name: draft?.input?.name, brand: draft?.input?.brand });
  if (!hit) return { status: "not_found_web" };
  const base: Partial<ProductInput> & { key: string } = {
    ...(draft?.input ?? {}),
    key: `bc:${barcode}`,
    barcode,
    source: "web",
    sourceUrl: hit.sourceUrl,
    sourceNote: "Found on the web. The recipe may have changed since.",
  };
  const input = labelToInput(hit.read, base);
  input.source = "web";
  return { status: "found", result: await finalize(input) };
}

/** Runs the AI company check for a scanned product and saves the result. */
export async function companyCheck(key: string, force = false): Promise<BoycottResult> {
  const stored = await getStored(key);
  if (!stored) throw new HttpError(404, "Product not found. Scan it first.");
  const boycott = await fullBoycott(stored.input, force);
  const result: ScanResult = {
    ...stored.result,
    boycott,
    showAlternatives: stored.result.health.score < 50 || !["clear", "checking"].includes(boycott.status),
  };
  await kvPut("product", key, { input: stored.input, result });
  await updateHistoryBoycott(key, boycott.status).catch(() => {});
  return boycott;
}
