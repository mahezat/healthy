"use client";

// Screen 1: Scan (from the Stitch design), wired to /api/scan, /api/label and /api/history.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, LockedError, rememberResult } from "@/lib/client/api";
import { APP_NAME } from "@/lib/client/format";
import type { HistoryItem, ScanResult } from "@/lib/types";
import { LabelSheet, type LabelStart } from "./label-sheet";
import { BottomNav, Icon, PrimaryButton, ScanRow, Sheet, Spinner, UnlockSheet } from "./ui";

type Cam = "starting" | "on" | "denied" | "unavailable";
interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

async function makeDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (native) {
    const supported = await native.getSupportedFormats().catch(() => [] as string[]);
    if (supported.includes("ean_13")) return new native({ formats: FORMATS.filter((f) => supported.includes(f)) });
  }
  const mod = await import("barcode-detector/ponyfill");
  mod.prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/wasm/zxing_reader.wasm" : prefix + path) },
  });
  return new mod.BarcodeDetector({ formats: FORMATS as never[] }) as unknown as Detector;
}

export function ScanScreen() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const paused = useRef(false);
  const lastCode = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const [cam, setCam] = useState<Cam>("starting");
  const [torch, setTorch] = useState<boolean | null>(null); // null = not supported
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const [label, setLabel] = useState<LabelStart | null>(null);
  const [locked, setLocked] = useState(false);
  const [recent, setRecent] = useState<HistoryItem[] | null>(null);
  const [typed, setTyped] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  useEffect(() => {
    paused.current = !!checking || !!label || help || locked;
  }, [checking, label, help, locked]);

  const loadRecent = useCallback(async () => {
    try {
      setRecent(await api.history({ limit: "3" }));
    } catch (e) {
      if (e instanceof LockedError) setLocked(true);
      else setRecent([]);
    }
  }, []);

  const open = useCallback(
    (r: ScanResult) => {
      rememberResult(r);
      router.push(`/result?key=${encodeURIComponent(r.key)}`);
    },
    [router],
  );

  const scan = useCallback(
    async (code: string) => {
      setChecking(code);
      setError("");
      navigator.vibrate?.(30);
      try {
        const res = await api.scan(code);
        if (res.status === "found") return open(res.result);
        if (res.status === "not_found") setLabel({ kind: "not_found", draftId: res.draftId, barcode: res.barcode });
        else if (res.status === "needs_label") setLabel({ kind: "needs_label", draftId: res.draftId, missing: res.missing, name: res.preview.name });
      } catch (e) {
        if (e instanceof LockedError) {
          setPendingCode(code);
          setLocked(true);
        } else setError((e as Error).message);
      } finally {
        setChecking(null);
      }
    },
    [open],
  );

  // Camera and barcode detection.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setCam("unavailable");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e) {
        setCam((e as Error).name === "NotAllowedError" ? "denied" : "unavailable");
        if ((e as Error).name === "NotAllowedError") setHelp(true);
        return;
      }
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      track.current = stream.getVideoTracks()[0] ?? null;
      const caps = (track.current?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorch(caps.torch ? false : null);
      setCam("on");

      const detector = await makeDetector().catch(() => null);
      if (!detector) return setCam("unavailable");
      let running = false;
      timer = setInterval(async () => {
        const v = video.current;
        if (running || paused.current || !v || v.readyState < 2) return;
        running = true;
        try {
          const codes = await detector.detect(v);
          const hit = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
          const now = Date.now();
          if (hit && !(hit.rawValue === lastCode.current.code && now - lastCode.current.at < 4000)) {
            lastCode.current = { code: hit.rawValue, at: now };
            scan(hit.rawValue);
          }
        } catch {
          /* frame not ready */
        } finally {
          running = false;
        }
      }, 250);
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scan]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- network request; state changes after it resolves
    loadRecent();
  }, [loadRecent]);

  const toggleTorch = async () => {
    if (torch === null || !track.current) return;
    const next = !torch;
    try {
      await track.current.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      setTorch(null);
    }
  };

  const camOn = cam === "on";
  const pill = checking ? "Checking" : camOn ? "Ready to scan" : cam === "starting" ? "Starting camera" : "Camera off";

  return (
    <div className="flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/80 backdrop-blur-xl pt-safe border-b border-white/10">
        <div className="h-14 px-5 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0 text-brand-lavender">
              <Icon name="spa" className="text-[18px]" />
            </div>
            <span className="font-bold text-[18px] tracking-tight text-accent-lime">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-1.5 py-1 px-2.5 bg-white/10 text-[11px] font-semibold text-white/90">
            <span className={`w-1.5 h-1.5 ${camOn && !checking ? "bg-emerald-400" : "bg-amber-400"}`} />
            <span>{pill}</span>
          </div>
        </div>
      </header>

      <main className="flex flex-col relative w-full max-w-lg mx-auto pt-14 pb-24 min-h-screen">
        {/* Viewfinder */}
        <div className="relative w-full aspect-[4/4.2] overflow-hidden bg-surface-dim">
          <video className="absolute inset-0 w-full h-full object-cover" muted playsInline ref={video} />
          <div className="absolute inset-0 bg-gradient-to-b from-surface/40 via-transparent to-surface" />
          <div className="relative z-10 w-full h-full flex flex-col justify-between p-5 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-md px-3 py-1.5 border border-white/10 text-[11px] font-semibold text-white/90">
                <span className={`w-1.5 h-1.5 ${camOn ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span>{camOn ? "Camera active" : cam === "starting" ? "Starting camera" : "Camera off"}</span>
              </div>
              <div className="flex items-center gap-2">
                {torch !== null && (
                  <button
                    aria-label={torch ? "Turn off flashlight" : "Turn on flashlight"}
                    className={`w-9 h-9 rounded backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-95 transition-transform ${torch ? "bg-white text-indigo-deep" : "bg-surface/80 text-white"}`}
                    onClick={toggleTorch}
                    type="button"
                  >
                    <Icon name={torch ? "flash_on" : "flash_off"} className="text-[18px]" />
                  </button>
                )}
                <button aria-label="Help with the camera" className="w-9 h-9 rounded bg-surface/80 backdrop-blur-md text-white border border-white/15 flex items-center justify-center active:scale-95 transition-transform" onClick={() => setHelp(true)} type="button">
                  <Icon name="help_outline" className="text-[18px]" />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center my-auto">
              <div className="relative w-64 h-44 border border-white/30 flex items-center justify-center bg-white/[0.02]">
                <span className="font-bold text-[13px] text-white/90 bg-surface/95 backdrop-blur-md px-3.5 py-1.5 border border-white/15 flex items-center gap-2">
                  {checking ? (
                    <>
                      <Spinner className="text-[16px]" /> Checking {checking}
                    </>
                  ) : camOn ? (
                    "Center the barcode"
                  ) : (
                    "Camera is off"
                  )}
                </span>
              </div>
            </div>
            <div className="text-center pb-2">
              <p className="text-[11px] text-white/70 font-medium">{camOn ? "Hold steady; it scans on its own" : "Tap the question mark for help"}</p>
            </div>
          </div>
        </div>

        {/* Primary action */}
        <div className="px-5 pt-3 pb-6 flex flex-col items-center gap-2">
          {error && <p className="w-full text-[13px] text-flag-crimson-soft">{error}</p>}
          <button className="w-full py-3.5 bg-white text-indigo-deep px-6 flex items-center justify-between active:bg-lavender-subtle transition-all font-semibold border-b border-brand-lavender" onClick={() => setLabel({ kind: "photo" })} type="button">
            <div className="flex items-center gap-2.5">
              <Icon name="photo_camera" className="text-[20px]" />
              <span className="font-bold text-[15px] tracking-tight">photograph a label</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-deep/80">
              <span>No barcode</span>
              <Icon name="arrow_forward" className="text-[18px]" />
            </div>
          </button>
        </div>

        {/* Recent scans */}
        <div className="flex flex-col w-full px-5">
          <div className="flex items-baseline justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-[19px] text-white tracking-tight">recent scans</h2>
              {recent && recent.length > 0 && <span className="text-[11px] font-bold px-2 py-0.5 bg-white/10 text-accent-lime border border-white/10">{String(recent.length).padStart(2, "0")}</span>}
            </div>
          </div>
          <div className="divide-y divide-white/10">
            {recent === null && <p className="py-4 text-[13px] text-white/50">Loading</p>}
            {recent?.length === 0 && <p className="py-4 text-[13px] text-white/50">Nothing scanned yet.</p>}
            {recent?.map((h) => <ScanRow item={h} key={h.id} />)}
          </div>
        </div>
      </main>

      <BottomNav active="scan" />

      {help && (
        <Sheet icon="videocam" onClose={() => setHelp(false)} title="Camera permission setup">
          <p className="text-[13px] text-on-surface-variant mb-3">If Safari blocked camera access, change the setting to scan products:</p>
          <div className="bg-surface p-3.5 flex flex-col gap-2 text-[12px] text-white/90 mb-4 border border-white/10">
            <div className="flex items-center gap-2"><span className="font-bold text-brand-lavender w-4">1.</span><span>Tap the <span className="font-semibold bg-white/10 px-1.5 py-0.5 rounded">aA</span> icon in Safari&apos;s address bar.</span></div>
            <div className="flex items-center gap-2"><span className="font-bold text-brand-lavender w-4">2.</span><span>Select <span className="font-semibold text-brand-lavender">Website Settings</span>.</span></div>
            <div className="flex items-center gap-2"><span className="font-bold text-brand-lavender w-4">3.</span><span>Set <span className="font-semibold text-white">Camera</span> to <span className="font-semibold text-brand-lavender">Allow</span>, then reload.</span></div>
          </div>
          <form
            className="flex gap-2 mb-3"
            onSubmit={(e) => {
              e.preventDefault();
              const code = typed.replace(/\D/g, "");
              if (code.length < 8) return setError("Type the full barcode number.");
              setHelp(false);
              setTyped("");
              scan(code);
            }}
          >
            <input className="flex-1 h-11 px-3 bg-surface border border-white/15 text-white text-[15px] outline-none focus:border-brand-lavender" inputMode="numeric" onChange={(e) => setTyped(e.target.value)} placeholder="Or type the barcode number" value={typed} />
            <button className="h-11 px-4 bg-white/10 border border-white/15 text-white font-semibold text-[14px]" type="submit">Check</button>
          </form>
          <PrimaryButton onClick={() => setHelp(false)}>Got it</PrimaryButton>
        </Sheet>
      )}

      {label && (
        <LabelSheet
          onClose={() => setLabel(null)}
          onDone={(r) => {
            setLabel(null);
            open(r);
          }}
          onLocked={() => setLocked(true)}
          start={label}
        />
      )}

      {locked && (
        <UnlockSheet
          onUnlocked={() => {
            setLocked(false);
            if (pendingCode) scan(pendingCode);
            setPendingCode(null);
            loadRecent();
          }}
        />
      )}
    </div>
  );
}
