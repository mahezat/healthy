"use client";

// Label photo flow (not designed in Stitch yet): same bottom-sheet style as the camera helper.

import { useRef, useState } from "react";
import { api, LockedError, type ScanResponse } from "@/lib/client/api";
import { photoToDataUrl } from "@/lib/client/photo";
import type { ScanResult } from "@/lib/types";
import { PrimaryButton, SecondaryButton, Sheet, Spinner } from "./ui";

export type LabelStart =
  | { kind: "photo" }
  | { kind: "not_found"; draftId: string; barcode: string }
  | { kind: "needs_label"; draftId: string; missing: ("ingredients" | "nutrition")[]; name?: string };

type Step =
  | { s: "ingredients"; problem?: string }
  | { s: "nutrition" }
  | { s: "busy"; message: string }
  | { s: "web_failed" }
  | { s: "error"; message: string };

export function LabelSheet({ start, onDone, onClose, onLocked }: { start: LabelStart; onDone: (r: ScanResult) => void; onClose: () => void; onLocked: () => void }) {
  const [draftId, setDraftId] = useState(start.kind === "photo" ? undefined : start.draftId);
  const onlyNutrition = start.kind === "needs_label" && !start.missing.includes("ingredients");
  const [step, setStep] = useState<Step>(onlyNutrition ? { s: "nutrition" } : { s: "ingredients" });
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<"ingredients" | "nutrition">("ingredients");
  const hasBarcode = start.kind !== "photo";

  const handle = (res: ScanResponse) => {
    if ("draftId" in res && res.draftId) setDraftId(res.draftId);
    switch (res.status) {
      case "found":
        return onDone(res.result);
      case "needs_nutrition":
        return setStep({ s: "nutrition" });
      case "unreadable":
        return setStep({ s: "ingredients", problem: res.problem });
      case "not_found_web":
        return setStep({ s: "web_failed" });
      default:
        return setStep({ s: "error", message: "Something went wrong. Try again." });
    }
  };

  const run = async (message: string, fn: () => Promise<ScanResponse>) => {
    setStep({ s: "busy", message });
    try {
      handle(await fn());
    } catch (e) {
      if (e instanceof LockedError) return onLocked();
      setStep({ s: "error", message: (e as Error).message });
    }
  };

  const pick = (t: "ingredients" | "nutrition") => {
    setTarget(t);
    input.current?.click();
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    const image = await photoToDataUrl(file);
    if (target === "ingredients") await run("Reading the ingredients", () => api.label({ draftId, ingredientsImage: image }));
    else await run("Reading the nutrition facts", () => api.label({ draftId, nutritionImage: image }));
  };

  const web = () => run("Searching the web", () => api.web({ draftId }));
  const skipNutrition = () => run("Scoring", () => api.label({ draftId, skipNutrition: true }));
  const useAvailable = () => run("Scoring", () => api.label({ draftId, useAvailable: true }));

  const title = step.s === "nutrition" ? "Now the nutrition facts" : step.s === "web_failed" ? "Not found on the web" : "Photograph the ingredient list";

  return (
    <Sheet icon="photo_camera" onClose={step.s === "busy" ? undefined : onClose} title={title}>
      <input
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
        ref={input}
        type="file"
      />

      {step.s === "busy" && (
        <div className="flex items-center gap-3 py-6 text-[14px] text-on-surface-variant">
          <Spinner className="text-[20px] text-brand-lavender" />
          {step.message}
        </div>
      )}

      {step.s === "ingredients" && (
        <div className="flex flex-col gap-3 mt-1">
          <p className="text-[13px] text-on-surface-variant">
            {step.problem
              ? step.problem
              : start.kind === "needs_label"
                ? `${start.name ?? "This product"} is in the database without its ingredient list. Photograph it to get a full score.`
                : start.kind === "not_found"
                  ? "This one isn't in our database yet. Photograph the ingredient list."
                  : "Fill the frame with the ingredient list, flat and in good light."}
          </p>
          <PrimaryButton onClick={() => pick("ingredients")}>{step.problem ? "Retake" : "Take photo"}</PrimaryButton>
          {hasBarcode && <SecondaryButton onClick={web}>Search the web instead</SecondaryButton>}
          {start.kind === "needs_label" && !step.problem && <SecondaryButton onClick={useAvailable}>Skip and use what&apos;s known</SecondaryButton>}
        </div>
      )}

      {step.s === "nutrition" && (
        <div className="flex flex-col gap-3 mt-1">
          <p className="text-[13px] text-on-surface-variant">The food score is mostly nutrition. Without this photo you get a partial score.</p>
          <PrimaryButton onClick={() => pick("nutrition")}>Take photo</PrimaryButton>
          <SecondaryButton onClick={onlyNutrition ? useAvailable : skipNutrition}>Skip</SecondaryButton>
        </div>
      )}

      {step.s === "web_failed" && (
        <div className="flex flex-col gap-3 mt-1">
          <p className="text-[13px] text-on-surface-variant">No page with this product&apos;s full ingredient list was found. A label photo works for any product.</p>
          <PrimaryButton onClick={() => setStep({ s: "ingredients" })}>Photograph the label</PrimaryButton>
        </div>
      )}

      {step.s === "error" && (
        <div className="flex flex-col gap-3 mt-1">
          <p className="text-[13px] text-flag-crimson-soft">{step.message}</p>
          <PrimaryButton onClick={() => setStep({ s: "ingredients" })}>Try again</PrimaryButton>
        </div>
      )}
    </Sheet>
  );
}
