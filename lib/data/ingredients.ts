// Hazard levels for cosmetics, household, supplement and pet ingredients
// (the "cosmetics-style" method). OUR ratings, based on the cited agency positions.
// EWG ratings are fetched on demand per ingredient (see lib/ingredients.ts), never invented here.
// Unlisted ingredients are rated by the AI and cached (marked aiRated).

import type { Ref, RiskLevel } from "../types";

export interface IngredientEntry {
  names: string[];
  level: RiskLevel;
  concern: string;
  refs: Ref[];
}

const IARC = "https://monographs.iarc.who.int/list-of-classifications";
const COSING = "https://ec.europa.eu/growth/tools-databases/cosing/";
const CIR = "https://www.cir-safety.org/ingredients";

const formaldehyde: Ref = { org: "IARC", note: "Formaldehyde: Group 1, carcinogenic to humans", url: IARC };
const formaldehydeEu: Ref = { org: "EU", note: "Products releasing formaldehyde must carry a warning label", url: COSING };
const fragranceAllergen: Ref = { org: "EU", note: "Listed fragrance allergen: must be named on the label above set amounts", url: COSING };
const dioxane: Ref = { org: "IARC", note: "Can be contaminated with 1,4-dioxane (Group 2B)", url: IARC };

const I = (names: string[], level: RiskLevel, concern: string, refs: Ref[]): IngredientEntry => ({ names, level, concern, refs });

