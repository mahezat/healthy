# Healthy

A personal Yuka-style scanner for every kind of product, with a boycott check.
Scan a barcode or photograph a label and get two separate answers:

1. **Health score (0 to 100).**
   - Food and drinks use Yuka's published method: 60% nutrition (Nutri-Score, converted with Yuka's own table), 30% additives, 10% organic. A high-risk additive or a Nutri-Score of D or E caps the score at 49.
   - Cosmetics, household, supplements, pet and baby care use Yuka's cosmetics method: the riskiest ingredient sets the range (75-100, 50-74, 25-49, 0-24).
2. **Boycott check.** It looks at BDS, Who Profits, the UN settlement database, AFSC Investigate and Ethical Consumer, follows the ownership chain (brand, owner, parent), and runs an AI search on the company. Every AI finding must link to a source that exists.

If a product is bad on either one, it suggests US alternatives that pass both.

- Setup: [SETUP.md](SETUP.md)
- API for the UI: [API.md](API.md)

## Where the data comes from

| Data | Source |
|---|---|
| Products | Open Food Facts, Open Beauty Facts, Open Pet Food Facts, Open Products Facts |
| Unknown products | Your label photo (read by Gemini), then a Gemini web search |
| Nutri-Score | Open Food Facts' value, or computed with the 2023 algorithm (same thresholds as Open Food Facts) |
| Additive and ingredient risk | Our own ratings (`lib/data/additives.ts`, `lib/data/ingredients.ts`) citing EFSA, IARC, EU, FDA and CIR. Anything not listed is rated by Gemini and marked `aiRated`. EWG scores are looked up per ingredient on demand. |
| Boycott lists | `lib/data/boycott.ts`, every entry with a source link |
| Ownership | Open Food Facts brand owner, the curated list, then Wikidata |

## What is ours, not Yuka's

Yuka publishes its weights, caps, score ranges and the Nutri-Score table. It does not publish its additive and ingredient database or the exact penalty formulas. The penalties used here are documented in `lib/scoring/yuka.ts`, so scores will be close to Yuka's but not identical.

## Code map

```
app/api/*          API routes (see API.md)
lib/scan.ts        scan flow: barcode, label photo, web, finalize
lib/score.ts       picks the food or ingredient method
lib/scoring/       Nutri-Score 2023 and Yuka-style scoring
lib/ingredients.ts ingredient parsing and rating (AI fallback, EWG)
lib/boycott.ts     lists, ownership chain, AI company check
lib/alternatives.ts
lib/label.ts       Gemini label reading and web lookup
lib/off.ts         Open Food Facts family
lib/db.ts          Neon Postgres cache and history
proxy.ts           passcode lock
```
