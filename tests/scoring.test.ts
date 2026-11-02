import { describe, expect, it } from "vitest";
import { computeNutriScore } from "../lib/scoring/nutriscore";
import { additivesScore, bandFor, foodScore, ingredientScore, nutritionScoreFromPoints } from "../lib/scoring/yuka";
import { splitIngredients } from "../lib/ingredients";
import { findAdditive, normalizeCode } from "../lib/data/additives";
import { findIngredient } from "../lib/data/ingredients";
import type { RatedIngredient } from "../lib/types";

const r = (name: string, level: 0 | 1 | 2 | 3): RatedIngredient => ({ name, level, concern: "", refs: [] });

describe("Nutri-Score 2023", () => {
  it("matches Open Food Facts for Coca-Cola (beverage, score 12, grade E)", () => {
    const ns = computeNutriScore({ energyKj: 181.22, sugars: 10.66, saturatedFat: 0, salt: 0, proteins: 0, fiber: 0, isBeverage: true });
    expect(ns.points).toBe(12);
    expect(ns.grade).toBe("e");
  });
  it("water is A", () => {
    expect(computeNutriScore({ energyKj: 0, sugars: 0, saturatedFat: 0, salt: 0, isBeverage: true, isWater: true }).grade).toBe("a");
  });
  it("drops protein points when negative points are 11 or more", () => {
    const ns = computeNutriScore({ energyKj: 2000, sugars: 30, saturatedFat: 8, salt: 1, proteins: 20, fiber: 0, isBeverage: false });
    expect(ns.components.find((c) => c.id === "proteins")).toBeUndefined();
  });
  it("sweeteners add 4 points to beverages", () => {
    const a = computeNutriScore({ energyKj: 5, sugars: 0, saturatedFat: 0, salt: 0, isBeverage: true });
    const b = computeNutriScore({ energyKj: 5, sugars: 0, saturatedFat: 0, salt: 0, isBeverage: true, nonNutritiveSweeteners: true });
    expect(b.points - a.points).toBe(4);
  });
});

describe("Yuka table", () => {
  it("solid foods", () => {
    expect(nutritionScoreFromPoints(-10, false)).toBe(100);
    expect(nutritionScoreFromPoints(-1, false)).toBe(90);
    expect(nutritionScoreFromPoints(6, false)).toBe(50);
    expect(nutritionScoreFromPoints(11, false)).toBe(15);
    expect(nutritionScoreFromPoints(30, false)).toBe(0);
  });
  it("beverages", () => {
    expect(nutritionScoreFromPoints(-8, true)).toBe(80);
    expect(nutritionScoreFromPoints(2, true)).toBe(57);
    expect(nutritionScoreFromPoints(12, true)).toBe(0);
    expect(nutritionScoreFromPoints(5, true, true)).toBe(100);
  });
  it("bands", () => {
    expect([bandFor(100), bandFor(75), bandFor(74), bandFor(50), bandFor(49), bandFor(25), bandFor(24), bandFor(0)]).toEqual([
      "excellent", "excellent", "good", "good", "poor", "poor", "bad", "bad",
    ]);
  });
});

describe("food score", () => {
  const ns = (grade: "a" | "e", points: number) => ({ grade, points, origin: "computed" as const, isBeverage: false });
  it("60/30/10 weighting", () => {
    const res = foodScore({ nutriScore: ns("a", -5), nutrition: [], additives: [], organic: true });
    expect(res.score).toBe(100);
    const res2 = foodScore({ nutriScore: ns("a", -5), nutrition: [], additives: [], organic: false });
    expect(res2.score).toBe(90);
  });
  it("high-risk additive caps at 49", () => {
    const res = foodScore({ nutriScore: ns("a", -5), nutrition: [], additives: [r("Sodium nitrite", 3)], organic: true });
    expect(res.score).toBe(49);
    expect(res.notes.join(" ")).toMatch(/high-risk additive/);
  });
  it("Coca-Cola lands in Bad", () => {
    const res = foodScore({ nutriScore: { grade: "e", points: 12, origin: "open_food_facts", isBeverage: true }, nutrition: [], additives: [r("caramel", 2), r("phosphoric acid", 2)], organic: false });
    expect(res.score).toBe(Math.round(0 * 0.6 + 40 * 0.3));
    expect(res.band).toBe("bad");
  });
  it("additives sub-score", () => {
    expect(additivesScore([r("a", 1), r("b", 2)])).toBe(60);
  });
  it("missing nutrition gives a partial score", () => {
    const res = foodScore({ nutriScore: { grade: null, points: null, origin: "missing", isBeverage: false }, nutrition: [], additives: [], organic: false });
    expect(res.partial).toBe(true);
  });
});

describe("ingredient score", () => {
  it("risk-free is 100", () => expect(ingredientScore([r("water", 0), r("glycerin", 0)]).score).toBe(100));
  it("one moderate puts it in 25-49", () => {
    const s = ingredientScore([r("water", 0), r("parfum", 2)]).score;
    expect(s).toBeGreaterThanOrEqual(25);
    expect(s).toBeLessThanOrEqual(49);
  });
  it("one high puts it under 25", () => expect(ingredientScore([r("x", 3), r("y", 1)]).score).toBeLessThan(25));
  it("more bad ingredients lower the score", () => {
    expect(ingredientScore([r("a", 2), r("b", 2), r("c", 2)]).score).toBeLessThan(ingredientScore([r("a", 2)]).score);
  });
});

describe("parsing and lookup", () => {
  it("splits an Open Beauty Facts list", () => {
    const list = splitIngredients("INGREDIENTS/INGRÉDIENTS: WATER/EAU, SODIUM LAURYL SULFATE, FRAGRANCE/PARFUM, CITRIC ACID. TETRASODIUM EDTA, CAPRYLIC/CAPRIC TRIGLYCERIDE");
    expect(list).toEqual(["water/eau", "sodium lauryl sulfate", "fragrance/parfum", "citric acid", "tetrasodium edta", "caprylic/capric triglyceride"]);
  });
  it("flattens sub-ingredients and drops 'contains 2% or less of'", () => {
    const list = splitIngredients("Enriched flour (wheat flour, niacin), sugar, contains 2% or less of: salt, sodium benzoate (preservative), 0.5% yeast");
    expect(list).toContain("enriched flour");
    expect(list).toContain("niacin");
    expect(list).toContain("salt");
    expect(list).toContain("yeast");
  });
  it("normalizes E-numbers", () => {
    expect(normalizeCode("en:e150c")).toBe("e150c");
    expect(normalizeCode("E 211")).toBe("e211");
    expect(findAdditive("e150")?.entry.level).toBe(2);
    expect(findAdditive("sodium benzoate")?.code).toBe("e210");
  });
  it("finds cosmetic ingredients including PEG prefixes", () => {
    expect(findIngredient("peg-40 hydrogenated castor oil")?.level).toBe(1);
    expect(findIngredient("dmdm hydantoin")?.level).toBe(3);
  });
});
