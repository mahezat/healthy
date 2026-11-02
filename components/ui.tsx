"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { BAND, FLAGGED, categoryName, timeAgo } from "@/lib/client/format";
import type { HistoryItem } from "@/lib/types";

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={`material-symbols-outlined ${className}`}>
      {name}
    </span>
  );
}

/** Bottom sheet in the style of the Scan screen's camera-permission helper. */
export function Sheet({ title, icon, onClose, children }: { title: string; icon: string; onClose?: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg mx-auto bg-surface-container-low text-white p-5 pb-8 border-t border-white/20 shadow-2xl pb-safe" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 text-brand-lavender">
            <Icon name={icon} className="text-[20px]" />
            <h3 className="font-bold text-[17px]">{title}</h3>
          </div>
          {onClose && (
            <button aria-label="Close" className="p-1 text-white/60 hover:text-white" onClick={onClose} type="button">
              <Icon name="close" className="text-[20px]" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button className="w-full h-11 bg-white text-indigo-deep font-bold text-[14px] disabled:opacity-60" disabled={disabled} onClick={onClick} type={type}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button className="w-full h-11 bg-white/10 border border-white/15 text-white font-semibold text-[14px] disabled:opacity-60" disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Icon name="sync" className={`animate-spin ${className}`} />;
}

export function UnlockSheet({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Enter your passcode" icon="lock">
      <form
        className="flex flex-col gap-3 mt-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api.unlock(code);
            onUnlocked();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-[13px] text-on-surface-variant">This app is locked so only you can use it. You only need to do this once on this phone.</p>
        <input
          autoFocus
          className="h-11 px-3 bg-surface border border-white/15 text-white text-[15px] outline-none focus:border-brand-lavender"
          onChange={(e) => setCode(e.target.value)}
          placeholder="Passcode"
          type="password"
          value={code}
        />
        {error && <p className="text-[13px] text-flag-crimson-soft">{error}</p>}
        <PrimaryButton disabled={!code || busy} type="submit">
          {busy ? "Checking" : "Unlock"}
        </PrimaryButton>
      </form>
    </Sheet>
  );
}

/** One row of the "recent scans" list. */
export function ScanRow({ item, onDelete }: { item: HistoryItem; onDelete?: () => void }) {
  const flagged = FLAGGED.includes(item.boycottStatus);
  const band = BAND[item.band];
  return (
    <div className="py-3.5 flex items-center justify-between gap-3 active:bg-white/[0.03] transition-colors">
      <Link className="flex items-center gap-3 min-w-0 flex-1" href={`/result?key=${encodeURIComponent(item.key)}`}>
        <div className="relative w-12 h-12 overflow-hidden bg-white flex-shrink-0 border border-white/10">
          {item.imageUrl ? <img alt="" className="w-full h-full object-cover" src={item.imageUrl} /> : <div className="w-full h-full bg-white/10" />}
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="font-bold text-[15px] text-white truncate">{item.name}</h3>
          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
            <span className="text-brand-lavender/80">{item.brand || categoryName(item.category)}</span>
            <span className="text-white/20 text-[10px]">•</span>
            <span className="text-white/60">{timeAgo(item.scannedAt)}</span>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {flagged ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border text-[11px] font-bold bg-rose-500/20 text-rose-200 border-rose-500/30">
            <span className="w-1.5 h-1.5 bg-rose-400" />
            {item.score} Flagged
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-[11px] font-bold ${band.chip}`}>
            <span className={`w-1.5 h-1.5 ${band.dot}`} />
            {item.score} {band.label}
          </span>
        )}
        {onDelete ? (
          <button aria-label={`Delete ${item.name}`} className="p-1 text-white/40 hover:text-white" onClick={onDelete} type="button">
            <Icon name="delete" className="text-[18px]" />
          </button>
        ) : (
          <Icon name="chevron_right" className="text-[18px] text-white/40" />
        )}
      </div>
    </div>
  );
}

export function BottomNav({ active }: { active: "scan" | "history" }) {
  const item = (key: "scan" | "history", href: string, icon: string, label: string) => {
    const on = active === key;
    return (
      <Link
        aria-current={on ? "page" : undefined}
        className={`h-16 relative flex flex-col items-center justify-center gap-1 font-medium border-t-2 -mt-[1px] ${on ? "border-accent-lime text-accent-lime" : "border-transparent text-white/50 hover:text-white"}`}
        href={href}
      >
        <Icon name={icon} className="text-[20px]" />
        <span className="text-[11px] font-bold">{label}</span>
      </Link>
    );
  };
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface/95 backdrop-blur-xl border-t border-white/15">
      <div className="grid grid-cols-2 h-16 w-full max-w-md mx-auto px-4">
        {item("scan", "/", "photo_camera", "Scan")}
        {item("history", "/history", "history", "History")}
      </div>
    </nav>
  );
}
