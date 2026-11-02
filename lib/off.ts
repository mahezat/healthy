// Open Food Facts family: food, beauty, pet food and other products.
// One lookup on world.openfoodfacts.org with product_type=all redirects to the right database.

import { config } from "./config";
import type { Category, NutritionComponent, NutritionInput, ProductInput, Source } from "./types";

const FIELDS = [
  "code", "product_name", "product_name_en", "generic_name", "brands", "brand_owner", "product_type",
  "categories_tags", "image_front_url", "image_url", "ingredients_text", "ingredients_text_en",
  "additives_tags", "labels_tags", "countries_tags", "nutriscore_score", "nutriscore_grade",
  "nutriscore_version", "nutriscore_data", "nutriments", "url",
].join(",");

const SOURCE_BY_TYPE: Record<string, Source> = {
  food: "open_food_facts",
  beauty: "open_beauty_facts",
  petfood: "open_pet_food_facts",
  product: "open_products_facts",
};

const HOST_BY_TYPE: Record<string, string> = {
  food: "world.openfoodfacts.org",
  beauty: "world.openbeautyfacts.org",
  petfood: "world.openpetfoodfacts.org",
  product: "world.openproductsfacts.org",
};

export function normalizeBarcode(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 8 || d.length > 14) return null;
  return d;
}

/** Barcode variants worth trying: UPC-A 12 digits is stored as 13 with a leading 0. */
function variants(code: string): string[] {
  const v = [code];
  if (code.length === 12) v.push(`0${code}`);
  if (code.length === 13 && code.startsWith("0")) v.push(code.slice(1));
  return v;
}

interface OffProduct {
  code: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  brand_owner?: string;
  product_type?: string;
  categories_tags?: string[];
  image_front_url?: string;
  image_url?: string;
  ingredients_text?: string;
  ingredients_text_en?: string;
  additives_tags?: string[];
  labels_tags?: string[];
  countries_tags?: string[];
  nutriscore_score?: number;
  nutriscore_grade?: string;
  nutriscore_version?: string;
  nutriscore_data?: {
    is_beverage?: number;
    is_water?: number;
    components?: { negative?: OffComponent[]; positive?: OffComponent[] };
  };
  nutriments?: Record<string, number | string>;
}

interface OffComponent {
  id: string;
  points: number;
  points_max: number;
  unit?: string;
  value?: number | null;
}

