import { handle } from "@/lib/api";
import { HttpError } from "@/lib/config";
import { ingredientDetail } from "@/lib/ingredients";
import type { Category } from "@/lib/types";

export const maxDuration = 30;

/** GET ?name=phenoxyethanol&category=cosmetics -> rating, sources, and EWG (non-food only, looked up on demand) */
export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const name = q.get("name");
  if (!name) throw new HttpError(400, "Send ?name=");
  return ingredientDetail(name, (q.get("category") as Category) ?? "cosmetics");
});
