// Food additive risk levels used for the 30% "additives" part of the food score.
// Levels follow Yuka's four steps (0 risk-free, 1 limited, 2 moderate, 3 high).
// These are OUR ratings, based on the agency positions cited in each entry.
// Yuka's own additive database is not public.
// Anything not listed here is rated by the AI (marked aiRated) and cached.

import type { Ref, RiskLevel } from "../types";

export interface AdditiveEntry {
  /** Group name shown when one entry covers several E-numbers. */
  label?: string;
  codes: string[];
  names: string[];
  level: RiskLevel;
  concern: string;
  refs: Ref[];
}

const IARC = "https://monographs.iarc.who.int/list-of-classifications";
const EU_ADD = "https://eur-lex.europa.eu/eli/reg/2008/1333/oj";
const EFSA = "https://www.efsa.europa.eu/en/topics/topic/food-additives";

const southampton: Ref = {
  org: "EU",
  note: "Must carry the warning 'may have an adverse effect on activity and attention in children'",
  url: EU_ADD,
};
const phosphates: Ref = { org: "EFSA", note: "2019 re-evaluation set a group intake limit; high phosphate intake is a concern for kidney and heart health", url: EFSA };
const emulsifierStudies: Ref = { org: "Studies", note: "Animal and observational studies link some emulsifiers to gut inflammation and heart disease risk" };
const aluminium: Ref = { org: "EFSA", note: "Dietary aluminium intake can exceed the tolerable weekly intake", url: EFSA };

const A = (codes: string[], names: string[], level: RiskLevel, concern: string, refs: Ref[], label?: string): AdditiveEntry => ({ codes, names, level, concern, refs, ...(label ? { label } : {}) });

