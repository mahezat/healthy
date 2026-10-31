// Curated Palestine boycott list. Every listing names its source.
// Checked Oct 30, 2026 against:
//   BDS "Guide to BDS Boycott" (consumer, pressure and organic targets)
//   BDS news: endorsement of the ZARA boycott
//   AFSC Investigate company pages (only Palestine-related findings are used)
//   Who Profits, UN OHCHR settlement business database (Sep 2025 update)
//   Ethical Consumer's list of Boycat level 1 targets (Jan 2025)
// Boycat has no public API, so Boycat's own level 2 and 3 lists are NOT copied here.
// Parent companies of listed brands are flagged as "connected" by rule (see lib/boycott.ts).
// Edit this file to add or remove entries; tests check that every entry has a source.

import type { BoycottTier } from "../types";

export interface Listing {
  list: string;
  tier: BoycottTier;
  says: string;
  url: string;
}

export interface Entity {
  id: string;
  name: string;
  /** Other names the company appears under (owners, legal names). */
  aliases?: string[];
  /** Consumer brands it owns. A product with one of these brands is treated as this company's product. */
  brands?: string[];
  /** Parent entity id, if the parent is also in this file. */
  parent?: string;
  listings: Listing[];
  /** Shown under the listings. */
  note?: string;
}

const BDS = "https://bdsmovement.net/Guide-to-BDS-Boycott";
const BDS_TECH = "https://bdsmovement.net/no-tech-oppression-apartheid-or-genocide";
const BDS_ZARA = "https://bdsmovement.net/news/black-friday-don%E2%80%99t-buy-genocide";
const EC = "https://ethicalconsumer.org/ethical-campaigns-boycotts/palestine-boycott-list";
const UN = "https://www.un.org/unispal/document/business-database-26sep25";
const AFSC = (slug: string) => `https://investigate.afsc.org/company/${slug}`;
const WHO_PROFITS = "https://www.whoprofits.org/";

const bds = (says: string): Listing => ({ list: "BDS", tier: "bds_priority", says, url: BDS });
const pressure = (says: string, url = BDS): Listing => ({ list: "BDS", tier: "bds_pressure", says, url });
const organic = (says: string, url = BDS): Listing => ({ list: "BDS", tier: "bds_organic", says, url });
const afsc = (slug: string, says: string, tier: BoycottTier = "connected"): Listing => ({ list: "AFSC Investigate", tier, says, url: AFSC(slug) });
const ec = (says: string): Listing => ({ list: "Ethical Consumer (Boycat level 1)", tier: "connected", says, url: EC });
const un = (says: string): Listing => ({ list: "UN OHCHR database", tier: "connected", says, url: UN });

const ORGANIC_MEALS = "Grassroots boycott BDS supports: it or its Israeli franchisee openly supported Israel or donated to the Israeli military";

