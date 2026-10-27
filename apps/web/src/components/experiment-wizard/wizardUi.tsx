"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const ACCENT = "#359793";

export const SERIF = 'Georgia, Cambria, "Times New Roman", serif';
// Common variable types suggested for CV / RV (the field still accepts custom text).

export const COMMON_VAR_TYPES = ["Numerical (continuous)", "Numerical (discrete)", "Categorical (nominal)", "Ordinal", "Binary", "Count", "Boolean", "Text / free response"];

// Validate a numeric range against allowed bounds; returns human-readable errors.

export function rangeErrors(minS: string, maxS: string, lo: number, hi: number): string[] {
  const errs: string[] = [];
  const min = (minS ?? "").trim() === "" ? null : parseFloat(minS);
  const max = (maxS ?? "").trim() === "" ? null : parseFloat(maxS);
  if (min != null && (Number.isNaN(min) || min < lo || min > hi)) errs.push(`Start must be between ${lo} and ${hi}.`);
  if (max != null && (Number.isNaN(max) || max < lo || max > hi)) errs.push(`End must be between ${lo} and ${hi}.`);
  if (min != null && max != null && !Number.isNaN(min) && !Number.isNaN(max) && min > max) errs.push("Start must be ≤ end.");
  return errs;
}

export function InfoTip({ children, label = "What's this?" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        className="grid h-[18px] w-[18px] place-items-center rounded-full text-white shadow-sm transition-transform hover:scale-110"
        style={{ backgroundColor: ACCENT }}
      >
        <Info className="h-3 w-3" strokeWidth={2.5} />
      </button>
      {open ? (
        <span
          className="absolute left-0 top-7 z-30 block w-80 max-w-[90vw] rounded-lg border border-neutral-200 bg-white p-3 text-left text-sm font-normal leading-relaxed text-neutral-600 shadow-xl"
          style={{ fontFamily: "ui-sans-serif, system-ui" }}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <label className="block text-sm font-medium text-neutral-800">{label}</label>
      {hint ? <p className="mb-1.5 mt-0.5 text-xs text-neutral-400">{hint}</p> : <div className="mb-1.5" />}
      {children}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400">
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

export function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400" />
  );
}

export function DocLabel({ children, tip, required }: { children: ReactNode; tip?: ReactNode; required?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">
        {required ? <span className="mr-0.5 text-amber-500" title="Required">*</span> : null}
        {children}
      </p>
      {tip ? <InfoTip>{tip}</InfoTip> : null}
    </div>
  );
}

// Borderless, document-style inputs: read like prose, underline only on focus.

export function DocText({ value, onChange, placeholder, multiline }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  const cls = "w-full resize-none border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] leading-7 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500";
  if (multiline) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className={cn(cls, "min-h-[2.5rem]")} />;
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />;
}

export function DocSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "max-w-[16rem] truncate border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] leading-7 outline-none focus:border-neutral-500",
        value ? "text-neutral-900" : "text-neutral-400"
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (<option key={o} value={o} className="text-neutral-900">{o}</option>))}
    </select>
  );
}
