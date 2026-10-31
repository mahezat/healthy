import { handle } from "@/lib/api";
import { config } from "@/lib/config";
import { dbStatus } from "@/lib/db";
import { geminiPing } from "@/lib/gemini";

export const maxDuration = 30;

/** GET -> which connections work. Open this after deploying to check the setup. */
export const GET = handle(async (req: Request) => {
  const cookie = req.headers.get("cookie")?.match(/(?:^|;\s*)app_key=([^;]+)/)?.[1];
  const unlocked = !config.passcode || cookie === config.passcode || req.headers.get("x-app-key") === config.passcode;
  const [database, gemini, openFoodFacts] = await Promise.all([
    dbStatus(),
    !config.geminiKey ? Promise.resolve("missing GEMINI_API_KEY") : unlocked ? geminiPing() : Promise.resolve("key is set (unlock to test it)"),
    fetch("https://world.openfoodfacts.org/api/v3/product/0049000000443?fields=code", { headers: { "User-Agent": config.userAgent }, signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? "connected" : `error ${r.status}`))
      .catch((e) => `error: ${e.message}`),
  ]);
  return {
    database,
    gemini,
    geminiModel: config.geminiModel,
    geminiResearchModel: config.geminiResearchModel,
    openFoodFacts,
    passcodeLock: config.passcode ? "on" : "off",
  };
});
