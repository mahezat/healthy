import { handle } from "@/lib/api";
import { HttpError } from "@/lib/config";
import { deleteHistory } from "@/lib/db";

/** DELETE /api/history/123 -> { deleted: true } */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw new HttpError(400, "Bad id.");
  if (!(await deleteHistory(id))) throw new HttpError(404, "Not found.");
  return { deleted: true };
});