export const ADDITIVES: AdditiveEntry[] = [
  // High risk
  A(["e171"], ["titanium dioxide"], 3, "Possible DNA damage; banned as a food additive in the EU since 2022", [
    { org: "EFSA", note: "2021: can no longer be considered safe as a food additive", url: "https://www.efsa.europa.eu/en/news/titanium-dioxide-e171-no-longer-considered-safe-when-used-food-additive" },
  ]),
  A(["e249", "e250"], ["potassium nitrite", "sodium nitrite"], 3, "Forms nitrosamines; linked to colorectal cancer in processed meat", [
    { org: "IARC", note: "Group 2A: ingested nitrite under conditions that form nitrosamines. Processed meat: Group 1", url: IARC },
  ], "Nitrites"),
  A(["e251", "e252"], ["sodium nitrate", "potassium nitrate"], 3, "Converted to nitrite in the body; can form nitrosamines", [
    { org: "IARC", note: "Group 2A: ingested nitrate under conditions that form nitrosamines", url: IARC },
  ], "Nitrates"),
  A(["e320"], ["butylated hydroxyanisole", "bha"], 3, "Possible carcinogen and endocrine disruptor", [
    { org: "IARC", note: "Group 2B: possibly carcinogenic to humans", url: IARC },
  ]),
  A(["e924"], ["potassium bromate"], 3, "Possible carcinogen; not allowed in EU food", [
    { org: "IARC", note: "Group 2B: possibly carcinogenic to humans", url: IARC },
  ]),
  A(["e127"], ["erythrosine", "red 3", "fd&c red no. 3", "red no. 3"], 3, "Caused thyroid tumors in male rats", [
    { org: "FDA", note: "January 2025: revoked authorization in food and ingested drugs" },
  ]),
  A(["e123"], ["amaranth", "red 2"], 3, "Banned in US food since 1976", [{ org: "FDA", note: "Banned in 1976" }]),
  A([], ["brominated vegetable oil", "bvo"], 3, "Bromine builds up in the body; FDA revoked approval in 2024", [
    { org: "FDA", note: "2024: no longer authorized in food", url: "https://www.fda.gov/food/food-additives-petitions/brominated-vegetable-oil-bvo" },
  ]),

  // Moderate risk
  A(["e102"], ["tartrazine", "yellow 5", "fd&c yellow no. 5"], 2, "Linked to hyperactivity in children", [southampton]),
  A(["e104"], ["quinoline yellow"], 2, "Linked to hyperactivity in children", [southampton]),
  A(["e110"], ["sunset yellow", "yellow 6", "fd&c yellow no. 6"], 2, "Linked to hyperactivity in children", [southampton]),
  A(["e122"], ["carmoisine", "azorubine"], 2, "Linked to hyperactivity in children", [southampton]),
  A(["e124"], ["ponceau 4r"], 2, "Linked to hyperactivity in children", [southampton]),
  A(["e129"], ["allura red", "red 40", "fd&c red no. 40"], 2, "Linked to hyperactivity in children", [southampton]),
  A(["e150c", "e150d"], ["ammonia caramel", "sulfite ammonia caramel", "caramel color", "caramel colour"], 2, "Can contain 4-MEI, a possible carcinogen", [
    { org: "IARC", note: "4-methylimidazole (4-MEI): Group 2B", url: IARC },
  ], "Caramel color (class III or IV)"),
  A(["e951"], ["aspartame"], 2, "Classified as possibly carcinogenic in 2023", [
    { org: "IARC", note: "July 2023: Group 2B", url: "https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment-results-released" },
    { org: "JECFA", note: "Kept the acceptable daily intake of 40 mg/kg body weight" },
  ]),
  A(["e955"], ["sucralose"], 2, "Lab studies raise questions about a breakdown product (sucralose-6-acetate) and gut bacteria", [
    { org: "Studies", note: "2023 lab study found sucralose-6-acetate damaged DNA in cells" },
  ]),
  A(["e952"], ["cyclamate", "sodium cyclamate"], 2, "Banned in the US since 1970", [{ org: "FDA", note: "Not allowed in US food" }]),
  A(["e210", "e211", "e212", "e213"], ["benzoic acid", "sodium benzoate", "potassium benzoate", "calcium benzoate"], 2, "Can form benzene with vitamin C; part of the hyperactivity study mix", [
    { org: "FDA", note: "Found benzene in some drinks combining benzoate and vitamin C" },
  ], "Benzoates"),
  A(["e220", "e221", "e222", "e223", "e224", "e225", "e226", "e227", "e228"], ["sulfur dioxide", "sodium sulfite", "sodium bisulfite", "sodium metabisulfite", "potassium metabisulfite", "calcium sulfite", "calcium bisulfite", "potassium bisulfite"], 2, "Can trigger asthma and intolerance reactions", [
    { org: "EU", note: "Must be declared as an allergen above 10 mg/kg", url: EU_ADD },
  ], "Sulfites"),
  A(["e310"], ["propyl gallate"], 2, "Possible endocrine disruptor; allergen", [{ org: "EFSA", note: "Re-evaluated with a low acceptable daily intake", url: EFSA }]),
  A(["e319"], ["tbhq", "tert-butylhydroquinone", "tertiary butylhydroquinone"], 2, "Animal studies raise immune system concerns", [{ org: "EFSA", note: "Low acceptable daily intake", url: EFSA }]),
  A(["e321"], ["butylated hydroxytoluene", "bht"], 2, "Possible endocrine disruptor", [{ org: "EFSA", note: "2012 re-evaluation set a low acceptable daily intake", url: EFSA }]),
  A(["e338", "e339", "e340", "e341", "e343", "e450", "e451", "e452"], ["phosphoric acid", "sodium phosphate", "potassium phosphate", "calcium phosphate", "magnesium phosphate", "diphosphates", "triphosphates", "polyphosphates", "sodium hexametaphosphate", "sodium tripolyphosphate", "disodium phosphate", "trisodium phosphate", "tetrasodium pyrophosphate", "sodium acid pyrophosphate"], 2, "Added phosphates; high intake strains kidneys and blood vessels", [phosphates], "Phosphates"),
  A(["e407", "e407a"], ["carrageenan", "processed eucheuma seaweed"], 2, "Animal studies link it to gut inflammation", [
    { org: "EFSA", note: "2018: kept it allowed but asked for more safety data", url: EFSA },
  ]),
  A(["e432", "e433", "e434", "e435", "e436"], ["polysorbate 20", "polysorbate 80", "polysorbate 40", "polysorbate 60", "polysorbate 65"], 2, "Emulsifier linked to gut inflammation in animal studies", [emulsifierStudies], "Polysorbates"),
  A(["e466"], ["carboxymethylcellulose", "cellulose gum", "sodium carboxymethylcellulose"], 2, "Emulsifier that changed gut bacteria in a human trial", [emulsifierStudies]),
  A(["e173"], ["aluminium", "aluminum"], 2, "Aluminium intake concern", [aluminium]),
  A(["e520", "e521", "e522", "e523", "e541", "e554", "e555", "e556", "e559"], ["aluminium sulfate", "sodium aluminium sulfate", "sodium aluminum phosphate", "sodium aluminium silicate", "sodium aluminosilicate", "potassium aluminium silicate", "calcium aluminium silicate", "aluminium silicate"], 2, "Contains aluminium", [aluminium], "Aluminium compounds"),
  A(["e131"], ["patent blue v"], 2, "Allergy reactions reported; not allowed in US food", [{ org: "EFSA", note: "Re-evaluated with a lowered acceptable daily intake", url: EFSA }]),
  A(["e151"], ["brilliant black bn", "black pn"], 2, "Not allowed in US food", [{ org: "EFSA", note: "Re-evaluated with a lowered acceptable daily intake", url: EFSA }]),
  A(["e927a"], ["azodicarbonamide"], 2, "Not allowed in EU food; breaks down into semicarbazide", [{ org: "EU", note: "Not authorized as a food additive", url: EU_ADD }]),

  // Limited risk
  A(["e950"], ["acesulfame potassium", "acesulfame k", "acesulfame"], 1, "Approved sweetener; long-term effects still studied", [{ org: "EFSA", note: "Approved in the EU", url: EFSA }]),
  A(["e954"], ["saccharin", "sodium saccharin"], 1, "Approved sweetener; may affect gut bacteria", [{ org: "IARC", note: "Group 3: not classifiable", url: IARC }]),
  A(["e968"], ["erythritol"], 1, "A 2023 observational study linked high blood levels to clotting risk", [{ org: "Studies", note: "Nature Medicine, 2023 (association, not proof)" }]),
  A(["e420", "e421", "e953", "e965", "e966", "e967"], ["sorbitol", "mannitol", "isomalt", "maltitol", "lactitol", "xylitol"], 1, "Laxative in large amounts", [{ org: "EU", note: "Must warn that excessive use may have a laxative effect", url: EU_ADD }], "Sugar alcohols"),
  A(["e202", "e203", "e280", "e281", "e282", "e283"], ["potassium sorbate", "calcium sorbate", "propionic acid", "sodium propionate", "calcium propionate", "potassium propionate"], 1, "Generally safe; rare intolerance", [{ org: "EFSA", note: "Approved preservative", url: EFSA }], "Sorbates and propionates"),
  A(["e235"], ["natamycin"], 1, "Antifungal; limited to surface treatment", [{ org: "EFSA", note: "Approved with use limits", url: EFSA }]),
  A(["e385"], ["calcium disodium edta", "disodium edta", "edta"], 1, "Binds minerals; generally safe at food levels", [{ org: "EFSA", note: "Approved with an acceptable daily intake", url: EFSA }]),
  A(["e120"], ["carmine", "cochineal", "carminic acid"], 1, "Can cause allergic reactions", [{ org: "FDA", note: "Must be named on the label because of allergy risk" }]),
  A(["e160b"], ["annatto", "bixin", "norbixin"], 1, "Rare allergic reactions", [{ org: "EFSA", note: "Approved with an acceptable daily intake", url: EFSA }]),
  A(["e132", "e133", "e142"], ["indigotine", "indigo carmine", "blue 2", "brilliant blue", "blue 1", "fd&c blue no. 1", "green s"], 1, "Synthetic dye; allergy reports", [{ org: "EFSA", note: "Approved with an acceptable daily intake", url: EFSA }], "Blue and green dyes"),
  A(["e150b"], ["caustic sulfite caramel"], 1, "Caramel color made with sulfites", [{ org: "EFSA", note: "Approved", url: EFSA }]),
  A(["e471", "e472a", "e472b", "e472c", "e472e", "e473", "e475", "e476", "e477", "e481", "e482", "e491", "e492"], ["mono- and diglycerides of fatty acids", "mono and diglycerides", "monoglycerides", "diglycerides", "datem", "sucrose esters", "polyglycerol polyricinoleate", "pgpr", "sodium stearoyl lactylate", "calcium stearoyl lactylate", "sorbitan monostearate", "sorbitan tristearate"], 1, "Emulsifier; observational studies link high emulsifier intake to heart disease", [emulsifierStudies], "Mono- and diglycerides and related emulsifiers"),
  A(["e621", "e620", "e622", "e623", "e624", "e625"], ["monosodium glutamate", "msg", "glutamic acid", "monopotassium glutamate"], 1, "Some people report sensitivity", [{ org: "EFSA", note: "2017: group acceptable daily intake of 30 mg/kg body weight", url: EFSA }], "Glutamates"),
  A(["e627", "e631", "e635"], ["disodium guanylate", "disodium inosinate", "disodium 5'-ribonucleotides"], 1, "Flavor enhancer; avoid with gout", [{ org: "EFSA", note: "Approved", url: EFSA }], "Ribonucleotides"),
  A(["e551"], ["silicon dioxide", "silica"], 1, "Nanoparticle safety not fully confirmed", [{ org: "EFSA", note: "2018: could not confirm safety for infants; more data requested", url: EFSA }]),
  A(["e900"], ["dimethylpolysiloxane", "dimethicone"], 1, "Anti-foaming agent; limited data", [{ org: "EFSA", note: "Approved", url: EFSA }]),
  A(["e1520"], ["propylene glycol"], 1, "Generally safe at food levels", [{ org: "EFSA", note: "Approved with an acceptable daily intake", url: EFSA }]),
  A(["e464", "e1442"], ["hydroxypropyl methylcellulose", "hypromellose", "hydroxypropyl distarch phosphate"], 1, "Generally safe", [{ org: "EFSA", note: "Approved", url: EFSA }]),
  A(["e442"], ["ammonium phosphatides"], 1, "Generally safe", [{ org: "EFSA", note: "Approved", url: EFSA }]),
  A(["e914"], ["oxidized polyethylene wax"], 1, "Fruit coating; limited data", [{ org: "EFSA", note: "Approved for surface treatment", url: EFSA }]),

  // Risk-free
  A(["e100"], ["curcumin", "turmeric"], 0, "", []),
  A(["e101"], ["riboflavin"], 0, "", []),
  A(["e140", "e141"], ["chlorophyll", "chlorophyllin"], 0, "", []),
  A(["e150a"], ["plain caramel"], 0, "", []),
  A(["e160a", "e160c", "e160d", "e160e", "e161b"], ["beta-carotene", "carotenes", "paprika extract", "lycopene", "lutein"], 0, "", []),
  A(["e162", "e163"], ["beetroot red", "betanin", "anthocyanins"], 0, "", []),
  A(["e170"], ["calcium carbonate"], 0, "", []),
  A(["e172"], ["iron oxides"], 0, "", []),
  A(["e200"], ["sorbic acid"], 0, "", []),
  A(["e234"], ["nisin"], 0, "", []),
  A(["e260", "e261", "e262", "e263"], ["acetic acid", "potassium acetate", "sodium acetate", "sodium diacetate", "calcium acetate"], 0, "", []),
  A(["e270", "e325", "e326", "e327"], ["lactic acid", "sodium lactate", "potassium lactate", "calcium lactate"], 0, "", []),
  A(["e290"], ["carbon dioxide"], 0, "", []),
  A(["e296", "e297"], ["malic acid", "fumaric acid"], 0, "", []),
  A(["e300", "e301", "e302", "e304"], ["ascorbic acid", "sodium ascorbate", "calcium ascorbate", "ascorbyl palmitate"], 0, "", []),
  A(["e306", "e307", "e308", "e309"], ["tocopherols", "mixed tocopherols", "alpha-tocopherol", "vitamin e"], 0, "", []),
  A(["e322"], ["lecithin", "lecithins", "soy lecithin", "sunflower lecithin"], 0, "", []),
  A(["e330", "e331", "e332", "e333"], ["citric acid", "sodium citrate", "potassium citrate", "calcium citrate"], 0, "", []),
  A(["e334", "e335", "e336", "e337"], ["tartaric acid", "sodium tartrate", "potassium tartrate", "cream of tartar"], 0, "", []),
  A(["e400", "e401", "e402", "e403", "e404", "e405"], ["alginic acid", "sodium alginate", "potassium alginate", "ammonium alginate", "calcium alginate", "propylene glycol alginate"], 0, "", []),
  A(["e406"], ["agar"], 0, "", []),
  A(["e410", "e412", "e413", "e414", "e415", "e416", "e417", "e418"], ["locust bean gum", "carob bean gum", "guar gum", "tragacanth", "gum arabic", "acacia gum", "xanthan gum", "karaya gum", "tara gum", "gellan gum"], 0, "", []),
  A(["e422"], ["glycerol", "glycerin", "glycerine"], 0, "", []),
  A(["e425"], ["konjac"], 0, "", []),
  A(["e440"], ["pectin", "pectins"], 0, "", []),
  A(["e460", "e461"], ["cellulose", "microcrystalline cellulose", "powdered cellulose", "methylcellulose"], 0, "", []),
  A(["e500", "e501", "e503", "e504"], ["sodium bicarbonate", "baking soda", "sodium carbonate", "potassium carbonate", "ammonium bicarbonate", "magnesium carbonate"], 0, "", []),
  A(["e508", "e509", "e511", "e516"], ["potassium chloride", "calcium chloride", "magnesium chloride", "calcium sulfate"], 0, "", []),
  A(["e524", "e525", "e526"], ["sodium hydroxide", "potassium hydroxide", "calcium hydroxide"], 0, "", []),
  A(["e552"], ["calcium silicate"], 0, "", []),
  A(["e901", "e903", "e904"], ["beeswax", "carnauba wax", "shellac"], 0, "", []),
  A(["e938", "e941", "e948"], ["argon", "nitrogen", "oxygen"], 0, "", []),
  A(["e960", "e960a"], ["steviol glycosides", "stevia", "rebaudioside a"], 0, "", []),
  A(["e1400", "e1404", "e1410", "e1412", "e1414", "e1420", "e1422", "e1440", "e1450"], ["modified starch", "modified food starch", "modified corn starch"], 0, "", []),
  A(["e1505"], ["triethyl citrate"], 0, "", []),
];

