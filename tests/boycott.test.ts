import { describe, expect, it } from "vitest";
import { ENTITIES, findBrand, isIsraeliBarcode } from "../lib/data/boycott";
import { curatedListings, summarize } from "../lib/boycott";
import { ownershipChain } from "../lib/ownership";

describe("boycott data", () => {
  it("every entity has at least one sourced listing", () => {
    for (const e of ENTITIES) {
      expect(e.listings.length, e.id).toBeGreaterThan(0);
      for (const l of e.listings) expect(l.url, `${e.id} ${l.list}`).toMatch(/^https:\/\//);
    }
  });
  it("parents exist", () => {
    for (const e of ENTITIES) if (e.parent) expect(ENTITIES.some((x) => x.id === e.parent), e.id).toBe(true);
  });
  it("Israeli prefix", () => {
    expect(isIsraeliBarcode("7290000066318")).toBe(true);
    expect(isIsraeliBarcode("0049000000443")).toBe(false);
  });
});

describe("boycott check", () => {
  it("Sprite is flagged through The Coca-Cola Company", async () => {
    const chain = await ownershipChain({ brand: "Sprite", name: "Sprite" });
    expect(chain.map((s) => s.name)).toEqual(["Sprite", "The Coca-Cola Company"]);
    const res = summarize(curatedListings("0049000028928", chain), [], "skipped", chain);
    expect(res.status).toBe("bds_organic");
    expect(res.reason).toMatch(/Owner The Coca-Cola Company is a BDS organic target/);
  });
  it("Doritos is connected through PepsiCo (SodaStream owner)", async () => {
    const chain = await ownershipChain({ brand: "Doritos", name: "Doritos" });
    const res = summarize(curatedListings(undefined, chain), [], "done", chain);
    expect(res.status).toBe("connected");
  });
  it("Reebok is a priority target and its owner ABG is in the chain", async () => {
    const chain = await ownershipChain({ brand: "Reebok", name: "Classic" });
    expect(chain.map((s) => s.name)).toContain("Authentic Brands Group");
    expect(summarize(curatedListings(undefined, chain), [], "skipped", chain).status).toBe("bds_priority");
  });
  it("brand owner from Open Food Facts is used", async () => {
    const chain = await ownershipChain({ brand: "Some Store Brand", brandOwner: "General Mills Sales Inc.", name: "x" });
    expect(summarize(curatedListings(undefined, chain), [], "done", chain).status).toBe("broad");
  });
  it("unknown brand with nothing found is clear", () => {
    const chain = [{ name: "Tiny Farm", relation: "brand" as const, source: "open_food_facts" as const }];
    expect(summarize(curatedListings("0000000000000", chain), [], "done", chain).status).toBe("clear");
    expect(summarize(curatedListings("0000000000000", chain), [], "pending", chain).status).toBe("checking");
  });
  it("does not match ambiguous words", () => {
    expect(findBrand("Life")).toBeUndefined();
    expect(findBrand("Simply")).toBeUndefined();
  });
});
