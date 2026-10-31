import type { Band, BoycottStatus, Category, RiskLevel, ScanResult, Source } from "../types";

/** The wordmark in the Stitch design. Change here to rename the app everywhere. */
export const APP_NAME = "synq";

export const BAND: Record<Band, { label: string; text: string; border: string; chip: string; dot: string }> = {
  excellent: { label: "Excellent", text: "text-emerald-400", border: "border-emerald-400", chip: "bg-emerald-400/15 text-emerald-300 border-emerald-400/25", dot: "bg-emerald-400" },
  good: { label: "Good", text: "text-emerald-300", border: "border-emerald-300", chip: "bg-emerald-400/10 text-emerald-200 border-emerald-300/25", dot: "bg-emerald-300" },
  poor: { label: "Poor", text: "text-amber-300", border: "border-amber-400", chip: "bg-amber-400/15 text-amber-200 border-amber-400/30", dot: "bg-amber-400" },
  bad: { label: "Bad", text: "text-flag-crimson", border: "border-flag-crimson", chip: "bg-rose-500/20 text-rose-200 border-rose-500/30", dot: "bg-rose-400" },
};

export const FLAGGED: BoycottStatus[] = ["bds_priority", "bds_pressure", "bds_organic", "connected", "broad"];

export function boycottTone(s: BoycottStatus): { text: string; dot: string } {
  if (FLAGGED.includes(s)) return { text: "text-flag-crimson", dot: "bg-flag-crimson" };
  if (s === "ai_found") return { text: "text-amber-300", dot: "bg-amber-400" };
  if (s === "clear") return { text: "text-emerald-400", dot: "bg-emerald-400" };
  return { text: "text-brand-lavender", dot: "bg-brand-lavender" };
}

export const RISK: Record<RiskLevel, { label: string; text: string; border: string }> = {
  3: { label: "High risk", text: "text-flag-crimson", border: "border-flag-crimson" },
  2: { label: "Moderate", text: "text-amber-300", border: "border-amber-400" },
  1: { label: "Limited", text: "text-yellow-200", border: "border-yellow-300" },
  0: { label: "Risk-free", text: "text-brand-lavender", border: "border-brand-lavender" },
};

export const SOURCE_LABEL: Record<Source, string> = {
  open_food_facts: "Open Food Facts",
  open_beauty_facts: "Open Beauty Facts",
  open_pet_food_facts: "Open Pet Food Facts",
  open_products_facts: "Open Products Facts",
  label_photo: "Your label photo",
  web: "Found on the web",
};

const CATEGORY_LABEL: Record<Category, string> = {
  food: "Food",
  beverage: "Drink",
  cosmetics: "Personal care",
  household: "Household",
  supplement: "Supplement",
  pet: "Pet",
  baby: "Baby",
  other: "Other",
};

/** Most specific readable category, e.g. "Colas". */
export function categoryLabel(r: Pick<ScanResult, "category" | "categoryTags">): string {
  const tag = [...(r.categoryTags ?? [])]
    .reverse()
    .find((t) => /^en:[a-z0-9-]+$/.test(t) && !/sweetened|artificially|-with-|-without-|organic/.test(t));
  if (!tag) return CATEGORY_LABEL[r.category] ?? "Product";
  const s = tag.replace(/^en:/, "").replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function categoryName(c: Category): string {
  return CATEGORY_LABEL[c] ?? "Product";
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