export const ENTITIES: Entity[] = [
  // ---- BDS consumer boycott priority targets ----
  { id: "chevron", name: "Chevron", aliases: ["chevron corporation", "chevron usa"], brands: ["chevron", "texaco", "caltex", "techron", "havoline", "delo"], listings: [bds("Extracts gas Israel claims in the East Mediterranean, funding its government"), afsc("chevron", "Largest producer of natural gas for Israel")] },
  { id: "intel", name: "Intel", aliases: ["intel corporation"], brands: ["intel"], listings: [bds("Major investor in Israel; campaign continues despite dropping a planned plant"), afsc("intel", "Supplies the Israeli military and has a large presence in Israel")] },
  { id: "dell", name: "Dell Technologies", aliases: ["dell", "dell inc"], brands: ["dell", "alienware"], listings: [bds("Supplies servers and services to the Israeli military"), afsc("dell-technologies", "Provides products and services to the Israeli military")] },
  { id: "siemens", name: "Siemens AG", aliases: ["siemens"], listings: [bds("Main contractor for an undersea cable that would connect settlements to Europe"), afsc("siemens", "Links to the occupation, the Israeli military and energy sector")], note: "Siemens-branded home appliances are made by BSH (Bosch) under license." },
  { id: "hp", name: "HP", aliases: ["hp inc", "hewlett-packard", "hewlett packard", "hewlett packard enterprise", "hpe"], brands: ["hp", "hyperx", "omen"], listings: [bds("Provides technology to the Israeli military, prisons, police and population registry"), afsc("hp-inc", "Involved in human rights violations in the occupation")] },
  { id: "microsoft", name: "Microsoft", aliases: ["microsoft corporation"], brands: ["microsoft", "xbox", "surface", "minecraft"], listings: [bds("Provides Azure cloud and AI services to the Israeli military; BDS asks to boycott Xbox"), afsc("microsoft", "Its technology is used by the Israeli military and police")] },
  { id: "carrefour", name: "Carrefour", aliases: ["carrefour group", "carrefour sa"], brands: ["carrefour"], listings: [bds("Franchise partner operates in settlements; branch in a settlement"), afsc("carrefour", "Grocery stores in illegal settlements")] },
  { id: "axa", name: "AXA", aliases: ["axa sa", "axa group"], brands: ["axa"], listings: [bds("Invests in companies that arm Israel"), afsc("axa", "Invests in weapons companies on the BDS divestment shortlist")] },
  { id: "reebok", name: "Reebok", parent: "abg", brands: ["reebok"], listings: [bds("Sponsors the Israel Football Association, which includes settlement teams")] },
  { id: "disney", name: "The Walt Disney Company", aliases: ["disney", "walt disney", "walt disney company", "disney enterprises"], brands: ["disney", "disney+", "marvel", "pixar", "star wars", "lucasfilm", "espn", "hulu", "national geographic"], listings: [bds("Disney+ and Marvel: BDS asks to cancel subscriptions over promotion of Israel")] },
  { id: "teva", name: "Teva Pharmaceutical Industries", aliases: ["teva", "teva pharmaceuticals", "teva pharmaceuticals usa"], brands: ["teva", "actavis"], listings: [bds("Israeli drug maker that supported the war and profits from the occupied market")] },
  { id: "sodastream", name: "SodaStream", parent: "pepsico", brands: ["sodastream"], listings: [bds("Displaced Bedouin Palestinians in the Naqab; discriminates against Palestinian workers"), ec("Exploitation of the Bedouin community at its Negev factory")] },
  { id: "remax", name: "RE/MAX", aliases: ["re/max", "remax"], brands: ["re/max", "remax"], listings: [bds("Markets and sells property in Israeli settlements")] },

  // ---- BDS pressure targets ----
  { id: "alphabet", name: "Google (Alphabet)", aliases: ["alphabet", "alphabet inc", "google", "google llc"], brands: ["google", "google pixel", "google nest", "fitbit", "chromecast", "youtube"], listings: [pressure("Project Nimbus: cloud and AI for the Israeli government and military"), afsc("alphabet", "Provides cloud computing to the Israeli military")] },
  { id: "amazon", name: "Amazon", aliases: ["amazon.com", "amazon.com inc", "amazon inc"], brands: ["amazon", "amazon basics", "ring", "kindle", "amazon echo", "alexa", "whole foods market", "365 by whole foods market", "365 whole foods market", "365 everyday value", "solimo", "happy belly", "presto!", "amazon essentials"], listings: [pressure("Project Nimbus: cloud and AI for the Israeli government and military; BDS names Ring cameras", BDS_TECH), afsc("amazon", "Main cloud provider for the Israeli government and military")] },
  { id: "booking", name: "Booking Holdings", aliases: ["booking.com", "booking holdings inc"], brands: ["booking.com", "priceline", "kayak", "agoda", "opentable"], listings: [pressure("Lists rentals in Israeli settlements"), afsc("booking-holdings", "Booking.com lists accommodation in occupied territory"), un("Listed in the 2025 UN database of businesses in settlements")] },
  { id: "airbnb", name: "Airbnb", aliases: ["airbnb inc"], brands: ["airbnb"], listings: [pressure("Lists rentals in Israeli settlements"), afsc("airbnb", "Lists rentals in illegal settlements"), un("Listed in the 2025 UN database of businesses in settlements")] },
  { id: "expedia", name: "Expedia Group", aliases: ["expedia", "expedia inc"], brands: ["expedia", "hotels.com", "vrbo", "trivago", "orbitz", "travelocity"], listings: [pressure("Lists rentals in Israeli settlements"), afsc("expedia-group", "Expedia.com and Hotels.com list places in occupied land")] },
  { id: "cisco", name: "Cisco", aliases: ["cisco systems", "cisco systems inc"], brands: ["cisco", "webex", "meraki"], listings: [pressure("Named a BDS pressure target in the 2025 update"), afsc("cisco-systems", "Provides technology to the Israeli military, police, prisons and settlements"), ec("Provides services to the Israeli military")] },

  // ---- BDS-supported organic boycotts ----
  { id: "mcdonalds", name: "McDonald's", aliases: ["mcdonald's corporation", "mcdonalds corporation", "mcdonalds"], brands: ["mcdonald's", "mcdonalds", "mccafe", "mccafé"], listings: [organic(ORGANIC_MEALS)] },
  { id: "cocacola", name: "The Coca-Cola Company", aliases: ["coca-cola", "coca cola", "the coca-cola company", "coca-cola company", "coca-cola co", "coca-cola bottling", "coca-cola consolidated", "coca-cola enterprises", "coca-cola north america", "fairlife llc", "bodyarmor"], brands: ["coca-cola", "coca cola", "coke", "diet coke", "coke zero", "sprite", "fanta", "dasani", "smartwater", "vitaminwater", "minute maid", "simply orange", "simply lemonade", "simply apple", "powerade", "fairlife", "core power", "topo chico", "gold peak", "bodyarmor", "body armor", "fresca", "barq's", "mello yello", "pibb xtra", "seagram's", "peace tea", "costa", "costa coffee", "honest tea", "glaceau", "schweppes", "innocent", "appletiser"], listings: [organic(ORGANIC_MEALS), afsc("coca-cola", "Its Israeli licensee has a logistics center in an illegal settlement")] },
  { id: "burgerking", name: "Burger King", parent: "rbi", brands: ["burger king"], listings: [organic(ORGANIC_MEALS), ec("Donated meals to the Israeli military")] },
  { id: "papajohns", name: "Papa John's", aliases: ["papa john's international", "papa johns"], brands: ["papa john's", "papa johns"], listings: [organic(ORGANIC_MEALS)] },
  { id: "pizzahut", name: "Pizza Hut", parent: "yum", brands: ["pizza hut"], listings: [organic(ORGANIC_MEALS)] },
  { id: "dominos", name: "Domino's Pizza", aliases: ["domino's", "dominos", "domino's pizza inc"], brands: ["domino's", "dominos"], listings: [organic(ORGANIC_MEALS)] },
  { id: "wix", name: "Wix", aliases: ["wix.com"], brands: ["wix"], listings: [organic(ORGANIC_MEALS)] },
  { id: "zara", name: "Zara", parent: "inditex", brands: ["zara", "zara home"], listings: [organic("BDS endorsed the grassroots ZARA boycott", BDS_ZARA)] },

  // ---- Parent companies (connected by ownership) ----
  { id: "pepsico", name: "PepsiCo", aliases: ["pepsico inc", "pepsico, inc.", "frito-lay", "frito lay", "frito-lay north america", "the quaker oats company", "quaker oats company", "stokely-van camp", "pepsi-cola", "pepsi bottling"], brands: ["pepsi", "diet pepsi", "pepsi zero sugar", "mountain dew", "mtn dew", "starry", "mug", "aquafina", "bubly", "rockstar", "gatorade", "propel", "lay's", "lays", "doritos", "cheetos", "fritos", "ruffles", "tostitos", "sunchips", "sun chips", "smartfood", "rold gold", "funyuns", "miss vickie's", "stacy's", "off the eaten path", "quaker", "cap'n crunch", "life cereal", "rice-a-roni", "pasta roni", "pearl milling company", "sabra", "siete", "poppi", "muscle milk", "kevita", "lifewtr", "sodastream"], listings: [{ list: "Ownership", tier: "connected", says: "Owns SodaStream, a BDS priority target (bought in 2018), and fully owns Sabra since 2024", url: BDS }] },
  { id: "yum", name: "Yum! Brands", aliases: ["yum brands", "yum! brands inc"], brands: ["kfc", "taco bell", "the habit burger grill"], listings: [{ list: "Ownership", tier: "connected", says: "Owns Pizza Hut, a BDS-supported organic boycott target", url: BDS }] },
  { id: "rbi", name: "Restaurant Brands International", aliases: ["rbi", "restaurant brands international inc"], brands: ["tim hortons", "popeyes", "firehouse subs"], listings: [{ list: "Ownership", tier: "connected", says: "Owns Burger King, a BDS-supported organic boycott target", url: BDS }] },
  { id: "inditex", name: "Inditex", aliases: ["industria de diseno textil", "inditex sa"], brands: ["pull&bear", "pull and bear", "massimo dutti", "bershka", "stradivarius", "oysho", "lefties"], listings: [{ list: "Ownership", tier: "connected", says: "Owns Zara, whose boycott BDS endorsed", url: BDS_ZARA }] },
  { id: "abg", name: "Authentic Brands Group", aliases: ["authentic brands group llc", "abg"], brands: ["nautica", "brooks brothers", "eddie bauer", "aeropostale", "forever 21", "sperry", "vince camuto", "juicy couture"], listings: [{ list: "Ownership", tier: "connected", says: "Owns Reebok, a BDS priority target", url: BDS }] },

  // ---- Other Palestine databases ----
  { id: "ahava", name: "Ahava (Dead Sea Laboratories)", aliases: ["ahava", "dead sea laboratories"], brands: ["ahava"], listings: [ec("Involved in illegal Israeli settlements"), { list: "Who Profits", tier: "connected", says: "Profiled for production in a settlement on occupied land", url: WHO_PROFITS }] },
  { id: "hikvision", name: "Hikvision", aliases: ["hangzhou hikvision digital technology"], brands: ["hikvision", "ezviz"], listings: [ec("Supplies surveillance cameras to the Israeli military")] },
  { id: "nokia", name: "Nokia", aliases: ["nokia corporation"], listings: [ec("Sponsored an Israeli military technology conference")], note: "Nokia-branded phones are made by HMD Global under license." },
  { id: "barclays", name: "Barclays", aliases: ["barclays bank", "barclays plc"], brands: ["barclays"], listings: [ec("Finances companies making weapons used against Palestinians")] },
  { id: "tripadvisor", name: "Tripadvisor", aliases: ["tripadvisor inc"], brands: ["tripadvisor", "viator", "thefork"], listings: [afsc("tripadvisor", "Lists accommodation in illegal settlements"), un("Listed in the 2025 UN database of businesses in settlements")] },
  { id: "motorola", name: "Motorola Solutions", aliases: ["motorola solutions inc"], listings: [afsc("motorola-solutions", "Surveillance equipment in settlements and along the wall"), un("Listed in the 2025 UN database of businesses in settlements")], note: "Motorola-branded phones are made by Lenovo, a separate company." },
  { id: "caterpillar", name: "Caterpillar", aliases: ["caterpillar inc"], brands: ["cat", "caterpillar"], listings: [afsc("caterpillar", "Its bulldozers are used in home demolitions and settlement construction")], note: "CAT boots and clothing are made under license by other companies." },
  { id: "jcb", name: "JCB", aliases: ["j.c. bamford excavators"], brands: ["jcb"], listings: [afsc("jcb", "Machinery used in demolitions and settlement construction")] },
  { id: "strauss", name: "Strauss Group", aliases: ["strauss group ltd", "strauss"], brands: ["max brenner"], listings: [{ list: "Who Profits", tier: "connected", says: "Israeli food company; long-running BDS campaign over its support for Israeli army brigades", url: WHO_PROFITS }] },
  { id: "generalmills", name: "General Mills", aliases: ["general mills inc", "general mills sales inc", "general mills, inc."], brands: ["cheerios", "pillsbury", "betty crocker", "nature valley", "annie's", "lucky charms", "cinnamon toast crunch", "chex", "wheaties", "kix", "trix", "totino's", "old el paso", "progresso", "fiber one", "larabar", "gold medal", "blue buffalo", "epic provisions", "cascadian farm", "muir glen", "bugles", "gushers", "fruit by the foot", "fruit roll-ups", "golden grahams", "cocoa puffs", "reese's puffs"], listings: [afsc("general-mills", "Made Pillsbury products in a settlement factory until 2022", "broad")] },
  { id: "puma", name: "Puma", aliases: ["puma se"], brands: ["puma"], listings: [afsc("puma", "Sponsored the Israel Football Association; said it would end this at the end of 2024", "broad")], note: "BDS dropped Puma after the sponsorship ended." },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[.,]/g, "")
    .replace(/\b(the|inc|incorporated|corp|corporation|company|co|llc|ltd|limited|plc|sa|ag|se|nv|group|holdings|sales|usa|us|na|north america)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normCompany = norm;

const byName = new Map<string, Entity>();
const byBrand = new Map<string, Entity>();
for (const e of ENTITIES) {
  for (const n of [e.name, ...(e.aliases ?? [])]) if (norm(n)) byName.set(norm(n), e);
  for (const b of e.brands ?? []) if (norm(b)) byBrand.set(norm(b), e);
}

export function entityById(id: string): Entity | undefined {
  return ENTITIES.find((e) => e.id === id);
}

export function findCompany(name: string): Entity | undefined {
  return byName.get(norm(name));
}

export function findBrand(name: string): Entity | undefined {
  return byBrand.get(norm(name)) ?? byName.get(norm(name));
}

/** Israel's GS1 barcode prefix. It shows where the barcode was registered, not always where it was made. */
export function isIsraeliBarcode(barcode?: string): boolean {
  if (!barcode) return false;
  const d = barcode.replace(/\D/g, "");
  return d.length === 13 && d.startsWith("729");
}

export const ISRAELI_PRODUCTS: Listing = {
  list: "BDS",
  tier: "bds_priority",
  says: "BDS asks shoppers to avoid Israeli products. This barcode starts with 729, Israel's barcode prefix",
  url: BDS,
};
