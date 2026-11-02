// Shared types for the Healthy engine. The UI only needs ScanResult,
// BoycottResult, Alternative and HistoryItem.

export type Category =
  | "food"
  | "beverage"
  | "cosmetics"
  | "household"
  | "supplement"
  | "pet"
  | "baby"
  | "other";

/** 0 = risk-free, 1 = limited/low, 2 = moderate, 3 = high */
export type RiskLevel = 0 | 1 | 2 | 3;

export type Band = "excellent" | "good" | "poor" | "bad";

export type Source =
  | "open_food_facts"
  | "open_beauty_facts"
  | "open_pet_food_facts"
  | "open_products_facts"
  | "label_photo"
  | "web";

export interface Ref {
  /** Who says it: EFSA, IARC, EU, FDA, CIR, EWG, ... */
  org: string;
  /** What they say, in a few words. */
  note: string;
  url?: string;
}

export interface RatedIngredient {
  name: string;
  /** E-number for food additives, e.g. "e211". */
  code?: string;
  level: RiskLevel;
  concern: string;
  refs: Ref[];
  /** True when the rating came from the AI instead of the curated list. */
  aiRated?: boolean;
  /** True when nothing is known about it (counted as risk-free). */
  unknown?: boolean;
}

export interface NutritionComponent {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  points: number;
  pointsMax: number;
  kind: "negative" | "positive";
}

export interface FoodDetails {
  nutriScore: {
    grade: "a" | "b" | "c" | "d" | "e" | null;
    points: number | null;
    /** "open_food_facts" if taken from the database, "computed" if we calculated it. */
    origin: "open_food_facts" | "computed" | "missing";
    isBeverage: boolean;
  };
  nutrition: NutritionComponent[];
  additives: RatedIngredient[];
  organic: boolean;
  subScores: { nutrition: number | null; additives: number; organic: number };
}

export interface HealthResult {
  score: number;
  band: Band;
  /** True if the nutrition facts were missing, so only part of the method was used. */
  partial: boolean;
  method: "food" | "ingredients";
  /** Plain-language notes about caps that were applied. */
  notes: string[];
  food?: FoodDetails;
  ingredients?: RatedIngredient[];
}

export type BoycottTier =
  | "bds_priority"
  | "bds_pressure"
  | "bds_organic"
  | "connected"
  | "broad";

export type BoycottStatus = BoycottTier | "clear" | "ai_found" | "checking";

export interface BoycottListing {
  entity: string;
  tier: BoycottTier;
  /** Database or list name: BDS, Who Profits, UN OHCHR database, AFSC Investigate, Ethical Consumer. */
  list: string;
  says: string;
  url?: string;
  /** How the product connects to this entity, e.g. "Brand owner". */
  via?: string;
}

export interface OwnershipStep {
  name: string;
  relation: "brand" | "owner" | "parent";
  source: "open_food_facts" | "curated" | "wikidata" | "ai" | "label";
}

export interface AiFinding {
  /** investor, ceo, partnership, contract, donation, subsidiary, other */
  kind: string;
  claim: string;
  suggestedTier: "connected" | "broad";
  sources: { url: string; title?: string }[];
}

export interface BoycottResult {
  status: BoycottStatus;
  headline: string;
  reason: string;
  listings: BoycottListing[];
  chain: OwnershipStep[];
  aiFindings: AiFinding[];
  /** "pending" means the AI deep check has not run yet; call /api/company. */
  deepCheck: "pending" | "done" | "skipped" | "failed";
  checkedAt: string;
}

export interface ScanResult {
  key: string;
  barcode?: string;
  name: string;
  brand?: string;
  category: Category;
  categoryTags: string[];
  imageUrl?: string;
  source: Source;
  sourceUrl?: string;
  sourceNote?: string;
  health: HealthResult;
  boycott: BoycottResult;
  /** True when the UI should show alternatives (score under 50 or any boycott flag). */
  showAlternatives: boolean;
  updatedAt: string;
}

export interface Alternative {
  key: string;
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  score: number;
  band: Band;
  boycott: "clear";
}

export interface HistoryItem {
  id: number;
  key: string;
  name: string;
  brand?: string;
  category: Category;
  imageUrl?: string;
  score: number;
  band: Band;
  boycottStatus: BoycottStatus;
  scannedAt: string;
}

/** Raw product data before scoring. */
export interface ProductInput {
  key: string;
  barcode?: string;
  name: string;
  brand?: string;
  brandOwner?: string;
  category: Category;
  categoryTags: string[];
  imageUrl?: string;
  source: Source;
  sourceUrl?: string;
  sourceNote?: string;
  ingredientsText?: string;
  /** Ingredient names when already split (label photo, web). */
  ingredientList?: string[];
  /** Additive codes like "e211". */
  additiveCodes: string[];
  organic: boolean;
  nutriScore?: { grade: string | null; points: number | null; isBeverage: boolean; components?: NutritionComponent[] };
  nutrition?: NutritionInput;
  countries: string[];
}

export interface NutritionInput {
  /** All values per 100 g or 100 ml. */
  energyKj?: number;
  sugars?: number;
  saturatedFat?: number;
  salt?: number;
  fiber?: number;
  proteins?: number;
  fruitsVegLegumesPercent?: number;
  isBeverage: boolean;
  isWater?: boolean;
  isCheese?: boolean;
  isFatOilNutsSeeds?: boolean;
  isRedMeat?: boolean;
  nonNutritiveSweeteners?: boolean;
  /** Needed for the fats/oils algorithm. */
  fat?: number;
}
