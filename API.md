# Healthy engine API

Everything the UI needs. All requests and responses are JSON. Images are sent as data URLs (`data:image/jpeg;base64,...`); resize photos to about 1600 px on the long side before sending.

If `APP_PASSCODE` is set, call `POST /api/unlock` once (it sets a cookie for a year). Any other call without it returns `401 { error: "Locked. Enter your passcode." }`.

Errors always look like `{ "error": "plain message to show" }` with a 4xx/5xx status.

## The scan flow

```
Scan screen ── POST /api/scan {barcode}
   ├─ status "found"          → Result screen (result)
   ├─ status "needs_label"    → Not-in-database screen: photograph the label   (product is known but its ingredients or nutrition are missing)
   └─ status "not_found"      → Not-in-database screen: photograph the label

Not-in-database screen ── POST /api/label {draftId, ingredientsImage}
   ├─ "found"                 → Result screen
   ├─ "needs_nutrition"       → "Now the nutrition facts" step
   │      POST /api/label {draftId, nutritionImage}   or   {draftId, skipNutrition: true}
   └─ "unreadable"            → show problem, Retake, or "Search the web instead":
          POST /api/web-lookup {draftId}  → "found" | "not_found_web"

"Photograph the label" button on the Scan screen (no barcode):
   POST /api/label {ingredientsImage}  (same answers as above)

Result screen, when result.boycott.deepCheck === "pending":
   GET /api/company?key=<result.key>  → BoycottResult (replace result.boycott; status "checking" becomes the final one)
Result screen, when result.showAlternatives:
   GET /api/alternatives?key=<result.key>  → { items, note? }
```

The health score appears immediately; the AI company check runs in the second call so the screen can show "Checking the company" meanwhile.

## Endpoints

| Method | Path | Body or query | Returns |
|---|---|---|---|
| POST | `/api/scan` | `{ barcode }` | ScanResponse |
| POST | `/api/label` | `{ draftId?, barcode?, ingredientsImage?, nutritionImage?, skipNutrition?, useAvailable? }` | ScanResponse |
| POST | `/api/web-lookup` | `{ draftId }` or `{ barcode }` | ScanResponse or `{ status: "not_found_web" }` |
| GET | `/api/product` | `?key=` | ScanResult (saved copy; no new history entry) |
| GET | `/api/company` | `?key=` (scanned product) or `?name=` (any company) | BoycottResult |
| POST | `/api/company` | `{ key }` or `{ name }` | BoycottResult, re-researched (Recheck button) |
| GET | `/api/alternatives` | `?key=` | `{ items: Alternative[], note?: string }` |
| GET | `/api/ingredient` | `?name=&category=` | Ingredient sheet data (see below) |
| GET | `/api/history` | `?category=food\|cosmetics\|household\|other&flagged=1&under50=1&q=&limit=50&offset=0` | HistoryItem[] |
| DELETE | `/api/history/{id}` | | `{ deleted: true }` |
| POST | `/api/unlock` | `{ passcode }` | `{ unlocked: true }` |
| GET | `/api/status` | | which connections work |

`useAvailable: true` finishes a `needs_label` product with the data the database already has (partial score), for a "Skip" link.

## Shapes

Full TypeScript types: `lib/types.ts`.

```ts
ScanResponse =
  | { status: "found"; result: ScanResult }
  | { status: "needs_label"; draftId; missing: ("ingredients"|"nutrition")[]; preview: { name?, brand?, imageUrl?, category? } }
  | { status: "not_found"; draftId; barcode }
  | { status: "needs_nutrition"; draftId; preview }
  | { status: "unreadable"; draftId; problem }

ScanResult {
  key, barcode?, name, brand?, category, imageUrl?,
  source: "open_food_facts"|"open_beauty_facts"|"open_pet_food_facts"|"open_products_facts"|"label_photo"|"web",
  sourceUrl?, sourceNote?,            // header source tag
  health: HealthResult,
  boycott: BoycottResult,
  showAlternatives: boolean,          // score under 50 or any boycott flag
}

HealthResult {
  score: 0-100, band: "excellent"|"good"|"poor"|"bad",
  partial: boolean,                   // show the "Partial score" tag
  method: "food"|"ingredients",
  notes: string[],                    // e.g. "Capped at 49 because it contains a high-risk additive (Nitrites (E250))."
  food?: {                            // method "food"
    nutriScore: { grade: "a".."e"|null, points, origin: "open_food_facts"|"computed"|"missing", isBeverage },
    nutrition: { id, label, value, unit, points, pointsMax, kind: "negative"|"positive" }[],   // level bars
    additives: RatedIngredient[],
    organic: boolean,
    subScores: { nutrition, additives, organic }   // each 0-100
  },
  ingredients?: RatedIngredient[]     // method "ingredients", highest risk first
}

RatedIngredient { name, code?, level: 0|1|2|3, concern, refs: { org, note, url? }[], aiRated?, unknown? }
   // level: 0 risk-free, 1 low/limited, 2 moderate, 3 high

BoycottResult {
  status: "bds_priority"|"bds_pressure"|"bds_organic"|"connected"|"broad"|"ai_found"|"clear"|"checking",
  headline,                           // e.g. "BDS organic target"
  reason,                             // one line, e.g. "The Coca-Cola Company is a BDS organic target."
  listings: { entity, tier, list, says, url?, via? }[],
  chain: { name, relation: "brand"|"owner"|"parent", source }[],   // ownership steps
  aiFindings: { kind, claim, suggestedTier, sources: { url, title? }[] }[],
  deepCheck: "pending"|"done"|"skipped"|"failed",
  checkedAt
}

Alternative { key, barcode, name, brand?, imageUrl?, score, band, boycott: "clear" }
HistoryItem { id, key, name, brand?, category, imageUrl?, score, band, boycottStatus, scannedAt }
```

Ingredient sheet (`GET /api/ingredient`): `{ name, code?, level, concern, refs, aiRated?, otherNames: string[], ewg: { found, score?, dataAvailability?, url? } | null }`. EWG is looked up the first time an ingredient is opened (a few seconds), then cached.

## Boycott statuses for the UI

| status | headline | meaning |
|---|---|---|
| bds_priority | BDS priority target | BDS asks for a full consumer boycott (or Israeli barcode 729) |
| bds_pressure | BDS pressure target | BDS calls for pressure campaigns (Google, Amazon, Airbnb, Booking, Expedia, Cisco) |
| bds_organic | BDS organic target | Grassroots boycott BDS supports (McDonald's, Coca-Cola, Burger King...) |
| connected | Connected company | On Who Profits, the UN database, AFSC or Boycat level 1, or owns a listed brand |
| broad | Broad connection | Indirect or past link |
| ai_found | AI found possible links | Only the AI found something; every finding has a source link |
| clear | Clear | Nothing found |
| checking | Checking the company | AI check still to run (call /api/company) |

Note for the Stitch write-up: add "BDS pressure target" to the boycott statuses on the Result screen.
