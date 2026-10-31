// Nutri-Score 2023 (foods) / 2023 (beverages).
// Thresholds match Open Food Facts' reference implementation
// (openfoodfacts-server lib/ProductOpener/Nutriscore.pm, %points_thresholds_2023).

import type { NutritionComponent, NutritionInput } from "../types";

const T = {
  energy: [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350],
  energy_beverages: [30, 90, 150, 210, 240, 270, 300, 330, 360, 390],
  sugars: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],
  sugars_beverages: [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11],
  saturated_fat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  salt: [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4],
  energy_from_saturated_fat: [120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200],
  saturated_fat_ratio: [10, 16, 22, 28, 34, 40, 46, 52, 58, 64],
  fruits_vegetables_legumes: [40, 60, 80, 80, 80],
  fruits_vegetables_legumes_beverages: [40, 40, 60, 60, 80, 80],
  fiber: [3.0, 4.1, 5.2, 6.3, 7.4],
  proteins: [2.4, 4.8, 7.2, 9.6, 12, 14, 17],
  proteins_beverages: [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0],
} as const;

type Key = keyof typeof T;

const LABELS: Record<string, string> = {
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

const UNITS: Record<string, string> = {
  energy: "kJ",
  energy_from_saturated_fat: "kJ",
  saturated_fat_ratio: "%",
  fruits_vegetables_legumes: "%",
  non_nutritive_sweeteners: "",
};

function points(key: Key, value: number | undefined, ratio = false): number {
  if (value === undefined || value === null || Number.isNaN(value)) return 0;
  let p = 0;
  for (const t of T[key]) if (ratio ? value >= t : value > t) p++;
  return p;
}

export interface NutriScoreOutput {
  points: number;
  grade: "a" | "b" | "c" | "d" | "e";
  components: NutritionComponent[];
  /** Nutrients the label did not give (counted as 0 points). */
  missing: string[];
}

export function computeNutriScore(n: NutritionInput): NutriScoreOutput {
  const bev = !!n.isBeverage;
  const fats = !bev && !!n.isFatOilNutsSeeds;
  const pick = (k: string): Key => (bev && `${k}_beverages` in T ? (`${k}_beverages` as Key) : (k as Key));

  const missing: string[] = [];
  for (const [k, v] of Object.entries({
    energyKj: n.energyKj,
    sugars: n.sugars,
    saturatedFat: n.saturatedFat,
    salt: n.salt,
    proteins: n.proteins,
    fiber: n.fiber,
  })) {
    if (v === undefined || v === null) missing.push(k);
  }

  const vals: Record<string, number | undefined> = {
    energy: n.energyKj,
    sugars: n.sugars,
    saturated_fat: n.saturatedFat,
    salt: n.salt,
    proteins: n.proteins,
    fiber: n.fiber,
    fruits_vegetables_legumes: n.fruitsVegLegumesPercent,
  };
  if (fats) {
    vals.energy_from_saturated_fat = n.saturatedFat !== undefined ? n.saturatedFat * 37 : undefined;
    vals.saturated_fat_ratio =
      n.saturatedFat !== undefined && n.fat ? (n.saturatedFat / n.fat) * 100 : undefined;
  }

  const energyKey = fats ? "energy_from_saturated_fat" : "energy";
  const satKey = fats ? "saturated_fat_ratio" : "saturated_fat";

  const comp = (id: string, kind: "negative" | "positive"): NutritionComponent => {
    const k = pick(id);
    return {
      id,
      label: LABELS[id] ?? id,
      value: vals[id] ?? null,
      unit: UNITS[id] ?? "g",
      points: points(k, vals[id], id === "saturated_fat_ratio"),
      pointsMax: T[k].length,
      kind,
    };
  };

  const negative = [comp(energyKey, "negative"), comp("sugars", "negative"), comp(satKey, "negative"), comp("salt", "negative")];
  if (bev) {
    negative.push({
      id: "non_nutritive_sweeteners",
      label: LABELS.non_nutritive_sweeteners,
      value: n.nonNutritiveSweeteners ? 1 : 0,
      unit: "",
      points: n.nonNutritiveSweeteners ? 4 : 0,
      pointsMax: 4,
      kind: "negative",
    });
  }
  const neg = negative.reduce((s, c) => s + c.points, 0);

  let countProteins: boolean;
  if (bev || n.isCheese) countProteins = true;
  else if (fats) countProteins = neg < 7;
  else countProteins = neg < 11;

  const protein = comp("proteins", "positive");
  if (n.isRedMeat && protein.points > 2) protein.points = 2;
  const positive = [comp("fiber", "positive"), comp("fruits_vegetables_legumes", "positive")];
  if (countProteins) positive.unshift(protein);
  const pos = positive.reduce((s, c) => s + c.points, 0);

  const score = neg - pos;
  return { points: score, grade: gradeFor(score, bev, !!n.isWater, fats), components: [...negative, ...positive], missing };
}

export function gradeFor(score: number, isBeverage: boolean, isWater: boolean, fats: boolean): "a" | "b" | "c" | "d" | "e" {
  if (isBeverage) {
    if (isWater) return "a";
    if (score <= 2) return "b";
    if (score <= 6) return "c";
    if (score <= 9) return "d";
    return "e";
  }
  if (fats) {
    if (score <= -6) return "a";
    if (score <= 2) return "b";
    if (score <= 10) return "c";
    if (score <= 18) return "d";
    return "e";
  }
  if (score <= 0) return "a";
  if (score <= 2) return "b";
  if (score <= 10) return "c";
  if (score <= 18) return "d";
  return "e";
}
