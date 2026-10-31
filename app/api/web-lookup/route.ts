import { body, handle } from "@/lib/api";
import { webFlow } from "@/lib/scan";

export const maxDuration = 60;

/** POST { draftId? , barcode? } -> found | not_found_web */
export const POST = handle(async (req: Request) => webFlow(await body<{ draftId?: string; barcode?: string }>(req)));