async function fetchProduct(code: string): Promise<{ product: OffProduct; type: string } | null> {
  const url = `https://world.openfoodfacts.org/api/v3/product/${code}?product_type=all&fields=${FIELDS}`;
  const res = await fetch(url, {
    headers: { "User-Agent": config.userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
    redirect: "follow",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
  const body = (await res.json()) as { product?: OffProduct; status?: string };
  if (!body.product || body.status === "failure") return null;
  const host = new URL(res.url).hostname;
  const type = body.product.product_type ?? Object.entries(HOST_BY_TYPE).find(([, h]) => host.includes(h.split(".")[1]))?.[0] ?? "food";
  return { product: body.product, type };
}

export async function lookupBarcode(barcode: string): Promise<ProductInput | null> {
  for (const code of variants(barcode)) {
    const hit = await fetchProduct(code);
    if (hit && (hit.product.product_name || hit.product.product_name_en || hit.product.brands)) return toInput(hit.product, hit.type);
  }
  return null;
}

const tagHas = (tags: string[], ...needles: string[]) => tags.some((t) => needles.some((n) => t === n || t.startsWith(n)));

export function categoryFor(type: string, tags: string[]): Category {
  if (type === "beauty") return "cosmetics";
  if (type === "petfood") return "pet";
  if (type === "product") {
    return tagHas(tags, "en:cleaning", "en:household", "en:detergents", "en:dishwashing", "en:laundry") ? "household" : "other";
  }
  if (tagHas(tags, "en:dietary-supplements", "en:food-supplements", "en:vitamins", "en:protein-powders")) return "supplement";
  if (tagHas(tags, "en:baby-foods", "en:baby-milks", "en:infant-formulas", "en:baby-food")) return "baby";
  if (tagHas(tags, "en:beverages") && !tagHas(tags, "en:beverages-preparations")) return "beverage";
  return "food";
}

export function isOrganic(labels: string[]): boolean {
  return labels.some((l) => /^en:(organic|usda-organic|eu-organic|ab-agriculture-biologique|canada-organic|bio)$/.test(l) || /^en:organic-/.test(l));
}

const COMPONENT_LABEL: Record<string, string> = {
  energy: "Calories",
  energy_from_saturated_fat: "Calories from saturated fat",
  sugars: "Sugar",
  saturated_fat: "Saturated fat",
  saturated_fat_ratio: "Saturated fat share",
  salt: "Salt",
  non_nutritive_sweeteners: "Sweeteners",
  proteins: "Protein",
  fiber: "Fiber",
  fruits_vegetables_legumes: "Fruit, vegetables, legumes",
};

function toComponents(d: OffProduct["nutriscore_data"]): NutritionComponent[] | undefined {
  const c = d?.components;
  if (!c) return undefined;
  const map = (x: OffComponent, kind: "negative" | "positive"): NutritionComponent => ({
    id: x.id,
    label: COMPONENT_LABEL[x.id] ?? x.id,
    value: x.value ?? null,
    unit: x.unit ?? "g",
    points: x.points,
    pointsMax: x.points_max,
    kind,
  });
  return [...(c.negative ?? []).map((x) => map(x, "negative")), ...(c.positive ?? []).map((x) => map(x, "positive"))];
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : undefined;
}

export function toInput(p: OffProduct, type: string): ProductInput {
  const tags = p.categories_tags ?? [];
  const category = categoryFor(type, tags);
  const source = SOURCE_BY_TYPE[type] ?? "open_food_facts";
  const n = p.nutriments ?? {};
  const isBeverage = category === "beverage";
  const hasNutrition = ["energy-kj_100g", "energy_100g", "sugars_100g", "salt_100g"].some((k) => num(n[k]) !== undefined);
  const nutrition: NutritionInput | undefined = hasNutrition
    ? {
        energyKj: num(n["energy-kj_100g"]) ?? num(n["energy_100g"]),
        sugars: num(n["sugars_100g"]),
        saturatedFat: num(n["saturated-fat_100g"]),
        fat: num(n["fat_100g"]),
        salt: num(n["salt_100g"]) ?? (num(n["sodium_100g"]) !== undefined ? num(n["sodium_100g"])! * 2.5 : undefined),
        fiber: num(n["fiber_100g"]),
        proteins: num(n["proteins_100g"]),
        fruitsVegLegumesPercent: num(n["fruits-vegetables-legumes-estimate-from-ingredients_100g"]) ?? num(n["fruits-vegetables-nuts-estimate-from-ingredients_100g"]),
        isBeverage,
        isWater:
          p.nutriscore_data?.is_water !== undefined
            ? !!p.nutriscore_data.is_water
            : tags.includes("en:waters") && !tagHas(tags, "en:flavored-waters", "en:flavoured-waters", "en:sodas", "en:sweetened-beverages", "en:artificially-sweetened-beverages"),
        isCheese: tagHas(tags, "en:cheeses"),
        isFatOilNutsSeeds: tagHas(tags, "en:fats", "en:vegetable-oils", "en:nuts", "en:seeds"),
        isRedMeat: tagHas(tags, "en:beef", "en:pork", "en:lamb", "en:veal"),
      }
    : undefined;

  const grade = p.nutriscore_grade && /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade : null;
  const brand = p.brands?.split(",")[0]?.trim() || undefined;
  return {
    key: `bc:${p.code}`,
    barcode: p.code,
    name: p.product_name_en || p.product_name || p.generic_name || brand || p.code,
    brand,
    brandOwner: p.brand_owner || undefined,
    category,
    categoryTags: tags,
    imageUrl: p.image_front_url || p.image_url || undefined,
    source,
    sourceUrl: `https://${HOST_BY_TYPE[type] ?? HOST_BY_TYPE.food}/product/${p.code}`,
    ingredientsText: p.ingredients_text_en || p.ingredients_text || undefined,
    additiveCodes: (p.additives_tags ?? []).map((t) => t.replace(/^en:/, "")),
    organic: isOrganic(p.labels_tags ?? []),
    nutriScore:
      grade && p.nutriscore_score !== undefined
        ? { grade, points: p.nutriscore_score, isBeverage: !!p.nutriscore_data?.is_beverage || isBeverage, components: toComponents(p.nutriscore_data) }
        : undefined,
    nutrition,
    countries: p.countries_tags ?? [],
  };
}

export interface SearchHit {
  code: string;
  product_name?: string;
  brands?: string;
  brand_owner?: string;
  image_front_url?: string;
  nutriscore_score?: number;
  nutriscore_grade?: string;
  additives_tags?: string[];
  labels_tags?: string[];
  ingredients_text?: string;
  categories_tags?: string[];
  countries_tags?: string[];
  nutriscore_data?: OffProduct["nutriscore_data"];
  nutriments?: OffProduct["nutriments"];
}

/** Products in one category, sold in the configured country. */
export async function searchCategory(type: string, categoryTag: string, pageSize = 60): Promise<SearchHit[]> {
  const host = HOST_BY_TYPE[type] ?? HOST_BY_TYPE.food;
  const fields = "code,product_name,brands,brand_owner,image_front_url,nutriscore_score,nutriscore_grade,nutriscore_data,nutriments,additives_tags,labels_tags,ingredients_text,categories_tags,countries_tags";
  const sort = type === "food" ? "&sort_by=nutriscore_score" : "&sort_by=popularity_key";
  const url = `https://${host}/api/v2/search?categories_tags=${encodeURIComponent(categoryTag)}&countries_tags=${encodeURIComponent(config.altCountry)}&page_size=${pageSize}${sort}&fields=${fields}`;
  // Open Food Facts limits search to about 10 requests a minute and answers 503 when busy: retry once.
  let res = await fetch(url, { headers: { "User-Agent": config.userAgent }, signal: AbortSignal.timeout(12000) });
  if (res.status === 503 || res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await fetch(url, { headers: { "User-Agent": config.userAgent }, signal: AbortSignal.timeout(12000) });
  }
  if (!res.ok) throw new Error(`Open Food Facts search returned ${res.status}`);
  const body = (await res.json()) as { products?: SearchHit[] };
  return (body.products ?? []).filter((p) => (p.categories_tags ?? []).includes(categoryTag));
}

export function typeForSource(source: Source): string {
  return Object.entries(SOURCE_BY_TYPE).find(([, s]) => s === source)?.[0] ?? "food";
}

export function searchHitToInput(h: SearchHit, type: string): ProductInput {
  return toInput(h as OffProduct, type);
}
