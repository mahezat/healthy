// Live checks against Open Food Facts. Run with: LIVE=1 npx vitest run tests/live.test.ts
import { describe, expect, it } from "vitest";
import { lookupBarcode, searchCategory } from "../lib/off";
import { computeNutriScore } from "../lib/scoring/nutriscore";

describe.skipIf(!process.env.LIVE)("Open Food Facts (live)", () => {
  it("finds a food, a beauty product and maps categories", async () => {
    const coke = await lookupBarcode("049000000443");
    expect(coke?.category).toBe("beverage");
    expect(coke?.nutriScore?.points).toBe(12);
    const shampoo = await lookupBarcode("012044045947");
    expect(shampoo?.source).toBe("open_beauty_facts");
    expect(shampoo?.category).toBe("cosmetics");
  }, 30000);

  it("our Nutri-Score matches Open Food Facts on real products", async () => {
    const cats = ["en:breakfast-cereals", "en:yogurts", "en:chips", "en:sodas", "en:breads", "en:cheeses", "en:fruit-juices", "en:cookies"];
    let total = 0;
    let same = 0;
    const misses: string[] = [];
    for (const c of cats) {
      const hits = await searchCategory("food", c, 25);
      for (const h of hits) {
        const p = await import("../lib/off").then((m) => m.searchHitToInput(h, "food"));
        if (!p.nutriScore || !p.nutrition || p.nutriScore.points === null) continue;
        const ours = computeNutriScore(p.nutrition);
        total++;
        if (ours.grade === p.nutriScore.grade) same++;
        else misses.push(`${h.code} ${c} off=${p.nutriScore.grade}/${p.nutriScore.points} ours=${ours.grade}/${ours.points}`);
      }
    }
    console.log(`Nutri-Score grade agreement: ${same}/${total}`);
    console.log(misses.slice(0, 15).join("\n"));
    expect(total).toBeGreaterThan(20);
    expect(same / total).toBeGreaterThan(0.85);
  }, 120000);
});
