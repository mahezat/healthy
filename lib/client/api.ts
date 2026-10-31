"use client";

import type { Alternative, BoycottResult, HistoryItem, ScanResult } from "../types";

export class LockedError extends Error {}

export type ScanResponse =
  | { status: "found"; result: ScanResult }
  | { status: "needs_label"; draftId: string; missing: ("ingredients" | "nutrition")[]; preview: Preview }
  | { status: "not_found"; draftId: string; barcode: string }
  | { status: "needs_nutrition"; draftId: string; preview: Preview }
  | { status: "unreadable"; draftId: string; problem: string }
  | { status: "not_found_web" };

export interface Preview {
  name?: string;
  brand?: string;
  imageUrl?: string;
  category?: string;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/unlock") throw new LockedError(data.error ?? "Locked");
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data as T;
}

export const api = {
  scan: (barcode: string) => call<ScanResponse>("/api/scan", { body: { barcode } }),
  label: (body: { draftId?: string; barcode?: string; ingredientsImage?: string; nutritionImage?: string; skipNutrition?: boolean; useAvailable?: boolean }) =>
    call<ScanResponse>("/api/label", { body }),
  web: (body: { draftId?: string; barcode?: string }) => call<ScanResponse>("/api/web-lookup", { body }),
  product: (key: string) => call<ScanResult>(`/api/product?key=${encodeURIComponent(key)}`),
  company: (key: string) => call<BoycottResult>(`/api/company?key=${encodeURIComponent(key)}`),
  recheck: (key: string) => call<BoycottResult>("/api/company", { body: { key } }),
  alternatives: (key: string) => call<{ items: Alternative[]; note?: string }>(`/api/alternatives?key=${encodeURIComponent(key)}`),
  history: (q: Record<string, string> = {}) => call<HistoryItem[]>(`/api/history?${new URLSearchParams(q)}`),
  deleteHistory: (id: number) => call<{ deleted: boolean }>(`/api/history/${id}`, { method: "DELETE" }),
  unlock: (passcode: string) => call<{ unlocked: boolean }>("/api/unlock", { body: { passcode } }),
};

/** Keeps the last result in the tab so the Result screen opens instantly. */
export function rememberResult(r: ScanResult) {
  try {
    sessionStorage.setItem(`result:${r.key}`, JSON.stringify(r));
  } catch {
    /* storage full or blocked: the Result screen will fetch it */
  }
}

export function recallResult(key: string): ScanResult | null {
  try {
    const s = sessionStorage.getItem(`result:${key}`);
    return s ? (JSON.parse(s) as ScanResult) : null;
  } catch {
    return null;
  }
}