export const INGREDIENTS: IngredientEntry[] = [
  // High risk
  I(["formaldehyde", "formalin", "methylene glycol"], 3, "Carcinogen and strong allergen", [formaldehyde]),
  I(["dmdm hydantoin", "quaternium-15", "imidazolidinyl urea", "diazolidinyl urea", "sodium hydroxymethylglycinate", "2-bromo-2-nitropropane-1,3-diol", "bronopol", "methenamine"], 3, "Releases formaldehyde", [formaldehyde, formaldehydeEu]),
  I(["isobutylparaben", "isopropylparaben", "phenylparaben", "benzylparaben", "pentylparaben"], 3, "Suspected endocrine disruptor; banned in EU cosmetics", [{ org: "EU", note: "Banned in cosmetics since 2014", url: "https://eur-lex.europa.eu/eli/reg/2014/358/oj" }]),
  I(["triclosan", "triclocarban"], 3, "Endocrine disruption and antibiotic resistance concerns", [
    { org: "FDA", note: "2016: banned from consumer antiseptic washes", url: "https://www.fda.gov/consumers/consumer-updates/skip-antibacterial-soap-use-plain-soap-and-water" },
  ]),
  I(["hydroquinone"], 3, "Skin damage and possible carcinogen; banned in EU cosmetics", [{ org: "EU", note: "Banned in cosmetics", url: COSING }, { org: "FDA", note: "No longer allowed in over-the-counter skin lighteners (2020)" }]),
  I(["butylphenyl methylpropional", "lilial"], 3, "Harmful to fertility; banned in EU cosmetics", [{ org: "EU", note: "Banned from March 2022 as toxic to reproduction", url: "https://eur-lex.europa.eu/eli/reg/2021/1902/oj" }]),
  I(["hydroxyisohexyl 3-cyclohexene carboxaldehyde", "lyral"], 3, "Strong allergen; banned in EU cosmetics", [{ org: "EU", note: "Banned in cosmetics since 2021", url: COSING }]),
  I(["atranol", "chloroatranol"], 3, "Strong allergen; banned in EU cosmetics", [{ org: "EU", note: "Banned in cosmetics", url: COSING }]),
  I(["dibutyl phthalate", "dbp", "diethylhexyl phthalate", "dehp", "bis(2-ethylhexyl) phthalate"], 3, "Endocrine disruptor and reproductive toxicant", [{ org: "EU", note: "Banned in cosmetics", url: COSING }]),
  I(["coal tar", "coal tar solution"], 3, "Carcinogen", [{ org: "IARC", note: "Coal-tar pitch: Group 1", url: IARC }]),
  I(["lead acetate"], 3, "Lead exposure", [{ org: "FDA", note: "2018: repealed approval for use in hair dyes" }]),
  I(["mercury", "thimerosal", "mercuric chloride"], 3, "Toxic metal", [{ org: "FDA", note: "Mercury not allowed in cosmetics except trace amounts in eye-area products" }]),
  I(["cyclotetrasiloxane", "d4"], 3, "Toxic to reproduction and persistent in the environment", [{ org: "EU", note: "Restricted in wash-off cosmetics under REACH (2020)", url: COSING }]),
  I(["nonylphenol ethoxylate", "nonoxynol", "nonylphenol"], 3, "Endocrine disruptor, toxic to aquatic life", [{ org: "EU", note: "Restricted under REACH" }]),
  I(["butylated hydroxyanisole", "bha"], 3, "Possible carcinogen and endocrine disruptor", [{ org: "IARC", note: "Group 2B", url: IARC }]),

  // Moderate risk
  I(["propylparaben", "butylparaben"], 2, "Suspected endocrine disruptor", [{ org: "EU", note: "Restricted to 0.14% and banned in leave-on nappy-area products", url: COSING }]),
  I(["benzophenone-3", "oxybenzone"], 2, "Suspected endocrine disruptor; harmful to coral", [{ org: "EU", note: "Limited to 6% in sunscreen since 2022", url: COSING }]),
  I(["homosalate"], 2, "Suspected endocrine disruptor", [{ org: "EU", note: "Limited to 7.34% in face products", url: COSING }]),
  I(["ethylhexyl methoxycinnamate", "octinoxate", "octyl methoxycinnamate"], 2, "Suspected endocrine disruptor", [{ org: "EU", note: "Under review as a potential endocrine disruptor", url: COSING }]),
  I(["octocrylene"], 2, "Can break down into benzophenone", [{ org: "EU", note: "Restricted concentration", url: COSING }]),
  I(["cyclopentasiloxane", "d5", "cyclohexasiloxane", "d6", "cyclomethicone"], 2, "Persistent in the environment", [{ org: "EU", note: "Restricted under REACH (2024 restriction on D4, D5, D6)", url: COSING }]),
  I(["methylisothiazolinone", "methylchloroisothiazolinone", "benzisothiazolinone"], 2, "Strong skin allergen", [{ org: "EU", note: "Banned in leave-on cosmetics; limited in rinse-off", url: COSING }]),
  I(["talc"], 2, "Classified as probably carcinogenic in 2024; possible asbestos contamination", [{ org: "IARC", note: "2024: Group 2A", url: IARC }]),
  I(["p-phenylenediamine", "ppd", "toluene-2,5-diamine"], 2, "Strong allergen in hair dye", [{ org: "EU", note: "Restricted; requires a warning label", url: COSING }]),
  I(["resorcinol"], 2, "Allergen; possible thyroid effects", [{ org: "EU", note: "Restricted; requires a warning label", url: COSING }]),
  I(["toluene"], 2, "Toxic to reproduction; nail polish solvent", [{ org: "EU", note: "Classified as toxic to reproduction" }]),
  I(["diethanolamine", "dea", "cocamide dea", "lauramide dea"], 2, "Possible carcinogen", [{ org: "IARC", note: "Diethanolamine and coconut oil diethanolamine condensate: Group 2B", url: IARC }]),
  I(["fragrance", "parfum", "perfume", "aroma"], 2, "Undisclosed mix; common cause of allergies", [{ org: "EU", note: "Only 26+ listed allergens must be named; the rest stays secret", url: COSING }]),
  I(["butylated hydroxytoluene", "bht"], 2, "Suspected endocrine disruptor", [{ org: "EU", note: "Restricted concentration in cosmetics", url: COSING }]),
  I(["carbon black", "ci 77266"], 2, "Possible carcinogen when inhaled", [{ org: "IARC", note: "Group 2B", url: IARC }]),
  I(["diethyl phthalate", "dep"], 2, "Suspected endocrine disruptor", [{ org: "EU", note: "Under review", url: COSING }]),
  I(["isoeugenol", "evernia prunastri extract", "oakmoss extract", "evernia furfuracea extract", "treemoss extract"], 2, "Strong fragrance allergen", [fragranceAllergen]),
  I(["benzalkonium chloride", "didecyldimethylammonium chloride", "alkyl dimethyl benzyl ammonium chloride"], 2, "Irritant; linked to asthma with frequent cleaning use", [{ org: "EU", note: "Restricted concentration in cosmetics", url: COSING }]),
  I(["sodium hypochlorite", "bleach"], 2, "Corrosive; releases toxic gas if mixed with ammonia or acids", [{ org: "CDC", note: "Never mix bleach with ammonia or acids" }]),
  I(["ammonia", "ammonium hydroxide"], 2, "Irritant to eyes and lungs", [{ org: "CDC", note: "Respiratory irritant" }]),
  I(["hydrochloric acid", "sulfuric acid"], 2, "Corrosive", [{ org: "CDC", note: "Corrosive to skin and eyes" }]),
  I(["2-butoxyethanol", "butoxyethanol", "ethylene glycol monobutyl ether"], 2, "Irritant; absorbed through skin", [{ org: "EU", note: "Restricted in sprays", url: COSING }]),

  // Low risk
  I(["methylparaben", "ethylparaben"], 1, "Short-chain paraben; considered safe at allowed levels", [{ org: "EU", note: "Allowed up to 0.4% each", url: COSING }]),
  I(["phenoxyethanol"], 1, "Preservative; limited to 1%", [{ org: "EU", note: "Allowed up to 1%", url: COSING }]),
  I(["sodium lauryl sulfate", "sodium dodecyl sulfate"], 1, "Skin irritant", [{ org: "CIR", note: "Safe in rinse-off products; irritating in leave-on", url: CIR }]),
  I(["sodium laureth sulfate", "ammonium laureth sulfate", "sodium coceth sulfate"], 1, "Mild irritant; possible 1,4-dioxane traces", [dioxane]),
  I(["ammonium lauryl sulfate", "tea-dodecylbenzenesulfonate", "sodium dodecylbenzenesulfonate", "sodium c14-16 olefin sulfonate"], 1, "Skin irritant", [{ org: "CIR", note: "Safe as used in rinse-off products", url: CIR }]),
  I(["peg-", "ceteareth-", "laureth-", "trideceth-", "polysorbate 20", "polysorbate 80", "steareth-"], 1, "Possible 1,4-dioxane traces", [dioxane]),
  I(["limonene", "linalool", "citral", "geraniol", "eugenol", "coumarin", "citronellol", "benzyl alcohol", "benzyl benzoate", "benzyl salicylate", "hexyl cinnamal", "cinnamal", "cinnamyl alcohol", "farnesol", "alpha-isomethyl ionone", "amyl cinnamal", "amylcinnamyl alcohol", "hydroxycitronellal", "anise alcohol", "benzyl cinnamate", "methyl 2-octynoate"], 1, "Fragrance allergen", [fragranceAllergen]),
  I(["retinol", "retinyl palmitate", "retinyl acetate"], 1, "Vitamin A; limited in cosmetics to avoid excess intake", [{ org: "EU", note: "Concentration limits since 2024", url: COSING }]),
  I(["aluminum chlorohydrate", "aluminium chlorohydrate", "aluminum zirconium tetrachlorohydrex gly", "aluminum zirconium trichlorohydrex gly", "aluminum sesquichlorohydrate"], 1, "Aluminium; judged safe at current levels", [{ org: "EU", note: "SCCS considered safe at the levels used", url: COSING }]),
  I(["mineral oil", "paraffinum liquidum", "petrolatum", "paraffin", "microcrystalline wax"], 1, "Safe if highly refined; poorly refined grades can contain harmful hydrocarbons", [{ org: "EU", note: "Allowed only if the refining history is fully known", url: COSING }]),
  I(["polyethylene", "nylon-12", "acrylates copolymer", "polymethyl methacrylate", "polypropylene"], 1, "Microplastic; pollutes water", [{ org: "EU", note: "Intentionally added microplastics restricted from 2023" }]),
  I(["titanium dioxide", "ci 77891"], 1, "Possible carcinogen when inhaled (sprays, powders)", [{ org: "IARC", note: "Group 2B (inhaled)", url: IARC }]),
  I(["triethanolamine", "tea"], 1, "Irritant at high levels", [{ org: "CIR", note: "Safe for brief use or at low levels", url: CIR }]),
  I(["propylene glycol"], 1, "Mild irritant for some people", [{ org: "CIR", note: "Safe as used", url: CIR }]),
  I(["disodium edta", "tetrasodium edta", "trisodium edta", "edta"], 1, "Poorly biodegradable", [{ org: "CIR", note: "Safe as used", url: CIR }]),
  I(["cocamidopropyl betaine"], 1, "Can cause allergic reactions", [{ org: "CIR", note: "Safe when impurities are minimized", url: CIR }]),
  I(["sodium benzoate", "potassium sorbate", "benzoic acid", "sorbic acid", "dehydroacetic acid", "sodium dehydroacetate"], 1, "Preservative; rare irritation", [{ org: "EU", note: "Allowed with limits", url: COSING }]),
  I(["dimethicone", "dimethiconol", "amodimethicone", "cyclopentasiloxane/dimethicone crosspolymer"], 1, "Silicone; not biodegradable", [{ org: "CIR", note: "Safe as used", url: CIR }]),
  I(["alcohol denat.", "alcohol denat", "sd alcohol", "denatured alcohol"], 1, "Drying; irritant", [{ org: "CIR", note: "Safe as used", url: CIR }]),
  I(["menthol", "camphor"], 1, "Irritant in high amounts", [{ org: "EU", note: "Allowed with limits", url: COSING }]),
  I(["ethylhexylglycerin", "chlorphenesin"], 1, "Mild irritant", [{ org: "EU", note: "Allowed", url: COSING }]),
  I(["sodium hydroxide", "potassium hydroxide"], 1, "Corrosive in cleaners; neutralized in cosmetics", [{ org: "EU", note: "Allowed with pH limits", url: COSING }]),
  I(["sodium percarbonate", "sodium carbonate peroxide"], 1, "Irritant to eyes", [{ org: "EU", note: "Classified as an eye irritant" }]),
  I(["optical brightener", "disodium distyrylbiphenyl disulfonate", "fluorescent brightener"], 1, "Persistent in water", [{ org: "Studies", note: "Low biodegradability" }]),
  I(["sodium tripolyphosphate", "phosphates", "trisodium phosphate"], 1, "Feeds algae in waterways", [{ org: "EU", note: "Phosphates restricted in laundry and dishwasher detergents" }]),
  I(["monoethanolamine", "ethanolamine", "mea"], 1, "Irritant", [{ org: "CIR", note: "Safe in rinse-off products", url: CIR }]),
  I(["ci 19140", "ci 15985", "ci 16035", "ci 42090", "ci 17200", "ci 14700", "ci 45410"], 1, "Synthetic dye; possible allergen", [{ org: "EU", note: "Allowed colorant", url: COSING }]),

  // Risk-free (common, so we don't spend AI calls on them)
  I(["water", "aqua", "eau", "purified water", "deionized water"], 0, "", []),
  I(["glycerin", "glycerine", "glycerol"], 0, "", []),
  I(["sodium chloride", "salt", "sea salt"], 0, "", []),
  I(["citric acid", "sodium citrate", "lactic acid", "malic acid", "gluconolactone", "sodium gluconate"], 0, "", []),
  I(["tocopherol", "tocopheryl acetate", "vitamin e"], 0, "", []),
  I(["aloe barbadensis leaf juice", "aloe vera", "aloe barbadensis leaf extract"], 0, "", []),
  I(["butyrospermum parkii butter", "shea butter", "theobroma cacao seed butter", "cocoa butter", "cocos nucifera oil", "coconut oil", "simmondsia chinensis seed oil", "jojoba oil", "argania spinosa kernel oil", "argan oil", "olea europaea fruit oil", "olive oil", "helianthus annuus seed oil", "sunflower oil", "prunus amygdalus dulcis oil", "sweet almond oil", "ricinus communis seed oil", "castor oil"], 0, "", []),
  I(["xanthan gum", "guar gum", "cellulose gum", "hydroxyethylcellulose", "carbomer", "sclerotium gum"], 0, "", []),
  I(["panthenol", "niacinamide", "sodium hyaluronate", "hyaluronic acid", "allantoin", "squalane", "ceramide np", "urea", "betaine"], 0, "", []),
  I(["caprylic/capric triglyceride", "cetearyl alcohol", "cetyl alcohol", "stearyl alcohol", "behenyl alcohol", "glyceryl stearate", "stearic acid", "palmitic acid", "myristic acid", "glycol distearate", "isopropyl myristate", "isopropyl palmitate", "c12-15 alkyl benzoate", "cetyl esters"], 0, "", []),
  I(["butylene glycol", "caprylyl glycol", "pentylene glycol", "propanediol", "1,2-hexanediol", "sorbitol"], 0, "", []),
  I(["zinc oxide", "kaolin", "bentonite", "silica", "mica", "ci 77492", "ci 77491", "ci 77499", "iron oxides"], 0, "", []),
  I(["guar hydroxypropyltrimonium chloride", "polyquaternium-10", "polyquaternium-7", "sodium xylenesulfonate", "decyl glucoside", "coco-glucoside", "lauryl glucoside", "sodium cocoyl isethionate", "sodium lauroyl sarcosinate", "sodium cocoamphoacetate", "cocamidopropyl hydroxysultaine"], 0, "", []),
  I(["sodium bicarbonate", "baking soda", "sodium carbonate", "calcium carbonate", "magnesium hydroxide", "magnesium stearate"], 0, "", []),
  I(["histidine", "arginine", "lysine", "glycine", "biotin", "hydrolyzed keratin", "hydrolyzed wheat protein"], 0, "", []),
];

const exact = new Map<string, IngredientEntry>();
const prefixes: [string, IngredientEntry][] = [];
for (const e of INGREDIENTS) {
  for (const n of e.names) {
    if (n.endsWith("-")) prefixes.push([n, e]);
    else exact.set(n, e);
  }
}

export function findIngredient(name: string): IngredientEntry | null {
  const n = name.toLowerCase().trim();
  const hit = exact.get(n);
  if (hit) return hit;
  for (const [p, e] of prefixes) if (n.startsWith(p)) return e;
  return null;
}
