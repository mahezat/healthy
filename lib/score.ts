import { rateAdditives, rateIngredients, splitIngredients } from "./ingredients";
import { computeNutriScore } from "./scoring/nutriscore";
import { foodScore, ingredientScore } from "./scoring/yuka";
import type { Category, FoodDetails, HealthResult, ProductInput } from "./types";

export const FOOD_METHOD: Category[] = ["food", "beverage", "baby"];

/** What is missing for a fair score. The scan flow asks for a label photo when this is not empty. */
export function missingData(p: ProductInput): ("ingredients" | "nutrition")[] {
  const missing: ("ingredients" | "nutrition")[] = [];
  const hasIngredients = !!(p.ingredientsText?.trim() || p.ingredientList?.length);
  if (FOOD_METHOD.includes(p.category)) {
    if (!p.nutriScore && !p.nutrition) missing.push("nutrition");
    if (!hasIngredients && !p.additiveCodes.length) missing.push("ingredients");
  } else if (!hasIngredients) missing.push("ingredients");
  return missing;
}

export async function scoreProduct(p: ProductInput, opts: { ai?: boolean } = {}): Promise<HealthResult> {
  const useAi = opts.ai ?? true;
  const names = p.ingredientList?.length ? p.ingredientList : p.ingredientsText ? splitIngredients(p.ingredientsText) : [];

  if (FOOD_METHOD.includes(p.category)) {
    const additives = await rateAdditives(p.additiveCodes, names, useAi);
    let nutriScore: FoodDetails["nutriScore"];
    let nutrition: FoodDetails["nutrition"] = [];
    if (p.nutriScore) {
      nutriScore = { grade: p.nutriScore.grade as FoodDetails["nutriScore"]["grade"], points: p.nutriScore.points, origin: "open_food_facts", isBeverage: p.nutriScore.isBeverage };
      nutrition = p.nutriScore.components ?? (p.nutrition ? computeNutriScore(p.nutrition).components : []);
    } else if (p.nutrition) {
      const ns = computeNutriScore(p.nutrition);
      nutriScore = { grade: ns.grade, points: ns.points, origin: "computed", isBeverage: p.nutrition.isBeverage };
      nutrition = ns.components;
    } else {
      nutriScore = { grade: null, points: null, origin: "missing", isBeverage: p.category === "beverage" };
    }
    const result = foodScore({ nutriScore, nutrition, additives, organic: p.organic });
    if (!names.length && !p.additiveCodes.length) {
      result.partial = true;
      result.notes.push("No ingredient list, so additives were not checked.");
    }
    return result;
  }

  const rated = await rateIngredients(names, p.category, useAi);
  return ingredientScore(rated, names.length ? undefined : "No ingredient list, so nothing could be rated.");
}
