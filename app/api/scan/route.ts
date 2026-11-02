import { body, handle } from "@/lib/api";
import { HttpError } from "@/lib/config";
import { scanBarcode } from "@/lib/scan";

export const maxDuration = 60;

/** POST { barcode } -> found | needs_label | not_found */
export const POST = handle(async (req: Request) => {
  const { barcode } = await body<{ barcode?: string }>(req);
  if (!barcode) throw new HttpError(400, "Send a barcode.");
  return scanBarcode(barcode);
});
