// Storage: Neon Postgres (connected through Vercel). Tables are created automatically.
// Without DATABASE_URL it falls back to memory (local testing only; data is lost on restart).

import { neon } from "@neondatabase/serverless";
import { config } from "./config";
import type { BoycottStatus, Band, Category, HistoryItem } from "./types";

type Sql = ReturnType<typeof neon>;
let sql: Sql | null = null;
let ready: Promise<void> | null = null;

const mem = { kv: new Map<string, { data: unknown; updatedAt: Date }>(), history: [] as HistoryItem[], nextId: 1 };

function db(): Sql | null {
  if (!config.databaseUrl) return null;
  if (!sql) sql = neon(config.databaseUrl);
  return sql;
}

async function init(): Promise<void> {
  const s = db();
  if (!s) return;
  if (!ready) {
    ready = (async () => {
      await s.query(`CREATE TABLE IF NOT EXISTS kv (
        ns text NOT NULL, key text NOT NULL, data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (ns, key))`);
      await s.query(`CREATE TABLE IF NOT EXISTS history (
        id bigserial PRIMARY KEY, key text NOT NULL, name text NOT NULL, brand text,
        category text NOT NULL, image_url text, score int NOT NULL, band text NOT NULL,
        boycott_status text NOT NULL, scanned_at timestamptz NOT NULL DEFAULT now())`);
      await s.query(`CREATE INDEX IF NOT EXISTS history_scanned_at ON history (scanned_at DESC)`);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  await ready;
}

/** Namespaces: product, company, ingredient, ewg, draft, ownership */
export async function kvGet<T>(ns: string, key: string): Promise<{ data: T; updatedAt: Date } | null> {
  const s = db();
  if (!s) {
    const v = mem.kv.get(`${ns}:${key}`);
    return v ? { data: v.data as T, updatedAt: v.updatedAt } : null;
  }
  await init();
  const rows = (await s.query(`SELECT data, updated_at FROM kv WHERE ns = $1 AND key = $2`, [ns, key])) as { data: T; updated_at: string }[];
  return rows[0] ? { data: rows[0].data, updatedAt: new Date(rows[0].updated_at) } : null;
}

export async function kvPut(ns: string, key: string, data: unknown): Promise<void> {
  const s = db();
  if (!s) {
    mem.kv.set(`${ns}:${key}`, { data: structuredClone(data), updatedAt: new Date() });
    return;
  }
  await init();
  await s.query(
    `INSERT INTO kv (ns, key, data, updated_at) VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (ns, key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [ns, key, JSON.stringify(data)],
  );
}

export async function kvDelete(ns: string, key: string): Promise<void> {
  const s = db();
  if (!s) {
    mem.kv.delete(`${ns}:${key}`);
    return;
  }
  await init();
  await s.query(`DELETE FROM kv WHERE ns = $1 AND key = $2`, [ns, key]);
}

export async function addHistory(item: Omit<HistoryItem, "id" | "scannedAt">): Promise<void> {
  const s = db();
  if (!s) {
    mem.history.unshift({ ...item, id: mem.nextId++, scannedAt: new Date().toISOString() });
    return;
  }
  await init();
  await s.query(
    `INSERT INTO history (key, name, brand, category, image_url, score, band, boycott_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [item.key, item.name, item.brand ?? null, item.category, item.imageUrl ?? null, item.score, item.band, item.boycottStatus],
  );
}

export interface HistoryFilter {
  category?: string;
  flagged?: boolean;
  under50?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

const OTHER = ["supplement", "pet", "baby", "other"];

export async function listHistory(f: HistoryFilter = {}): Promise<HistoryItem[]> {
  const limit = Math.min(f.limit ?? 50, 200);
  const offset = f.offset ?? 0;
  const s = db();
  if (!s) {
    return mem.history
      .filter((h) => matchCategory(h.category, f.category))
      .filter((h) => !f.flagged || h.boycottStatus !== "clear")
      .filter((h) => !f.under50 || h.score < 50)
      .filter((h) => !f.q || `${h.name} ${h.brand ?? ""}`.toLowerCase().includes(f.q.toLowerCase()))
      .slice(offset, offset + limit);
  }
  await init();
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.category === "other") {
    params.push(OTHER);
    where.push(`category = ANY($${params.length})`);
  } else if (f.category === "food") {
    params.push(["food", "beverage"]);
    where.push(`category = ANY($${params.length})`);
  } else if (f.category) {
    params.push(f.category);
    where.push(`category = $${params.length}`);
  }
  if (f.flagged) where.push(`boycott_status <> 'clear'`);
  if (f.under50) where.push(`score < 50`);
  if (f.q) {
    params.push(`%${f.q}%`);
    where.push(`(name ILIKE $${params.length} OR brand ILIKE $${params.length})`);
  }
  params.push(limit, offset);
  const rows = (await s.query(
    `SELECT * FROM history ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY scanned_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    key: String(r.key),
    name: String(r.name),
    brand: (r.brand as string) ?? undefined,
    category: r.category as Category,
    imageUrl: (r.image_url as string) ?? undefined,
    score: Number(r.score),
    band: r.band as Band,
    boycottStatus: r.boycott_status as BoycottStatus,
    scannedAt: new Date(r.scanned_at as string).toISOString(),
  }));
}

function matchCategory(c: Category, f?: string): boolean {
  if (!f) return true;
  if (f === "food") return c === "food" || c === "beverage";
  if (f === "other") return OTHER.includes(c);
  return c === f;
}

export async function updateHistoryBoycott(key: string, status: BoycottStatus): Promise<void> {
  const s = db();
  if (!s) {
    for (const h of mem.history) if (h.key === key) h.boycottStatus = status;
    return;
  }
  await init();
  await s.query(`UPDATE history SET boycott_status = $1 WHERE key = $2`, [status, key]);
}

export async function deleteHistory(id: number): Promise<boolean> {
  const s = db();
  if (!s) {
    const before = mem.history.length;
    mem.history = mem.history.filter((h) => h.id !== id);
    return mem.history.length < before;
  }
  await init();
  const rows = (await s.query(`DELETE FROM history WHERE id = $1 RETURNING id`, [id])) as unknown[];
  return rows.length > 0;
}

export async function dbStatus(): Promise<"connected" | "memory" | string> {
  const s = db();
  if (!s) return "memory";
  try {
    await init();
    await s.query("SELECT 1");
    return "connected";
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}
