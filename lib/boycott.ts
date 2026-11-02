// Boycott check: curated lists first (instant), then an AI deep check with Google Search (cached per company).

import { ENTITIES, entityById, findBrand, findCompany, isIsraeliBarcode, ISRAELI_PRODUCTS, normCompany, type Entity } from "./data/boycott";
import { config } from "./config";
import { kvGet, kvPut } from "./db";
import { geminiJson } from "./gemini";
import { urlExists } from "./http";
import { ownershipChain } from "./ownership";
import type { AiFinding, BoycottListing, BoycottResult, BoycottStatus, BoycottTier, OwnershipStep, ProductInput } from "./types";

const RANK: Record<BoycottTier, number> = { bds_priority: 5, bds_pressure: 4, bds_organic: 3, connected: 2, broad: 1 };

export const HEADLINES: Record<BoycottStatus, string> = {
  bds_priority: "BDS priority target",
  bds_pressure: "BDS pressure target",
  bds_organic: "BDS organic target",
  connected: "Connected company",
  broad: "Broad connection",
  ai_found: "AI found possible links",
  clear: "Clear",
  checking: "Checking the company",
};

const VIA: Record<OwnershipStep["relation"], string> = { brand: "Brand", owner: "Owner", parent: "Parent company" };

function entitiesFor(chain: OwnershipStep[]): { entity: Entity; via: string }[] {
  const out: { entity: Entity; via: string }[] = [];
  const seen = new Set<string>();
  const add = (e: Entity | undefined, via: string) => {
    while (e && !seen.has(e.id)) {
      seen.add(e.id);
      out.push({ entity: e, via });
      e = e.parent ? entityById(e.parent) : undefined;
      via = "Parent company";
    }
  };
  for (const step of chain) {
    const e = step.relation === "brand" ? findBrand(step.name) : findCompany(step.name) ?? findBrand(step.name);
    const via = step.relation === "brand" && e && normCompany(e.name) !== normCompany(step.name) ? "Owner" : VIA[step.relation];
    add(e, via);
  }
  return out;
}

export function curatedListings(barcode: string | undefined, chain: OwnershipStep[]): BoycottListing[] {
  const listings: BoycottListing[] = [];
  if (isIsraeliBarcode(barcode)) listings.push({ entity: "This product", ...ISRAELI_PRODUCTS, via: "Barcode" });
  for (const { entity, via } of entitiesFor(chain)) {
    for (const l of entity.listings) listings.push({ entity: entity.name, tier: l.tier, list: l.list, says: l.says, url: l.url, via });
  }
  return listings.sort((a, b) => RANK[b.tier] - RANK[a.tier]);
}

export function summarize(listings: BoycottListing[], ai: AiFinding[], deepCheck: BoycottResult["deepCheck"], chain: OwnershipStep[]): BoycottResult {
  const top = listings[0];
  let status: BoycottStatus;
  let reason: string;
  if (top) {
    status = top.tier;
    const who = top.via && top.via !== "Brand" && top.via !== "Barcode" ? `${top.via} ${top.entity}` : top.entity;
    if (top.via === "Barcode") reason = "Israeli barcode prefix (729).";
    else if (top.tier === "connected" || top.tier === "broad") reason = `${who}: ${top.says.charAt(0).toLowerCase()}${top.says.slice(1)}.`;
    else reason = `${who} is a ${HEADLINES[top.tier]}.`;
  } else if (ai.length) {
    status = "ai_found";
    reason = `${ai.length} possible link${ai.length > 1 ? "s" : ""} found by AI research. Check the sources.`;
  } else if (deepCheck === "pending") {
    status = "checking";
    reason = "Not on our lists. Checking the company's investors and partners.";
  } else {
    status = "clear";
    reason = deepCheck === "done" ? "Not on any boycott list, and AI research found no sourced links." : "Not on any boycott list we check.";
  }
  return { status, headline: HEADLINES[status], reason, listings, chain, aiFindings: ai, deepCheck, checkedAt: new Date().toISOString() };
}

/** Fast part, used during the scan. */
export async function quickBoycott(p: ProductInput): Promise<BoycottResult> {
  const chain = await ownershipChain(p);
  const listings = curatedListings(p.barcode, chain);
  const company = researchTarget(chain);
  let ai: AiFinding[] = [];
  let deep: BoycottResult["deepCheck"] = "pending";
  if (!company) deep = "skipped";
  else {
    const cached = await kvGet<CompanyResearch>("company", normCompany(company)).catch(() => null);
    if (cached && !isStale(cached.updatedAt)) {
      ai = cached.data.findings;
      deep = "done";
    } else if (!config.geminiKey) deep = "skipped";
  }
  if (listings[0] && RANK[listings[0].tier] >= RANK.bds_organic && deep === "pending") deep = "skipped";
  return summarize(listings, ai, deep, chain);
}

/** The company to research: the top of the ownership chain. */
export function researchTarget(chain: OwnershipStep[]): string | undefined {
  return chain.length ? chain[chain.length - 1].name : undefined;
}

