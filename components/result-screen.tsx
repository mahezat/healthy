"use client";

// Screen 4: Result (from the Stitch design), wired to /api/product, /api/company and /api/alternatives.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, LockedError, recallResult, rememberResult } from "@/lib/client/api";
import { BAND, FLAGGED, RISK, SOURCE_LABEL, boycottTone, categoryLabel, shortDate } from "@/lib/client/format";
import type { Alternative, BoycottResult, NutritionComponent, OwnershipStep, RatedIngredient, ScanResult } from "@/lib/types";
import { LabelSheet, type LabelStart } from "./label-sheet";
import { Icon, Spinner, UnlockSheet } from "./ui";

const display = { fontFamily: "var(--font-display)" } as const;
const kicker = "text-[10px] uppercase font-semibold text-brand-lavender/80 tracking-[0.22em]";

export function ResultScreen() {
  const params = useSearchParams();
  const key = params.get("key");
  const barcode = params.get("barcode");
  // Remount when the product changes so all state starts fresh.
  return <ResultView barcode={barcode} key={`${key}|${barcode}`} pkey={key} />;
}

function ResultView({ pkey: key, barcode }: { pkey: string | null; barcode: string | null }) {
  const router = useRouter();
  const [result, setResult] = useState<ScanResult | null>(() => (key ? recallResult(key) : null));
  const [error, setError] = useState(key || barcode ? "" : "No product selected.");
  const [locked, setLocked] = useState(false);
  const [reload, setReload] = useState(0);
  const [label, setLabel] = useState<LabelStart | null>(null);
  const [alts, setAlts] = useState<{ items: Alternative[]; note?: string } | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const loaded = useRef(!!result);

  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof LockedError) setLocked(true);
      else setError((e as Error).message);
    }
  }, []);

  // Load the product.
  useEffect(() => {
    if (loaded.current) return;
    if (key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- network request; state changes after it resolves
      guard(() => api.product(key)).then((r) => {
        if (r) {
          loaded.current = true;
          setResult(r);
        }
      });
    } else if (barcode) {
      guard(() => api.scan(barcode)).then((res) => {
        if (!res) return;
        loaded.current = true;
        if (res.status === "found") {
          rememberResult(res.result);
          router.replace(`/result?key=${encodeURIComponent(res.result.key)}`);
        } else if (res.status === "not_found") setLabel({ kind: "not_found", draftId: res.draftId, barcode: res.barcode });
        else if (res.status === "needs_label") setLabel({ kind: "needs_label", draftId: res.draftId, missing: res.missing, name: res.preview.name });
      });
    }
  }, [key, barcode, guard, router, reload]);

  // Second step: AI company check, then alternatives.
  const rkey = result?.key;
  const pending = result?.boycott.deepCheck === "pending";
  const wantAlts = result?.showAlternatives;
  useEffect(() => {
    if (!rkey || !pending) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- network request; state changes after it resolves
    guard(() => api.company(rkey)).then((b) => b && setResult((r) => (r ? withBoycott(r, b) : r)));
  }, [rkey, pending, guard, reload]);
  useEffect(() => {
    if (!rkey || pending || !wantAlts) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- network request; state changes after it resolves
    guard(() => api.alternatives(rkey)).then((a) => a && setAlts(a));
  }, [rkey, pending, wantAlts, guard, reload]);
  useEffect(() => {
    if (result) rememberResult(result);
  }, [result]);

  const recheck = async () => {
    if (!result) return;
    setRechecking(true);
    const b = await guard(() => api.recheck(result.key));
    if (b) setResult((r) => (r ? withBoycott(r, b) : r));
    setRechecking(false);
  };

  const share = async () => {
    if (!result) return;
    const text = `${result.name}: health ${result.health.score}/100 (${BAND[result.health.band].label}). Boycott check: ${result.boycott.headline}.`;
    try {
      if (navigator.share) await navigator.share({ title: result.name, text });
      else await navigator.clipboard.writeText(text);
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-white/10 pt-safe">
        <div className="h-14 px-4 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button aria-label="Go back" className="w-9 h-9 rounded flex items-center justify-center bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all border border-white/10" onClick={() => (history.length > 1 ? router.back() : router.push("/"))} type="button">
              <Icon name="arrow_back" className="text-[19px]" />
            </button>
            <span className="font-bold text-base text-white tracking-[0.05em]" style={display}>
              Product evaluation
            </span>
          </div>
          {result && (
            <button aria-label="Share result" className="w-9 h-9 rounded flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10" onClick={share} type="button">
              <Icon name="share" className="text-[18px]" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 pt-20 pb-36 w-full max-w-lg mx-auto">
        {!result && !error && !label && (
          <div className="px-5 py-10 flex items-center gap-3 text-on-surface-variant text-[14px]">
            <Spinner className="text-[20px] text-brand-lavender" /> Loading
          </div>
        )}
        {error && !result && <p className="px-5 py-10 text-[14px] text-flag-crimson-soft">{error}</p>}
        {result && <Body alts={alts} onRecheck={recheck} r={result} rechecking={rechecking} />}
      </main>

      <footer className="fixed bottom-0 inset-x-0 z-50 bg-surface/95 backdrop-blur-xl border-t border-white/10 pb-safe">
        <div className="max-w-md mx-auto flex items-stretch h-14">
          <button aria-label="Scroll to top" className="w-14 h-full text-white flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all flex-shrink-0 border-r border-white/10" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} type="button">
            <Icon name="arrow_upward" className="text-[20px]" />
          </button>
          <Link className="flex-1 h-full bg-brand-lavender text-brand-dark text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-lavender-light active:scale-[0.98] transition-all px-4 tracking-[0.04em]" href="/" style={display}>
            <Icon name="photo_camera" className="text-[20px]" />
            Scan next product
          </Link>
          <Link aria-label="History" className="w-14 h-full text-white flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all flex-shrink-0 border-l border-white/10" href="/history">
            <Icon name="history" className="text-[20px]" />
          </Link>
        </div>
      </footer>

      {label && (
        <LabelSheet
          onClose={() => {
            setLabel(null);
            if (!result) router.push("/");
          }}
          onDone={(r) => {
            setLabel(null);
            rememberResult(r);
            router.replace(`/result?key=${encodeURIComponent(r.key)}`);
          }}
          onLocked={() => setLocked(true)}
          start={label}
        />
      )}
      {locked && (
        <UnlockSheet
          onUnlocked={() => {
            setLocked(false);
            setError("");
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function withBoycott(r: ScanResult, b: BoycottResult): ScanResult {
  return { ...r, boycott: b, showAlternatives: r.health.score < 50 || FLAGGED.includes(b.status) || b.status === "ai_found" };
}

function Body({ r, alts, onRecheck, rechecking }: { r: ScanResult; alts: { items: Alternative[]; note?: string } | null; onRecheck: () => void; rechecking: boolean }) {
  const h = r.health;
  const b = r.boycott;
  const band = BAND[h.band];
  const tone = boycottTone(b.status);
  const owner = [...b.chain].reverse().find((s) => s.relation !== "brand")?.name;
  const grade = h.food?.nutriScore.grade;

  return (
    <>
      {/* 1. Product hero */}
      <section className="px-5 pt-3 pb-6 flex items-start gap-4">
        <div className="relative w-20 h-24 overflow-hidden flex-shrink-0 bg-white/5 border border-white/10">
          {r.imageUrl ? <img alt="" className="w-full h-full object-cover" src={r.imageUrl} /> : <div className="w-full h-full flex items-center justify-center text-white/30"><Icon name="photo_camera" /></div>}
        </div>
        <div className="flex-1 min-w-0 pl-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={kicker}>{categoryLabel(r)}</span>
            <span className="text-white/30 text-xs">|</span>
            {r.sourceUrl ? (
              <a className="text-[10px] font-medium text-white/80 flex items-center gap-1.5 uppercase tracking-[0.15em]" href={r.sourceUrl} rel="noopener noreferrer" target="_blank">
                <span className="w-1.5 h-1.5 bg-emerald-400" />
                {SOURCE_LABEL[r.source]}
              </a>
            ) : (
              <span className="text-[10px] font-medium text-white/80 flex items-center gap-1.5 uppercase tracking-[0.15em]">
                <span className="w-1.5 h-1.5 bg-emerald-400" />
                {SOURCE_LABEL[r.source]}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-[-0.02em] leading-snug" style={display}>
            {r.name}
          </h1>
          {(r.brand || owner) && (
            <p className="mt-1 text-[11px] text-on-surface-variant leading-relaxed uppercase tracking-[0.14em]">
              {r.brand && <>By {r.brand}</>}
              {r.brand && owner && " • "}
              {owner && <span className="text-white/80 font-medium">{owner}</span>}
            </p>
          )}
          {r.sourceNote && <p className="mt-1 text-[11px] text-on-surface-variant">{r.sourceNote}</p>}
        </div>
      </section>

      {/* 2. Verdict banner */}
      <section className="w-full px-5 py-3 border-y border-white/10 bg-white/5">
        <div className="grid grid-cols-2 divide-x divide-white/10 items-stretch">
          <div className="pr-4">
            <span className={`${kicker} block`}>Health score</span>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="text-3xl font-extrabold tracking-tight leading-none text-white" style={display}>
                {h.score}
              </span>
              <span className={`text-[11px] font-semibold border-b pb-0.5 ${band.text} ${band.border}`}>
                {band.label}
                {grade ? ` (Nutri-Score ${grade.toUpperCase()})` : ""}
              </span>
            </div>
            <span className="text-xs text-on-surface-variant block mt-1.5 leading-snug">{healthLine(r)}</span>
            {h.partial && <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 border-b border-amber-400">Partial score</span>}
          </div>
          <div className="pl-4">
            <span className={`${kicker} block`}>Boycott check</span>
            <div className="flex items-center gap-1.5 mt-1">
              {b.status === "checking" ? <Spinner className="text-[14px] text-brand-lavender" /> : <span className={`w-2 h-2 ${tone.dot}`} />}
              <span className={`text-sm font-bold ${tone.text}`}>{b.headline}</span>
            </div>
            <span className="text-xs text-on-surface-variant block mt-1.5 leading-snug">{b.reason}</span>
          </div>
        </div>
      </section>

      {r.showAlternatives && (
        <div className="px-5 py-2.5 flex items-center justify-between border-b border-white/10">
          <span className="text-xs text-on-surface-variant">Want something better on both counts?</span>
          <a className="text-xs font-semibold text-brand-lavender flex items-center gap-1 hover:underline tracking-tight" href="#alternatives">
            Browse alternatives <Icon name="arrow_forward" className="text-sm" />
          </a>
        </div>
      )}

      {/* 3. Details */}
      <section className="divide-y divide-white/10">
        {h.food && h.food.nutrition.length > 0 && (
          <Details icon="spa" open sub={h.food.nutriScore.isBeverage ? "Per 100 ml" : "Per 100 g"} title="Nutritional breakdown">
            <Nutrition items={h.food.nutrition} />
          </Details>
        )}

        {h.method === "food" ? (
          <Details icon="biotech" sub={additivesSub(h.food?.additives ?? [])} title="Additives">
            <IngredientList empty="No additives found." items={h.food?.additives ?? []} />
            <div className="pt-2.5 text-xs text-on-surface-variant flex items-center justify-between border-t border-white/10">
              <span>Organic certification</span>
              <span className="font-medium text-white">{h.food?.organic ? "Yes" : "None"}</span>
            </div>
            <Notes notes={h.notes} />
          </Details>
        ) : (
          <Details icon="biotech" open sub={additivesSub(h.ingredients ?? [], "ingredient")} title="Ingredients">
            <IngredientList empty="No ingredient list." items={h.ingredients ?? []} />
            <Notes notes={h.notes} />
          </Details>
        )}

        <Details icon="verified_user" iconClass="text-flag-crimson-soft" sub="Who owns it and who lists it" title="Ownership and boycott records">
          <Boycott b={b} onRecheck={onRecheck} rechecking={rechecking} />
        </Details>
      </section>

      {/* 4. Alternatives */}
      {r.showAlternatives && (
        <section className="mt-8 pt-4 border-t border-white/10" id="alternatives">
          <div className="px-5 mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight" style={display}>
                Clean alternatives
              </h2>
              <p className="text-xs text-on-surface-variant">Healthier, and clear on every boycott check</p>
            </div>
            {alts && alts.items.length > 0 && (
              <span className="text-[10px] font-semibold text-brand-lavender border-b border-brand-lavender pb-0.5 uppercase tracking-[0.2em]">
                {alts.items.length} option{alts.items.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {!alts && (
            <p className="px-5 pb-4 text-xs text-on-surface-variant flex items-center gap-2">
              <Spinner className="text-[16px]" /> Finding products that pass both checks
            </p>
          )}
          {alts && alts.items.length === 0 && <p className="px-5 pb-4 text-xs text-on-surface-variant">{alts.note ?? "No alternative passes both checks yet."}</p>}
          {alts && alts.items.length > 0 && (
            <div className="flex overflow-x-auto gap-3 px-5 pb-4 snap-x snap-mandatory">
              {alts.items.map((a) => (
                <Link className="snap-start flex-shrink-0 w-64 bg-white/5 border border-white/10 p-3 flex flex-col justify-between" href={`/result?barcode=${a.barcode}`} key={a.key}>
                  <div>
                    <div className="relative w-full h-32 overflow-hidden mb-3 bg-black/20 border border-white/10">
                      {a.imageUrl && <img alt="" className="w-full h-full object-cover" src={a.imageUrl} />}
                    </div>
                    {a.brand && <span className="text-[11px] font-semibold text-brand-lavender/80 uppercase tracking-wider block truncate">{a.brand}</span>}
                    <h3 className="text-sm font-bold text-white truncate leading-tight" style={display}>
                      {a.name}
                    </h3>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-extrabold text-white">{a.score}</span>
                      <span className={`text-[11px] font-semibold border-b pb-0.5 ${BAND[a.band].text} ${BAND[a.band].border}`}>{BAND[a.band].label}</span>
                    </div>
                    <span className="text-xs font-semibold text-brand-lavender flex items-center gap-0.5">
                      Full result <Icon name="arrow_forward" className="text-xs" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function healthLine(r: ScanResult): string {
  const h = r.health;
  if (h.method === "food") {
    const worst = (h.food?.nutrition ?? [])
      .filter((c) => c.kind === "negative" && c.pointsMax > 0 && c.points / c.pointsMax >= 0.5 && c.id !== "non_nutritive_sweeteners")
      .sort((a, b) => b.points / b.pointsMax - a.points / a.pointsMax)[0];
    const high = h.food?.additives.find((a) => a.level === 3);
    if (high) return `Contains ${high.name.toLowerCase()}`;
    if (worst) return `High in ${worst.label.toLowerCase()}`;
    if (h.food?.nutriScore.origin === "missing") return "No nutrition facts";
    return h.score >= 50 ? "Balanced nutrition" : "Nutrition holds it back";
  }
  const worst = h.ingredients?.[0];
  if (!worst || worst.level === 0) return "No risky ingredients found";
  return `${worst.name}: ${worst.concern.toLowerCase()}`;
}

function additivesSub(items: RatedIngredient[], word = "additive"): string {
  if (!items.length) return `No ${word}s found`;
  const high = items.filter((i) => i.level === 3).length;
  const mod = items.filter((i) => i.level === 2).length;
  const parts = [high && `${high} high risk`, mod && `${mod} moderate`].filter(Boolean).join(", ");
  return `${items.length} ${word}${items.length > 1 ? "s" : ""}${parts ? ` (${parts})` : ""}`;
}

function Details({ icon, iconClass = "text-brand-lavender", title, sub, open, children }: { icon: string; iconClass?: string; title: string; sub: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="group" open={open}>
      <summary className="w-full px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors select-none">
        <div className="flex items-center gap-3">
          <Icon name={icon} className={`text-xl ${iconClass}`} />
          <div className="text-left">
            <span className="text-sm font-bold text-white block" style={display}>
              {title}
            </span>
            <span className="text-xs text-on-surface-variant block">{sub}</span>
          </div>
        </div>
        <Icon name="expand_more" className="text-white/50 transition-transform group-open:rotate-180 text-xl" />
      </summary>
      <div className="px-5 pb-5 pt-1 space-y-3">{children}</div>
    </details>
  );
}

function fmt(c: NutritionComponent): string {
  if (c.value === null || c.value === undefined) return "Not listed";
  if (c.id === "non_nutritive_sweeteners") return c.value ? "Yes" : "None";
  if (c.unit === "kJ") return `${Math.round(c.value / 4.184)} kcal (${Math.round(c.value)} kJ)`;
  const v = c.value < 1 ? c.value.toFixed(2) : c.value < 10 ? c.value.toFixed(1) : Math.round(c.value).toString();
  return `${v} ${c.unit}`;
}

function Nutrition({ items }: { items: NutritionComponent[] }) {
  const neg = items.filter((c) => c.kind === "negative");
  const pos = items.filter((c) => c.kind === "positive");
  return (
    <div className="space-y-4">
      {neg.map((c) => {
        const ratio = c.pointsMax ? c.points / c.pointsMax : 0;
        const bad = ratio >= 0.5;
        return (
          <div key={c.id}>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-white/90 font-medium">{c.label}</span>
              <span className={`font-semibold ${bad ? "text-flag-crimson-soft" : "text-brand-lavender"}`}>{fmt(c)}</span>
            </div>
            <div className="w-full bg-white/10 h-1.5">
              <div className={`h-full ${bad ? "bg-flag-crimson-soft" : "bg-brand-lavender"}`} style={{ width: `${Math.max(3, ratio * 100)}%` }} />
            </div>
          </div>
        );
      })}
      {pos.length > 0 && (
        <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-2 text-xs text-on-surface-variant flex-wrap">
          {pos.map((c) => (
            <span key={c.id}>
              {c.label}: <strong className="text-white font-medium">{fmt(c)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function IngredientList({ items, empty }: { items: RatedIngredient[]; empty: string }) {
  if (!items.length) return <p className="text-xs text-on-surface-variant">{empty}</p>;
  return (
    <div>
      {items.map((i, n) => {
        const risk = RISK[i.level];
        return (
          <details className="group/i py-2.5 border-b border-white/10 last:border-b-0" key={`${i.name}-${n}`}>
            <summary className="flex items-start justify-between cursor-pointer">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block">
                  {i.code && !i.name.toLowerCase().includes(i.code) ? `${i.code.toUpperCase()} • ` : ""}
                  {i.name}
                </span>
                {i.concern && <span className="text-[11px] text-on-surface-variant">{i.concern}</span>}
              </div>
              <span className={`text-[10px] font-semibold border-b uppercase tracking-wider ml-2 flex-shrink-0 ${risk.text} ${risk.border}`}>{i.unknown ? "Not rated" : risk.label}</span>
            </summary>
            {(i.refs.length > 0 || i.aiRated) && (
              <div className="mt-2 space-y-1 text-[11px] text-on-surface-variant">
                {i.refs.map((ref, k) => (
                  <p key={k}>
                    <strong className="text-white/90 font-medium">{ref.org}:</strong> {ref.note}
                    {ref.url && (
                      <>
                        {" "}
                        (<a className="text-brand-lavender underline" href={ref.url} rel="noopener noreferrer" target="_blank">source</a>)
                      </>
                    )}
                  </p>
                ))}
                {i.aiRated && <p>Rated by AI from agency positions; not in our checked list yet.</p>}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div className="pt-2.5 border-t border-white/10 space-y-1">
      {notes.map((n) => (
        <p className="text-[11px] text-on-surface-variant" key={n}>
          {n}
        </p>
      ))}
    </div>
  );
}

const RELATION: Record<OwnershipStep["relation"], string> = { brand: "Brand", owner: "Owner", parent: "Parent company" };

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Boycott({ b, onRecheck, rechecking }: { b: BoycottResult; onRecheck: () => void; rechecking: boolean }) {
  const listed = new Set(b.listings.map((l) => l.entity.toLowerCase()));
  const isListed = (name: string) => [...listed].some((e) => e === name.toLowerCase() || e.includes(name.toLowerCase()) || name.toLowerCase().includes(e));
  return (
    <div className="space-y-4">
      {b.chain.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-brand-lavender uppercase tracking-wider block mb-2">Ownership</span>
          <div className="space-y-1.5 text-xs">
            {b.chain.map((s, i) => {
              const flagged = isListed(s.name);
              return (
                <div className="flex items-center justify-between py-1 border-b border-white/10 last:border-b-0" key={`${s.name}-${i}`}>
                  <span className={flagged ? "text-flag-crimson-soft font-semibold" : "text-white/90"}>
                    {i + 1}. {s.name}
                  </span>
                  {flagged ? (
                    <span className="text-[10px] font-semibold text-flag-crimson border-b border-flag-crimson uppercase tracking-wider">Listed</span>
                  ) : (
                    <span className="text-on-surface-variant">{RELATION[s.relation]}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-white/10 space-y-2">
        <span className="text-xs font-semibold text-brand-lavender uppercase tracking-wider block">Boycott lists</span>
        {b.listings.length === 0 ? (
          <p className="text-xs text-on-surface-variant">Not on BDS, Who Profits, the UN database, AFSC Investigate or Ethical Consumer.</p>
        ) : (
          <div className="text-xs leading-relaxed text-on-surface-variant space-y-2">
            {b.listings.map((l, i) => (
              <p key={i}>
                • <strong className="text-white font-medium">{l.list}</strong>
                {l.via && l.via !== "Brand" ? ` (${l.via.toLowerCase()} ${l.entity})` : ""}: {l.says}
                {l.url && (
                  <>
                    {" "}
                    (<a className="text-brand-lavender underline" href={l.url} rel="noopener noreferrer" target="_blank">{host(l.url)}</a>)
                  </>
                )}
              </p>
            ))}
          </div>
        )}
      </div>

      {(b.aiFindings.length > 0 || b.deepCheck === "done") && (
        <div className="pt-2 border-t border-white/10 space-y-2">
          <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block">AI found</span>
          {b.aiFindings.length === 0 ? (
            <p className="text-xs text-on-surface-variant">AI research found no sourced links to the occupation or the Israeli military.</p>
          ) : (
            <div className="text-xs leading-relaxed text-on-surface-variant space-y-2">
              {b.aiFindings.map((f, i) => (
                <p key={i}>
                  • {f.claim}{" "}
                  {f.sources.map((s, k) => (
                    <a className="text-brand-lavender underline mr-1" href={s.url} key={k} rel="noopener noreferrer" target="_blank">
                      {host(s.url)}
                    </a>
                  ))}
                </p>
              ))}
              <p className="text-[11px]">Found by AI web research. Check the sources before acting on it.</p>
            </div>
          )}
        </div>
      )}

      <div className="pt-2 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs text-on-surface-variant">
          {b.deepCheck === "pending" || b.status === "checking" ? "Checking the company" : b.deepCheck === "failed" ? "AI check failed" : `Checked ${shortDate(b.checkedAt)}`}
        </span>
        <button className="px-3 py-1 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-all border border-white/15 disabled:opacity-60" disabled={rechecking || b.status === "checking"} onClick={onRecheck} type="button">
          <Icon name="sync" className={`text-sm ${rechecking ? "animate-spin" : ""}`} />
          {rechecking ? "Checking" : "Recheck"}
        </button>
      </div>
    </div>
  );
}
