// Scan flows with Gemini mocked (no API key needed).
import { beforeEach, describe, expect, it, vi } from "vitest";

const gemini = vi.hoisted(() => ({ queue: [] as unknown[] }));
vi.mock("../lib/gemini", async (orig) => {
  const real = await orig<typeof import("../lib/gemini")>();
  return {
    ...real,
    geminiJson: vi.fn(async () => {
      const next = gemini.queue.shift();
      if (!next) throw new Error("no mock queued");
      return next;
    }),
  };
});
vi.mock("../lib/http", () => ({ urlExists: vi.fn(async (u: string) => !u.includes("fake")), getJson: vi.fn() }));
vi.mock("../lib/ownership", async (orig) => {
  const real = await orig<typeof import("../lib/ownership")>();
  return { ...real, wikidataOwners: vi.fn(async () => []) };
});

process.env.GEMINI_API_KEY = "test";
const { labelFlow, webFlow } = await import("../lib/scan");
const { deepCheck } = await import("../lib/boycott");

const label = (over: Record<string, unknown> = {}) => ({
  data: {
    readable: true,
    productName: "Test Crackers",
    brand: "Tiny Farm",
    category: "food",
    ingredients: [{ name: "wheat flour" }, { name: "palm oil" }, { name: "salt" }, { name: "sodium nitrite", eNumber: "E250" }],
    organic: false,
    nutrition: null,
    isBeverage: false,
    ...over,
  },
  citations: [],
});

beforeEach(() => {
  gemini.queue.length = 0;
});

describe("label photo flow", () => {
  it("asks for nutrition facts for food, then scores with them", async () => {
    gemini.queue.push(label());
    const first = await labelFlow({ ingredientsImage: "data:image/jpeg;base64,AAAA" });
    expect(first.status).toBe("needs_nutrition");
    const draftId = (first as { draftId: string }).draftId;

    gemini.queue.push({ data: { readable: true, nutrition: { basis: "per_serving", servingSize: 30, energyKcal: 140, saturatedFat: 1, sugars: 1, sodiumMg: 250, fiber: 1, proteins: 3 } }, citations: [] });
    const second = await labelFlow({ draftId, nutritionImage: "data:image/jpeg;base64,BBBB" });
    expect(second.status).toBe("found");
    const r = (second as { result: import("../lib/types").ScanResult }).result;
    expect(r.health.food?.nutriScore.origin).toBe("computed");
    expect(r.health.score).toBeLessThanOrEqual(49); // nitrite cap
    expect(r.health.food?.additives.find((a) => a.level === 3)?.name).toBe("Nitrites (E250)");
    expect(r.source).toBe("label_photo");
  });

  it("skipping nutrition gives a partial score", async () => {
    gemini.queue.push(label());
    const first = await labelFlow({ ingredientsImage: "data:image/jpeg;base64,AAAA" });
    const res = await labelFlow({ draftId: (first as { draftId: string }).draftId, skipNutrition: true });
    expect(res.status).toBe("found");
    expect((res as { result: import("../lib/types").ScanResult }).result.health.partial).toBe(true);
  });

  it("unreadable photo", async () => {
    gemini.queue.push(label({ readable: false, problem: "Blurry", ingredients: [] }));
    const res = await labelFlow({ ingredientsImage: "data:image/jpeg;base64,AAAA" });
    expect(res).toMatchObject({ status: "unreadable", problem: "Blurry" });
  });

  it("cosmetics go straight to the ingredient method", async () => {
    gemini.queue.push(label({ category: "cosmetics", ingredients: [{ name: "Aqua" }, { name: "Triclosan" }] }));
    const res = await labelFlow({ ingredientsImage: "data:image/jpeg;base64,AAAA" });
    const r = (res as { result: import("../lib/types").ScanResult }).result;
    expect(r.health.method).toBe("ingredients");
    expect(r.health.score).toBeLessThan(25);
  });
});

describe("web fallback", () => {
  it("uses the first source link that exists", async () => {
    gemini.queue.push({ ...label({ found: true, sourceUrls: ["https://fake.example/x", "https://real.example/p"] }), citations: [] });
    const res = await webFlow({ barcode: "0012345678905" });
    expect(res.status).toBe("found");
    const r = (res as { result: import("../lib/types").ScanResult }).result;
    expect(r.source).toBe("web");
    expect(r.sourceUrl).toBe("https://real.example/p");
  });
});

describe("AI company check", () => {
  it("drops findings whose sources do not exist", async () => {
    gemini.queue.push({
      data: {
        findings: [
          { kind: "contract", claim: "Supplies X to the Israeli military (2024).", suggestedTier: "connected", sources: [{ url: "https://real.example/a" }] },
          { kind: "ceo", claim: "Unsourced rumor.", suggestedTier: "broad", sources: [{ url: "https://fake.example/b" }] },
          { kind: "other", claim: "No source.", suggestedTier: "broad", sources: [] },
        ],
      },
      citations: [],
    });
    const r = await deepCheck("Example Foods Inc");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].sources[0].url).toBe("https://real.example/a");
  });
});
