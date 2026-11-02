import { handle } from "@/lib/api";
import { listHistory } from "@/lib/db";

/** GET ?category=food|cosmetics|household|other&flagged=1&under50=1&q=text&limit=50&offset=0 */
export const GET = handle(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  return listHistory({
    category: q.get("category") || undefined,
    flagged: q.get("flagged") === "1",
    under50: q.get("under50") === "1",
    q: q.get("q") || undefined,
    limit: Number(q.get("limit") ?? 50),
    offset: Number(q.get("offset") ?? 0),
  });
});
