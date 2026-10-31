import { body, handle } from "@/lib/api";
import { config, HttpError } from "@/lib/config";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";

/** POST { passcode } -> sets a 1-year cookie so the app can call the API. */
export const POST = handle(async (req: Request) => {
  if (!config.passcode) return { unlocked: true };
  const { passcode } = await body<{ passcode?: string }>(req);
  const a = Buffer.from(passcode ?? "");
  const b = Buffer.from(config.passcode);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "Wrong passcode.");
  (await cookies()).set("app_key", config.passcode, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 365 * 86400 });
  return { unlocked: true };
});
