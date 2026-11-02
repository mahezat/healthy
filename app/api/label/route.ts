import { body, handle } from "@/lib/api";
import { labelFlow, type LabelRequest } from "@/lib/scan";

export const maxDuration = 60;

/**
 * POST { draftId?, barcode?, ingredientsImage?, nutritionImage?, skipNutrition?, useAvailable? }
 * Images are data URLs ("data:image/jpeg;base64,...").
 * -> found | needs_nutrition | unreadable
 */
export const POST = handle(async (req: Request) => labelFlow(await body<LabelRequest>(req)));
