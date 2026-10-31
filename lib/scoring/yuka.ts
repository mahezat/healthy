// Yuka-style scores.
//
// FOOD (Yuka help: "How are food products rated?")
//   60% nutritional quality (Nutri-Score, converted with Yuka's published correspondence table)
//   30% additives (4 risk levels; a high-risk additive caps the product at 49)
//   10% organic label
//   A Nutri-Score of D or E also caps the product at 49.
//
// INGREDIENTS (Yuka help: "How are cosmetic products evaluated?"), used for
// cosmetics, household, supplements, pet and baby products:
//   The highest-risk ingredient sets the range
//     risk-free 75-100, low 50-74, moderate 25-49, high 0-24
//   and the other ingredients set the exact score inside that range.

import type { Band, FoodDetails, HealthResult, RatedIngredient, RiskLevel } from "../types";

// Yuka's correspondence table, help.yuka.io article owuc9rbhqs (copied from their image).
// Index = Nutri-Score points; values below -3 use "min", above 21 use "max".
const SOLID: Record<number, number> = { [-3]: 100, [-2]: 100, [-1]: 90, 0: 80, 1: 75, 2: 70, 3: 65, 4: 60, 5: 55, 6: 50, 7: 45, 8: 40, 9: 35, 10: 30, 11: 15, 12: 13, 13: 11, 14: 9, 15: 7, 16: 5, 17: 3, 18: 1 };
const LIQUID: Record<number, number> = { [-3]: 77, [-2]: 74, [-1]: 71, 0: 68, 1: 65, 2: 57, 3: 49, 4: 41, 5: 33, 6: 15, 7: 11, 8: 7, 9: 3 };

export function nutritionScoreFromPoints(points: number, isBeverage: boolean, isWater = false): number {
  if (isBeverage && isWater) return 100;
  const p = Math.round(points);
  if (isBeverage) {
    if (p < -3) return 80;
    if (p > 9) return 0;
    return LIQUID[p];
  }
  if (p < -3) return 100;
  if (p > 18) return 0;
  return SOLID[p];
}

/**
 * Additives part, 0-100. Yuka does not publish this formula. Ours:
 * start at 100, minus 10 per limited-risk and 30 per moderate-risk additive;
 * any high-risk additive sets it to 0 (and caps the product at 49).
 */
export function additivesScore(additives: RatedIngredient[]): number {
  let s = 100;
  for (const a of additives) {
    if (a.level === 3) return 0;
    if (a.level === 2) s -= 30;
    if (a.level === 1) s -= 10;
  }
  return Math.max(0, s);
}

export function bandFor(score: number): Band {
  if (score >= 75) return "excellent";
  if (score >= 50) return "good";
  if (score >= 25) return "poor";
  return "bad";
}

export function foodScore(details: Omit<FoodDetails, "subScores">): HealthResult {
  const notes: string[] = [];
  const add = additivesScore(details.additives);
  const org = details.organic ? 100 : 0;
  const ns = details.nutriScore;

  let nutrition: number | null = null;
  if (ns.points !== null) nutrition = nutritionScoreFromPoints(ns.points, ns.isBeverage, false);
  else if (ns.grade) nutrition = gradeOnly(ns.grade, ns.isBeverage);

  let score: number;
  let partial = false;
  if (nutrition === null) {
    // No nutrition facts: score additives and organic only, scaled to 100, and flag it.
    partial = true;
    score = Math.round((add * 30 + org * 10) / 40);
    notes.push("Partial score: no nutrition facts, so only additives and the organic label were rated.");
  } else {
    score = Math.round(nutrition * 0.6 + add * 0.3 + org * 0.1);
  }

  const high = details.additives.find((a) => a.level === 3);
  if (high && score > 49) {
    score = 49;
    notes.push(`Capped at 49 because it contains a high-risk additive (${high.name}).`);
  }
  if (ns.grade && (ns.grade === "d" || ns.grade === "e") && score > 49) {
    score = 49;
    notes.push(`Capped at 49 because its Nutri-Score is ${ns.grade.toUpperCase()}.`);
  }

  return {
    score,
    band: bandFor(score),
    partial,
    method: "food",
    notes,
    food: { ...details, subScores: { nutrition, additives: add, organic: org } },
  };
}

// When we only know the letter (rare), use the middle of that letter's range in Yuka's table.
function gradeOnly(grade: string, bev: boolean): number {
  const solid: Record<string, number> = { a: 95, b: 75, c: 50, d: 8, e: 0 };
  const liquid: Record<string, number> = { a: 100, b: 72, c: 45, d: 9, e: 0 };
  return (bev ? liquid : solid)[grade] ?? 0;
}

const RANGES: Record<RiskLevel, [number, number]> = { 0: [75, 100], 1: [50, 74], 2: [25, 49], 3: [0, 24] };

/**
 * Cosmetics-style score. Yuka publishes the ranges but not the exact penalties. Ours:
 * start at the top of the range set by the worst ingredient, then subtract
 * 6 for each additional ingredient at that worst level and 2 for each ingredient one level below it.
 */
export function ingredientScore(ingredients: RatedIngredient[], partialReason?: string): HealthResult {
  const notes: string[] = [];
  const worst = ingredients.reduce<RiskLevel>((m, i) => (i.level > m ? i.level : m), 0);
  const [lo, hi] = RANGES[worst];
  const atWorst = ingredients.filter((i) => i.level === worst).length;
  const below = worst > 0 ? ingredients.filter((i) => i.level === worst - 1).length : 0;
  let score = worst === 0 ? 100 : hi - 6 * Math.max(0, atWorst - 1) - 2 * below;
  score = Math.max(lo, Math.min(hi, score));

  if (worst > 0) {
    const names = ingredients.filter((i) => i.level === worst).map((i) => i.name).slice(0, 3).join(", ");
    const word = ["", "low-risk", "moderate-risk", "high-risk"][worst];
    notes.push(`Range set by ${word} ingredient${atWorst > 1 ? "s" : ""}: ${names}.`);
  }
  const unknown = ingredients.filter((i) => i.unknown).length;
  if (unknown) notes.push(`${unknown} ingredient${unknown > 1 ? "s" : ""} could not be rated and were counted as risk-free.`);
  if (partialReason) notes.push(partialReason);

  return {
    score,
    band: bandFor(score),
    partial: !!partialReason || ingredients.length === 0,
    method: "ingredients",
    notes,
    ingredients: [...ingredients].sort((a, b) => b.level - a.level),
  };
}
