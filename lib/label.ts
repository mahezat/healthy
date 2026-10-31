// Reading label photos and finding unknown products on the web, with Gemini.

import { geminiJson, type ImageInput } from "./gemini";
import { urlExists } from "./http";
import { splitIngredients } from "./ingredients";
import type { Category, NutritionInput, ProductInput } from "./types";

const CATEGORY_ENUM = ["food", "beverage", "cosmetics", "household", "supplement", "pet", "baby_food", "baby_care", "other"];

const NUTRITION_SCHEMA = {
  type: ["object", "null"],
  properties: {
    basis: { type: "string", enum: ["per_100", "per_serving"] },
    servingSize: { type: ["number", "null"], description: "Serving size in g or ml, only if basis is per_serving" },
    servingUnit: { type: ["string", "null"], description: "g or ml" },
    energyKcal: { type: ["number", "null"] },
    energyKj: { type: ["number", "null"] },
    fat: { type: ["number", "null"] },
    saturatedFat: { type: ["number", "null"] },
    sugars: { type: ["number", "null"], description: "Total sugars in g" },
    sodiumMg: { type: ["number", "null"] },
    salt: { type: ["number", "null"], description: "Salt in g, only if printed" },
    fiber: { type: ["number", "null"] },
    proteins: { type: ["number", "null"] },
  },
  required: ["basis"],
};

const PRODUCT_SCHEMA = {
  type: "object",
  properties: {
    readable: { type: "boolean", description: "False if the ingredient list cannot be read reliably" },
    problem: { type: ["string", "null"], description: "Why it is not readable, in a few words" },
    productName: { type: ["string", "null"] },
    brand: { type: ["string", "null"] },
    brandOwner: { type: ["string", "null"], description: "Company printed as maker or distributor, if visible" },
    category: { type: "string", enum: CATEGORY_ENUM },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, eNumber: { type: ["string", "null"], description: "E-number if this is a food additive, e.g. E211" } },
        required: ["name"],
      },
    },
    organic: { type: "boolean", description: "True only if an official organic seal or 'certified organic' is visible" },
    nutrition: NUTRITION_SCHEMA,
    isBeverage: { type: "boolean" },
    isWater: { type: "boolean", description: "Plain water with nothing added" },
    isCheese: { type: "boolean" },
    isFatOilNutsSeeds: { type: "boolean", description: "Oils, butter, nuts, seeds, nut butters" },
    isRedMeat: { type: "boolean" },
    hasNonNutritiveSweeteners: { type: "boolean", description: "Contains sweeteners like sucralose, aspartame, stevia, acesulfame" },
    fruitVegLegumePercent: { type: ["number", "null"], description: "Estimated % of fruit, vegetables and legumes by weight, from the ingredient order and any printed percentages" },
  },
  required: ["readable", "category", "ingredients", "organic", "isBeverage"],
};

export interface LabelRead {
  readable: boolean;
  problem?: string | null;
  productName?: string | null;
  brand?: string | null;
  brandOwner?: string | null;
  category: string;
  ingredients: { name: string; eNumber?: string | null }[];
  organic: boolean;
  nutrition?: {
    basis: "per_100" | "per_serving";
    servingSize?: number | null;
    servingUnit?: string | null;
    energyKcal?: number | null;
    energyKj?: number | null;
    fat?: number | null;
    saturatedFat?: number | null;
    sugars?: number | null;
    sodiumMg?: number | null;
    salt?: number | null;
    fiber?: number | null;
    proteins?: number | null;
  } | null;
  isBeverage: boolean;
  isWater?: boolean;
  isCheese?: boolean;
  isFatOilNutsSeeds?: boolean;
  isRedMeat?: boolean;
  hasNonNutritiveSweeteners?: boolean;
  fruitVegLegumePercent?: number | null;
}

const READ_RULES =
  "Copy every ingredient exactly as printed, in order, one per item, keeping sub-ingredients as separate items. Do not add, guess or translate ingredients. " +
  "If a word is cut off or blurry, set readable to false rather than guessing. " +
  "Copy nutrition numbers exactly as printed with the basis printed on the label (per 100 g/ml, or per serving with the serving size in g or ml). Use null for anything not printed.";

export async function readLabel(images: ImageInput[]): Promise<LabelRead> {
  const { data } = await geminiJson<LabelRead>({
    images,
    system: "You read product labels for a health-rating app. You are precise and never invent text.",
    prompt: `These photos show a product's ingredient list${images.length > 1 ? " and/or nutrition facts" : ""}. ${READ_RULES}`,
    schema: PRODUCT_SCHEMA,
    timeoutMs: 40000,
  });
  return data;
}

export async function readNutrition(image: ImageInput): Promise<LabelRead["nutrition"]> {
  const { data } = await geminiJson<{ readable: boolean; nutrition: LabelRead["nutrition"] }>({
    images: [image],
    system: "You read nutrition facts panels precisely and never invent numbers.",
    prompt: `Read this nutrition facts panel. ${READ_RULES} If you cannot read it reliably, set readable to false.`,
    schema: { type: "object", properties: { readable: { type: "boolean" }, nutrition: NUTRITION_SCHEMA }, required: ["readable"] },
  });
  return data.readable ? data.nutrition : null;
}