function isStale(d: Date): boolean {
  return Date.now() - d.getTime() > config.companyRecheckDays * 86400000;
}

// ---------- AI deep check ----------

export interface CompanyResearch {
  company: string;
  owner?: string;
  findings: AiFinding[];
  checkedAt: string;
}

const RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    ultimateOwner: { type: ["string", "null"], description: "The company that ultimately owns this brand, if different" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["listing", "investor", "ceo", "partnership", "contract", "donation", "subsidiary", "settlement", "other"] },
          claim: { type: "string", description: "One factual sentence, under 30 words, naming who did what and when" },
          suggestedTier: { type: "string", enum: ["connected", "broad"] },
          sources: { type: "array", items: { type: "object", properties: { url: { type: "string" }, title: { type: "string" } }, required: ["url"] } },
        },
        required: ["kind", "claim", "suggestedTier", "sources"],
      },
    },
  },
  required: ["findings"],
};

export async function deepCheck(company: string, brand?: string, force = false): Promise<CompanyResearch> {
  const key = normCompany(company);
  if (!force) {
    const cached = await kvGet<CompanyResearch>("company", key).catch(() => null);
    if (cached && !isStale(cached.updatedAt)) return cached.data;
  }
  const known = ENTITIES.find((e) => normCompany(e.name) === key);
  const { data, citations } = await geminiJson<{ ultimateOwner?: string | null; findings: AiFinding[] }>({
    model: config.geminiResearchModel,
    search: true,
    timeoutMs: 60000,
    system:
      "You are a careful researcher for a consumer app that follows the Palestinian-led BDS boycott. " +
      "Report only facts that a specific web page states. Never guess, never rely on rumor, social media posts or AI-generated lists. " +
      "Prefer primary sources and these databases: bdsmovement.net, whoprofits.org, investigate.afsc.org, the UN OHCHR settlement business database, ethicalconsumer.org, company filings and reputable news.",
    prompt:
      `Research the company "${company}"${brand && normCompany(brand) !== key ? ` (owner of the brand "${brand}")` : ""}. ` +
      "Find documented links to Israel's occupation of Palestinian land, Israeli settlements, or the Israeli military: listings in the databases above; contracts or services for the Israeli military or government; operations, factories or stores in settlements; donations to the Israeli military; executives' public financial support for the Israeli military; major subsidiaries or investments in such activities; a majority owner that is itself listed. " +
      "Use suggestedTier 'connected' for direct business with the military or settlements or a database listing, and 'broad' for indirect links such as investments, R&D centers in Israel, or executive statements. " +
      (known ? `Already known from our lists (do not repeat): ${known.listings.map((l) => l.says).join("; ")}. ` : "") +
      "Each finding must have at least one source URL of a page that states it. If you find nothing well-sourced, return an empty findings array.",
    schema: RESEARCH_SCHEMA,
  });

  const cited = new Set(citations.map((c) => c.url));
  const findings: AiFinding[] = [];
  for (const f of (data.findings ?? []).slice(0, 8)) {
    const sources: AiFinding["sources"] = [];
    for (const s of f.sources ?? []) {
      if (!s?.url || sources.some((x) => x.url === s.url)) continue;
      if (cited.has(s.url) || (await urlExists(s.url))) sources.push({ url: s.url, title: s.title || citations.find((c) => c.url === s.url)?.title });
    }
    if (sources.length && f.claim?.trim()) {
      findings.push({ kind: f.kind, claim: f.claim.trim(), suggestedTier: f.suggestedTier === "connected" ? "connected" : "broad", sources: sources.slice(0, 3) });
    }
  }
  const result: CompanyResearch = { company, owner: data.ultimateOwner ?? undefined, findings, checkedAt: new Date().toISOString() };
  await kvPut("company", key, result).catch(() => {});
  return result;
}

/** Full check including the AI step. Used by /api/company. */
export async function fullBoycott(p: Pick<ProductInput, "barcode" | "brand" | "brandOwner" | "name">, force = false): Promise<BoycottResult> {
  let chain = await ownershipChain(p);
  let company = researchTarget(chain);
  if (!company) return summarize(curatedListings(p.barcode, chain), [], "skipped", chain);
  if (!config.geminiKey) return summarize(curatedListings(p.barcode, chain), [], "skipped", chain);
  let research: CompanyResearch;
  try {
    research = await deepCheck(company, p.brand, force);
  } catch {
    return summarize(curatedListings(p.barcode, chain), [], "failed", chain);
  }
  let ai = research.findings;
  // If the AI found an owner we did not know, add it and research it too (one level).
  if (research.owner && !chain.some((s) => normCompany(s.name) === normCompany(research.owner!))) {
    chain = [...chain, { name: research.owner, relation: "parent", source: "ai" }];
    company = research.owner;
    try {
      ai = [...ai, ...(await deepCheck(company, p.brand, force)).findings];
    } catch {
      /* keep what we have */
    }
  }
  return summarize(curatedListings(p.barcode, chain), ai, "done", chain);
}
