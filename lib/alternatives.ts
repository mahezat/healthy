// Better alternatives: same category, sold in the US, higher health score, and clear on every boycott level
// (curated lists AND the AI company check).

import { curatedListings, deepCheck, researchTarget } from "./boycott";
import { config } from "./config";
import { normCompany } from "./data/boycott";
import { kvGet, kvPut } from "./db";
import { searchCategory, searchHitToInput } from "./off";
import { ownershipChain } from "./ownership";
import { getStored } from "./scan";
import { scoreProduct } from "./score";
import type { Alternative, Category, ScanResult } from "./types";

const TYPE_BY_CATEGORY: Record<Category, string> = {
  food: "food", beverage: "food", baby: "food", supplement: "food",
  cosmetics: "beauty", pet: "petfood", household: "product", other: "product",
};

export async function alternativesFor(key: string): Promise<{ items: Alternative[]; note?: string }> {
  const cached = await kvGet<{ items: Alternative[]; note?: string }>("alts", key);
  if (cached && Date.now() - cached.updatedAt.getTime() < 7 * 86400000) return cached.data;

  const stored = await getStored(key);
  if (!stored) return { items: [], note: "Scan the product first." };
  const { input, result } = stored;
  // Category tags that describe what the product IS (colas), not a property (sweetened-beverages).
  const tags = input.categoryTags.filter((t) => /^en:[a-z0-9-]+$/.test(t) && !ATTRIBUTE_TAG.test(t));
  if (!tags.length) return { items: [], note: "This product has no category in the database, so there is nothing to compare it with." };

  const type = TYPE_BY_CATEGORY[input.category];
  const minScore = minimumScore(result);
  const picked: Alternative[] = [];
  const seenBrands = new Set<string>(input.brand ? [normCompany(input.brand)] : []);
  let searchFailed = false;

  // Most specific category first, then broaden.
  for (const tag of [...tags].reverse().slice(0, 2)) {
    let hits: Awaited<ReturnType<typeof searchCategory>>;
    try {
      hits = await searchCategory(type, tag);
    } catch {
      searchFailed = true;
      continue;
    }
    const scored: (Alternative & { brandKey: string; owner?: string; input: typeof input })[] = [];
    for (const h of hits) {
      if (!h.code || h.code === input.barcode || !h.product_name) continue;
      const p = searchHitToInput(h, type);
      const brandKey = normCompany(p.brand ?? "");
      if (!brandKey || seenBrands.has(brandKey)) continue;
      if (!p.ingredientsText && !p.additiveCodes.length && type !== "food") continue;
      const health = await scoreProduct(p, { ai: false });
      if (health.score < minScore || health.partial) continue;
      const chain = await ownershipChain(p, { network: false });
      if (curatedListings(p.barcode, chain).length) continue;
      scored.push({ key: p.key, barcode: p.barcode!, name: p.name, brand: p.brand, imageUrl: p.imageUrl, score: health.score, band: health.band, boycott: "clear", brandKey, owner: researchTarget(chain), input: p });
    }
    scored.sort((a, b) => b.score - a.score);

    // One candidate per brand, best first; check up to 10 companies at once with the AI.
    const distinct: typeof scored = [];
    for (const c of scored) if (!seenBrands.has(c.brandKey) && !distinct.some((d) => d.brandKey === c.brandKey)) distinct.push(c);
    let shortlist = distinct.slice(0, 10);
    // Non-food: unknown ingredients were counted as risk-free above, so rate them properly now (cached per ingredient).
    if (type !== "food") {
      const rescored = await Promise.all(shortlist.map((c) => scoreProduct(c.input, { ai: true })));
      shortlist = shortlist
        .map((c, i) => ({ ...c, score: rescored[i].score, band: rescored[i].band }))
        .filter((c) => c.score >= minScore)
        .sort((a, b) => b.score - a.score);
    }
    const clear = await Promise.all(shortlist.map((c) => aiClear(c.owner ?? c.brand ?? "")));
    shortlist.forEach((c, i) => {
      if (!clear[i] || picked.length >= 5) return;
      seenBrands.add(c.brandKey);
      picked.push({ key: c.key, barcode: c.barcode, name: c.name, brand: c.brand, imageUrl: c.imageUrl, score: c.score, band: c.band, boycott: "clear" });
    });
    if (picked.length >= 5) break;
  }

  if (!picked.length && searchFailed) return { items: [], note: "The product database is busy. Try again in a minute." };
  const out = { items: picked, note: picked.length ? undefined : "No alternative passes both checks yet." };
  // Don't keep an incomplete answer for a week if a search failed.
  if (!searchFailed) await kvPut("alts", key, out).catch(() => {});
  return out;
}

const ATTRIBUTE_TAG = /sweetened|unsweetened|artificially|-with-|-without-|^en:with-|^en:without-|organic|^en:(foods|beverages|snacks|plant-based-foods|plant-based-foods-and-beverages|beverages-and-beverages-preparations|non-alcoholic-beverages|groceries|hair|body|face)$/;

function minimumScore(r: ScanResult): number {
  // A bad or poor product needs at least a "good" replacement; a healthy but boycotted one needs one at least as healthy.
  return r.health.score < 50 ? 50 : Math.max(50, r.health.score);
}

/** True when the AI company check found nothing. Unchecked companies are checked now (cached after). */
async function aiClear(company: string): Promise<boolean> {
  if (!company) return false;
  if (!config.geminiKey) return true;
  try {
    const r = await deepCheck(company);
    return r.findings.length === 0;
  } catch {
    return false;
  }
}