const byCode = new Map<string, AdditiveEntry>();
const byName = new Map<string, AdditiveEntry>();
for (const a of ADDITIVES) {
  for (const c of a.codes) byCode.set(c, a);
  for (const n of a.names) byName.set(n, a);
}

/** "en:e150c" / "E150c" / "e 150 c" -> "e150c" */
export function normalizeCode(raw: string): string | null {
  const m = raw.toLowerCase().replace(/^en:/, "").replace(/[\s\-()]/g, "").match(/^e(\d{3,4})([a-z]?|i{1,3}|iv|v)?$/);
  return m ? `e${m[1]}${m[2] ?? ""}` : null;
}

export function findAdditive(codeOrName: string): { entry: AdditiveEntry; code: string } | null {
  const code = normalizeCode(codeOrName);
  if (code) {
    const exact = byCode.get(code);
    if (exact) return { entry: exact, code };
    // e150 -> unknown class of caramel; e472 -> family
    const base = code.replace(/[a-z]+$/, "");
    const family = byCode.get(base) ?? [...byCode.entries()].find(([k]) => k.startsWith(base))?.[1];
    if (family) return { entry: family, code };
    return null;
  }
  const name = codeOrName.toLowerCase().trim();
  const hit = byName.get(name);
  if (hit) return { entry: hit, code: hit.codes[0] ?? "" };
  return null;
}

export function displayName(entry: AdditiveEntry, code?: string): string {
  const n = entry.codes.length > 1 && entry.label ? entry.label : entry.names[0];
  const pretty = n.charAt(0).toUpperCase() + n.slice(1);
  return code ? `${pretty} (${code.toUpperCase()})` : pretty;
}
