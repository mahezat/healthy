import { body, handle } from "@/lib/api";
import { fullBoycott } from "@/lib/boycott";
import { HttpError } from "@/lib/config";
import { companyCheck } from "@/lib/scan";

export const maxDuration = 60;

/**
 * GET ?key=<product key>  -> BoycottResult for a scanned product (runs the AI check if the company is new)
 * GET ?name=<company or brand> -> BoycottResult for any company (Company sheet)
 */
export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const key = q.get("key");
  if (key) return companyCheck(key);
  const name = q.get("name");
  if (!name) throw new HttpError(400, "Send ?key= or ?name=");
  return fullBoycott({ brand: name, name });
});

/** POST { key, force: true } -> Recheck button: reruns the AI check, ignoring the cache. */
export const POST = handle(async (req: Request) => {
  const { key, name } = await body<{ key?: string; name?: string }>(req);
  if (key) return companyCheck(key, true);
  if (name) return fullBoycott({ brand: name, name }, true);
  throw new HttpError(400, "Send key or name.");
});
