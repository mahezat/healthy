import { alternativesFor } from "@/lib/alternatives";
import { handle } from "@/lib/api";
import { HttpError } from "@/lib/config";

export const maxDuration = 60;

/** GET ?key=<product key> -> { items: Alternative[], note? } */
export const GET = handle(async (req: Request) => {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) throw new HttpError(400, "Send ?key=");
  return alternativesFor(key);
});
