// Who owns a brand: Open Food Facts brand owner, our curated list, then Wikidata.

import { entityById, findBrand, findCompany, normCompany } from "./data/boycott";
import { kvGet, kvPut } from "./db";
import { config } from "./config";
import type { OwnershipStep, ProductInput } from "./types";

const WD = "https://www.wikidata.org/w/api.php";
const ORG_HINT = /\b(brand|company|corporation|manufacturer|conglomerate|producer|maker|business|subsidiary|multinational|enterprise|food|beverage|drink|cosmetic|retailer|chain|label)\b/i;

async function wd<T>(params: Record<string, string>): Promise<T | null> {
  const url = `${WD}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": config.userAgent }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (res?.ok) return (await res.json()) as T;
    if (res?.status === 429) await new Promise((r) => setTimeout(r, 1200));
    else return null;
  }
  return null;
}

interface WdEntity {
  labels?: { en?: { value: string } };
  descriptions?: { en?: { value: string } };
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: { id?: string } } } }[]>;
}

// parent organization, manufacturer, owned by. "Owned by" on a public company lists shareholders
// (e.g. Vanguard), so above the first level only "parent organization" is followed.
const FIRST_LEVEL = ["P749", "P176", "P127"];
const UPPER_LEVELS = ["P749"];

function parentId(e: WdEntity, props = FIRST_LEVEL): string | undefined {
  for (const p of props) {
    const id = e.claims?.[p]?.[0]?.mainsnak?.datavalue?.value?.id;
    if (id) return id;
  }
  return undefined;
}

/** Up to two owners above a brand, from Wikidata. Returns [] if unsure. */
export async function wikidataOwners(brand: string): Promise<string[]> {
  const search = await wd<{ search?: { id: string; label?: string; description?: string }[] }>({
    action: "wbsearchentities", search: brand, language: "en", type: "item", limit: "5",
  });
  const candidates = (search?.search ?? []).filter((s) => normCompany(s.label ?? "") === normCompany(brand) && ORG_HINT.test(s.description ?? ""));
  if (!candidates.length) return [];
  const ents = await wd<{ entities?: Record<string, WdEntity> }>({ action: "wbgetentities", ids: candidates.map((c) => c.id).join("|"), props: "claims|labels|descriptions", languages: "en" });
  const start = candidates.map((c) => ents?.entities?.[c.id]).find((e) => e && parentId(e));
  if (!start) return [];
  const owners: string[] = [];
  let next = parentId(start);
  for (let depth = 0; next && depth < 2; depth++) {
    const r = await wd<{ entities?: Record<string, WdEntity> }>({ action: "wbgetentities", ids: next, props: "claims|labels", languages: "en" });
    const e = r?.entities?.[next];
    const label = e?.labels?.en?.value;
    if (!label || owners.includes(label)) break;
    owners.push(label);
    next = e ? parentId(e, UPPER_LEVELS) : undefined;
  }
  return owners;
}

export async function ownershipChain(p: Pick<ProductInput, "brand" | "brandOwner" | "name">, opts: { network?: boolean } = {}): Promise<OwnershipStep[]> {
  const brand = p.brand?.trim();
  const chain: OwnershipStep[] = [];
  if (brand) chain.push({ name: brand, relation: "brand", source: "open_food_facts" });
  const push = (name: string, relation: OwnershipStep["relation"], source: OwnershipStep["source"]) => {
    if (!name || chain.some((s) => normCompany(s.name) === normCompany(name))) return;
    chain.push({ name, relation, source });
  };

  const fromEntity = (id: string | undefined, relation: OwnershipStep["relation"]) => {
    let e = id ? entityById(id) : undefined;
    let rel = relation;
    while (e) {
      push(e.name, rel, "curated");
      e = e.parent ? entityById(e.parent) : undefined;
      rel = "parent";
    }
  };

  const curated = brand ? findBrand(brand) : undefined;
  if (curated) fromEntity(curated.id, "owner");

  if (p.brandOwner) {
    push(p.brandOwner, "owner", "open_food_facts");
    const c = findCompany(p.brandOwner);
    if (c) fromEntity(c.id, "parent");
  }

  if (!curated && !p.brandOwner && brand) {
    const key = normCompany(brand);
    const cached = await kvGet<string[]>("ownership", key).catch(() => null);
    let owners = cached?.data ?? [];
    if (!cached && opts.network !== false) {
      owners = await wikidataOwners(brand).catch(() => []);
      await kvPut("ownership", key, owners).catch(() => {});
    }
    owners.forEach((o, i) => {
      push(o, i === 0 ? "owner" : "parent", "wikidata");
      const c = findCompany(o);
      if (c) fromEntity(c.id, "parent");
    });
  }
  return chain;
}
