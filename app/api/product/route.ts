import { handle } from "@/lib/api";
import { HttpError } from "@/lib/config";
import { getStored } from "@/lib/scan";

/** GET ?key=bc:0049000000443 -> the saved ScanResult (no new scan, no history entry). */
export const GET = handle(async (req: Request) => {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) throw new HttpError(400, "Send ?key=");
  const stored = await getStored(key);
  if (!stored) throw new HttpError(404, "Product not found. Scan it first.");
  return stored.result;
});
