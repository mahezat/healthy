"use client";

// History (not designed in Stitch yet): reuses the Scan screen's "recent scans" rows.

import { useCallback, useEffect, useState } from "react";
import { api, LockedError } from "@/lib/client/api";
import type { HistoryItem } from "@/lib/types";
import { BottomNav, Icon, ScanRow, UnlockSheet } from "./ui";

const FILTERS: { label: string; q: Record<string, string> }[] = [
  { label: "All", q: {} },
  { label: "Food", q: { category: "food" } },
  { label: "Cosmetics", q: { category: "cosmetics" } },
  { label: "Household", q: { category: "household" } },
  { label: "Other", q: { category: "other" } },
  { label: "Flagged only", q: { flagged: "1" } },
  { label: "Score under 50", q: { under50: "1" } },
];

export function HistoryScreen() {
  const [filter, setFilter] = useState(0);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api.history({ ...FILTERS[filter].q, ...(q ? { q } : {}), limit: "100" }));
    } catch (e) {
      if (e instanceof LockedError) setLocked(true);
      else setError((e as Error).message);
    }
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const remove = async (id: number) => {
    setItems((list) => list?.filter((i) => i.id !== id) ?? null);
    await api.deleteHistory(id).catch(() => load());
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/80 backdrop-blur-xl pt-safe border-b border-white/10">
        <div className="h-14 px-5 flex items-center max-w-lg mx-auto">
          <span className="font-bold text-[18px] text-white tracking-tight">history</span>
        </div>
      </header>
      <main className="w-full max-w-lg mx-auto pt-16 pb-24 px-5">
        <label className="flex items-center gap-2 h-11 px-3 bg-white/5 border border-white/10 mt-2">
          <Icon name="search" className="text-[18px] text-white/50" />
          <input className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-white/40" onChange={(e) => setQ(e.target.value)} placeholder="Search by name or brand" value={q} />
        </label>
        <div className="flex gap-2 overflow-x-auto py-3 -mx-5 px-5">
          {FILTERS.map((f, i) => (
            <button
              className={`flex-shrink-0 px-3 py-1.5 text-[12px] font-semibold border ${i === filter ? "bg-brand-lavender text-brand-dark border-brand-lavender" : "bg-white/5 text-white/80 border-white/10"}`}
              key={f.label}
              onClick={() => setFilter(i)}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
        {error && <p className="text-[13px] text-flag-crimson-soft">{error}</p>}
        <div className="divide-y divide-white/10 border-t border-white/10">
          {items === null && !error && <p className="py-4 text-[13px] text-white/50">Loading</p>}
          {items?.length === 0 && <p className="py-4 text-[13px] text-white/50">Nothing here yet.</p>}
          {items?.map((h) => <ScanRow item={h} key={h.id} onDelete={() => remove(h.id)} />)}
        </div>
      </main>
      <BottomNav active="history" />
      {locked && (
        <UnlockSheet
          onUnlocked={() => {
            setLocked(false);
            load();
          }}
        />
      )}
    </div>
  );
}