export function mapCategory(c: string): Category {
  if (c === "baby_food") return "baby";
  if (c === "baby_care") return "cosmetics";
  return (["food", "beverage", "cosmetics", "household", "supplement", "pet", "other"].includes(c) ? c : "other") as Category;
}

/** Converts label numbers to the per-100 g/ml values Nutri-Score needs. Returns undefined if unusable. */
export function toPer100(n: LabelRead["nutrition"], flags: Pick<LabelRead, "isBeverage" | "isWater" | "isCheese" | "isFatOilNutsSeeds" | "isRedMeat" | "hasNonNutritiveSweeteners" | "fruitVegLegumePercent">): NutritionInput | undefined {
  if (!n) return undefined;
  let f = 1;
  if (n.basis === "per_serving") {
    if (!n.servingSize || n.servingSize <= 0) return undefined;
    f = 100 / n.servingSize;
  }
  const v = (x?: number | null) => (x === null || x === undefined ? undefined : x * f);
  const kj = v(n.energyKj) ?? (n.energyKcal !== null && n.energyKcal !== undefined ? n.energyKcal * 4.184 * f : undefined);
  const salt = v(n.salt) ?? (n.sodiumMg !== null && n.sodiumMg !== undefined ? (n.sodiumMg / 1000) * 2.5 * f : undefined);
  if (kj === undefined && n.sugars == null) return undefined;
  return {
    energyKj: kj,
    sugars: v(n.sugars),
    saturatedFat: v(n.saturatedFat),
    fat: v(n.fat),
    salt,
    fiber: v(n.fiber),
    proteins: v(n.proteins),
    fruitsVegLegumesPercent: flags.fruitVegLegumePercent ?? undefined,
    isBeverage: flags.isBeverage,
    isWater: flags.isWater,
    isCheese: flags.isCheese,
    isFatOilNutsSeeds: flags.isFatOilNutsSeeds,
    isRedMeat: flags.isRedMeat,
    nonNutritiveSweeteners: flags.hasNonNutritiveSweeteners,
  };
}

export function labelToInput(read: LabelRead, base: Partial<ProductInput> & { key: string }): ProductInput {
  const category = base.category && base.category !== "other" ? base.category : mapCategory(read.category);
  const names = read.ingredients.map((i) => (i.eNumber ? `${i.name} (${i.eNumber})` : i.name));
  return {
    key: base.key,
    barcode: base.barcode,
    name: base.name || read.productName || "Unnamed product",
    brand: base.brand || read.brand || undefined,
    brandOwner: base.brandOwner || read.brandOwner || undefined,
    category,
    categoryTags: base.categoryTags ?? [],
    imageUrl: base.imageUrl,
    source: base.source ?? "label_photo",
    sourceUrl: base.sourceUrl,
    sourceNote: base.sourceNote ?? "Read from your label photo",
    ingredientsText: names.join(", "),
    ingredientList: names.flatMap((n) => splitIngredients(n)),
    additiveCodes: [...new Set([...(base.additiveCodes ?? []), ...read.ingredients.map((i) => i.eNumber?.toLowerCase().replace(/\s/g, "")).filter((x): x is string => !!x)])],
    organic: base.organic || read.organic,
    nutriScore: base.nutriScore,
    nutrition: base.nutrition ?? toPer100(read.nutrition, read),
    countries: base.countries ?? [],
  };
}

// ---------- Web fallback ----------

interface WebRead extends LabelRead {
  found: boolean;
  sourceUrls: string[];
}

export async function webLookup(barcode: string, hint?: { name?: string; brand?: string }): Promise<{ read: WebRead; sourceUrl: string } | null> {
  const { data, citations } = await geminiJson<WebRead>({
    search: true,
    system: "You find product information on the web for a health-rating app. You never invent ingredients or numbers.",
    prompt:
      `Find the consumer product with barcode (UPC/EAN) ${barcode}${hint?.name ? `, probably "${hint.name}"` : ""}${hint?.brand ? ` by ${hint.brand}` : ""}. ` +
      "Only set found to true if a web page clearly matches this barcode or this exact product, and it lists the full ingredient list. Prefer the manufacturer's site or a major retailer. " +
      `Return the ingredient list exactly as published, the nutrition facts if published, and the URLs of the pages you used in sourceUrls. ${READ_RULES} Set readable to true if the ingredient list is complete.`,
    schema: {
      ...PRODUCT_SCHEMA,
      properties: { ...PRODUCT_SCHEMA.properties, found: { type: "boolean" }, sourceUrls: { type: "array", items: { type: "string" } } },
      required: ["found", "readable", "category", "ingredients", "organic", "isBeverage", "sourceUrls"],
    },
    timeoutMs: 60000,
  });
  if (!data.found || !data.readable || !data.ingredients?.length) return null;
  const candidates = [...(data.sourceUrls ?? []), ...citations.map((c) => c.url)];
  for (const url of candidates) {
    if (await urlExists(url)) return { read: data, sourceUrl: url };
  }
  return null;
}
