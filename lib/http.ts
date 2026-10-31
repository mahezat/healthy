import { config } from "./config";

export async function getJson<T = unknown>(url: string, opts: { timeoutMs?: number; headers?: Record<string, string> } = {}): Promise<{ status: number; data: T | null }> {
  const res = await fetch(url, {
    headers: { "User-Agent": config.userAgent, Accept: "application/json", ...opts.headers },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10000),
    redirect: "follow",
  });
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

/**
 * Checks that a source link really exists. A made-up link on a real site
 * usually returns 404; sites that block bots (401/403/429) are treated as existing.
 */
export async function urlExists(url: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false;
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; HealthyBot/0.1)" },
      });
      if (res.status < 400 || [401, 403, 429].includes(res.status)) return true;
      if (res.status === 405 && method === "HEAD") continue;
      return false;
    } catch {
      if (method === "GET") return false;
    }
  }
  return false;
}
