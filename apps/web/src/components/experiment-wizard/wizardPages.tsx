"use client";

import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { Upload, Plus, X, Wand2, ChevronLeft, ChevronRight, Play, BarChart3, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ACCENT, InfoTip, DocLabel, TextInput } from "./wizardUi";
import {
  Page, Answers, parseIvs, parseProcSteps, ProcStep, PROC_STEP_TYPES,
  USER_MODELS, UserModel, parseIdList, cognitiveParamsFor, CognitiveParam,
  parseApparatusList, ApparatusEntry, normalizeApparatusEntry, ivGroupOptions,
  instanceIdsOf,
  STUDY_UI_ROOT, STUDY_PARAM_DEFAULTS, buildStudyUrl,
  STUDY_DATASETS, EXPLANATION_FORMS, INTERFACE_ELEMENTS,
  formOf, namespaceOf, elementsOf, instanceRangeFor, studyNaturalSize,
} from "./questions";

// Re-exported for backward compatibility with existing imports of these from this module.
export { STUDY_UI_ROOT, STUDY_PARAM_DEFAULTS, buildStudyUrl } from "./questions";

export function TextBody({ page, answers, setAnswer }: { page: Page; answers: Answers; setAnswer: (id: string, v: string) => void }) {
  return (
    <>
      <h1 className="text-2xl font-semibold leading-snug tracking-tight">{page.prompt}{page.subtitle ? <> <InfoTip>{page.subtitle}</InfoTip></> : null}</h1>
      {page.hints && page.hints.length > 0 && (
        <ul className="mt-3 space-y-1">
          {page.hints.map((h, i) => (
            <li key={i} className="flex gap-2 text-sm text-neutral-500">
              <span style={{ color: ACCENT }}>•</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
      <Textarea
        autoFocus
        value={answers[page.id] ?? ""}
        onChange={(e) => setAnswer(page.id, e.target.value)}
        placeholder={page.placeholder ?? "Type your answer…"}
        className="mt-6 min-h-[220px] resize-y bg-white text-[15px] leading-relaxed"
      />
      <p className="mt-2 text-xs text-neutral-400">Type directly here, or use the assistant on the right to fill it in.</p>
    </>
  );
}

// The deployed XAI study interfaces (/local and /global iframe apps). Researchers
// choose interface elements + material configuration; we assemble the link and
// preview it. The apps' own logic is untouched — see questions.ts for the URL
// contract (namespaces, fixed models, instance ranges).

export function getStudyParams(a: Answers): Record<string, string> {
  let o: Record<string, string> = {};
  try { o = JSON.parse(a.study_params || "{}"); } catch { o = {}; }
  return { ...STUDY_PARAM_DEFAULTS, ...o };
}

// Renders an iframe at its interface's natural canvas size, scaled down to fit
// the container width — the whole page is always visible, nothing is clipped.
export function ScaledIframe({ src, title, naturalW, naturalH }: { src: string; title: string; naturalW: number; naturalH: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = w > 0 ? Math.min(1, w / naturalW) : 1;
  return (
    <div ref={wrapRef} className="w-full overflow-hidden" style={{ height: Math.ceil(naturalH * scale) }}>
      <iframe
        key={src}
        src={src}
        title={title}
        style={{ width: naturalW, height: naturalH, transform: `scale(${scale})`, transformOrigin: "top left", border: 0 }}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}

export function ParamField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

export function ParamCheck({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs", on ? "border-transparent text-white" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50")} style={on ? { backgroundColor: ACCENT } : undefined}>
      <span className={cn("grid h-3.5 w-3.5 place-items-center rounded-[3px] border", on ? "border-white/70" : "border-neutral-300")}>{on ? <Check className="h-2.5 w-2.5" /> : null}</span>
      {label}
    </button>
  );
}

export function ApparatusBody({ page, answers, setAnswer }: { page: Page; answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const entries = parseApparatusList(a);
  const groupOptions = ivGroupOptions(a);
  const [editingId, setEditingId] = useState<string | null>(null);
  const pcls = "w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-neutral-400";

  // Seed one configuration on first use (migrating any legacy single-config fields).
  useEffect(() => {
    if (parseApparatusList(a).length > 0) return;
    let legacyParams: Record<string, string> = {};
    try { legacyParams = JSON.parse(a.study_params || "{}"); } catch { legacyParams = {}; }
    const seed = normalizeApparatusEntry({
      label: "Configuration 1",
      group: "All participants",
      mode: a.apparatus_mode === "own" ? "own" : "ours",
      params: legacyParams,
      url: a.apparatus_url || "",
    });
    setAnswer("apparatus_list", JSON.stringify([seed]));
    setEditingId(seed.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveList(next: ApparatusEntry[]) { setAnswer("apparatus_list", JSON.stringify(next)); }
  function patchEntry(id: string, patch: Partial<ApparatusEntry>) { saveList(entries.map((e) => (e.id === id ? { ...e, ...patch } : e))); }
  function setParam(e: ApparatusEntry, k: string, v: string) { patchEntry(e.id, { params: { ...e.params, [k]: v } }); }
  function addEntry() {
    const e = normalizeApparatusEntry({ label: `Configuration ${entries.length + 1}`, group: "All participants", mode: "ours", params: {}, url: "" });
    saveList([...entries, e]);
    setEditingId(e.id);
  }
  function removeEntry(id: string) { saveList(entries.filter((e) => e.id !== id)); if (editingId === id) setEditingId(null); }

  function entryParams(e: ApparatusEntry): Record<string, string> { return { ...STUDY_PARAM_DEFAULTS, ...e.params }; }
  function builtFor(e: ApparatusEntry): string {
    const p = entryParams(e);
    const first = instanceIdsOf(p)[0] ?? p.instanceId;
    return buildStudyUrl(STUDY_UI_ROOT, { ...p, instanceId: first });
  }
  function previewFor(e: ApparatusEntry): string {
    if (e.mode === "own") return /^https?:\/\//i.test(e.url.trim()) ? e.url.trim() : "";
    return builtFor(e);
  }
  function summaryFor(e: ApparatusEntry): string {
    if (e.mode === "own") return e.url.trim() ? `Your interface · ${e.url.trim()}` : "Your interface · no URL yet";
    const p = entryParams(e);
    const formLabel = EXPLANATION_FORMS.find((f) => f.id === formOf(p))?.label ?? formOf(p);
    const ds = STUDY_DATASETS.find((d) => d.appId === (p.appId || "wine_quality"))?.label ?? p.appId;
    const n = instanceIdsOf(p).length || 1;
    return `Our interface · ${formLabel}, ${ds} · ${n} trial${n === 1 ? "" : "s"}`;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold leading-snug tracking-tight">{page.prompt}{page.subtitle ? <> <InfoTip>{page.subtitle}</InfoTip></> : null}</h1>
      {page.hints && page.hints.length > 0 && (
        <ul className="mt-3 space-y-1">
          {page.hints.map((h, i) => (
            <li key={i} className="flex gap-2 text-sm text-neutral-500"><span style={{ color: ACCENT }}>•</span><span>{h}</span></li>
          ))}
        </ul>
      )}

      <div className="mt-6 space-y-3" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
        {entries.map((e) => {
          const editing = editingId === e.id;
          const preview = previewFor(e);
          return (
            <div key={e.id} className="rounded-xl border border-neutral-200">
              {/* header: label + group + controls */}
              <div className="flex flex-wrap items-center gap-2 p-3">
                <input value={e.label} onChange={(ev) => patchEntry(e.id, { label: ev.target.value })} placeholder="Label (e.g. Importance group)" className="min-w-[10rem] flex-1 border-0 border-b border-transparent bg-transparent px-0 py-0.5 text-sm font-medium text-neutral-900 outline-none focus:border-neutral-300" />
              <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <span>Used by</span>
                  <select value={e.group} onChange={(ev) => patchEntry(e.id, { group: ev.target.value })} className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-400">
                    {(groupOptions.includes(e.group) ? groupOptions : [e.group, ...groupOptions]).map((g) => (<option key={g} value={g}>{g}</option>))}
                  </select>
                </label>
                <button onClick={() => setEditingId(editing ? null : e.id)} className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50">{editing ? "Done" : "Edit"}</button>
                <button onClick={() => removeEntry(e.id)} className="grid h-7 w-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600" aria-label="Remove"><X className="h-4 w-4" /></button>
              </div>

              {!editing ? (
                <div className="px-3 pb-3 text-xs text-neutral-400">{summaryFor(e)}</div>
              ) : (
                <div className="space-y-3 border-t border-neutral-100 p-3 text-sm">
                  <div className="inline-flex overflow-hidden rounded-lg border border-neutral-200 text-sm">
                    <button onClick={() => patchEntry(e.id, { mode: "ours" })} className={cn("px-3 py-1.5", e.mode === "ours" ? "text-white" : "text-neutral-600 hover:bg-neutral-50")} style={e.mode === "ours" ? { backgroundColor: ACCENT } : undefined}>Use our interface</button>
                    <button onClick={() => patchEntry(e.id, { mode: "own" })} className={cn("border-l border-neutral-200 px-3 py-1.5", e.mode === "own" ? "text-white" : "text-neutral-600 hover:bg-neutral-50")} style={e.mode === "own" ? { backgroundColor: ACCENT } : undefined}>Use my own</button>
                  </div>

                  {e.mode === "ours" ? (() => {
                    const p = entryParams(e);
                    const form = formOf(p);
                    const ns = namespaceOf(p);
                    const els = elementsOf(p);
                    const range = instanceRangeFor(p);
                    const ids = instanceIdsOf(p);
                    const badIds = ids.filter((id) => { const n = Number(id); return !Number.isInteger(n) || n < range.min || n > range.max; });
                    const dsLabel = STUDY_DATASETS.find((d) => d.appId === (p.appId || "wine_quality"))?.label ?? p.appId;
                    const available = (el: { key: string; localOnly?: boolean }) => !(ns === "global" && el.localOnly);
                    const toggleElement = (k: string) => {
                      if (k === "instance") return; // always shown, cannot be deselected
                      const next = els.includes(k) ? els.filter((x) => x !== k) : [...els, k];
                      setParam(e, "elements", next.join(","));
                    };
                    const selectAll = () => setParam(e, "elements", INTERFACE_ELEMENTS.filter(available).map((x) => x.key).join(","));
                    const flagCheck = (label: string, on: boolean, toggle: () => void) => (
                      <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                        <input type="checkbox" checked={on} onChange={toggle} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                        {label}
                      </label>
                    );
                    return (
                      <div className="space-y-4">
                        {/* Choose interface elements */}
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Choose interface elements</p>
                              <p className="mt-0.5 text-xs text-neutral-400">All available forms are shown below. Select any combination for the participant screen.</p>
                            </div>
                            <button type="button" onClick={selectAll} className="shrink-0 text-xs font-semibold" style={{ color: ACCENT }}>Select all</button>
                          </div>
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {INTERFACE_ELEMENTS.map((el) => {
                              const enabled = available(el);
                              const locked = enabled && !!el.required;
                              const on = enabled && (locked || els.includes(el.key));
                              const accent = on && !locked; // locked cards get a muted grey look instead of the accent
                              return (
                                <button
                                  key={el.key}
                                  type="button"
                                  disabled={!enabled || locked}
                                  onClick={() => toggleElement(el.key)}
                                  className={cn(
                                    "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                                    !enabled ? "cursor-not-allowed border-neutral-200 opacity-40"
                                      : locked ? "cursor-default border-neutral-200 bg-neutral-100/80"
                                        : accent ? ""
                                          : "border-neutral-200 hover:bg-neutral-50"
                                  )}
                                  style={accent ? { borderColor: ACCENT, backgroundColor: `${ACCENT}14` } : undefined}
                                  title={!enabled ? "Not supported by the surrogate (LR / decision-tree) interface" : locked ? "Always shown to participants — cannot be turned off" : undefined}
                                >
                                  <span className="min-w-0">
                                    <span className={cn("block text-sm font-semibold", locked ? "text-neutral-500" : "text-neutral-900")}>{el.label}</span>
                                    <span className={cn("mt-0.5 block text-xs", locked ? "text-neutral-400" : "text-neutral-500")}>{el.sub}{locked ? " — always shown" : ""}</span>
                                  </span>
                                  <span
                                    className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border", locked ? "border-transparent bg-neutral-400 text-white" : on ? "border-transparent text-white" : "border-neutral-300 bg-white")}
                                    style={accent ? { backgroundColor: ACCENT } : undefined}
                                  >
                                    {on ? <Check className="h-3 w-3" /> : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {ns === "global" ? <p className="mt-1 text-xs text-neutral-400">Greyed-out elements aren't supported by the surrogate (LR / decision-tree) interface.</p> : null}
                        </div>

                        {/* Material configuration */}
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Material configuration</p>
                          <p className="mt-0.5 text-xs text-neutral-400">Choose the data, explanation, and example shown in the preview. The AI model is set automatically by the dataset.</p>
                          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <ParamField label="Dataset">
                              <select value={p.appId || "wine_quality"} onChange={(ev) => setParam(e, "appId", ev.target.value)} className={pcls}>
                                {STUDY_DATASETS.map((d) => (<option key={d.appId} value={d.appId}>{d.label}</option>))}
                              </select>
                            </ParamField>
                            <ParamField label="Explanation form">
                              <select value={form} onChange={(ev) => setParam(e, "form", ev.target.value)} className={pcls}>
                                {EXPLANATION_FORMS.map((f) => (<option key={f.id} value={f.id}>{f.label}</option>))}
                              </select>
                            </ParamField>
                            {ns === "local" ? (
                              <ParamField label="Explanation method">
                                <select value={p.expMethod === "lime" ? "lime" : "shap"} onChange={(ev) => setParam(e, "expMethod", ev.target.value)} className={pcls}>
                                  <option value="shap">SHAP</option>
                                  <option value="lime">LIME</option>
                                </select>
                              </ParamField>
                            ) : form === "LR" ? (
                              <ParamField label="LR variant">
                                <select value={p.LRVariant === "sparse" ? "sparse" : "dense"} onChange={(ev) => setParam(e, "LRVariant", ev.target.value)} className={pcls}>
                                  <option value="dense">Dense</option>
                                  <option value="sparse">Sparse</option>
                                </select>
                              </ParamField>
                            ) : (
                              <ParamField label="Tree depth">
                                <select value={p.DTDepth === "2" ? "2" : "3"} onChange={(ev) => setParam(e, "DTDepth", ev.target.value)} className={pcls}>
                                  <option value="2">2</option>
                                  <option value="3">3</option>
                                </select>
                              </ParamField>
                            )}
                            <ParamField label={`Data instances (trials) · ${range.min}–${range.max}`}>
                              <input
                                type="text"
                                value={p.instanceIds ?? ids.join(", ")}
                                onChange={(ev) => setParam(e, "instanceIds", ev.target.value)}
                                placeholder="e.g. 0, 3, 7 or 0-9"
                                className={pcls}
                              />
                            </ParamField>
                            {ns === "local" ? (
                              <ParamField label="User selection">
                                <select value={p.userPrediction ?? "none"} onChange={(ev) => setParam(e, "userPrediction", ev.target.value)} className={pcls}>
                                  <option value="none">No selection</option>
                                  <option value="0">Class 0</option>
                                  <option value="1">Class 1</option>
                                </select>
                              </ParamField>
                            ) : null}
                          </div>

                          {ids.length ? (
                            <p className="mt-2 text-xs text-neutral-400">Generates <span className="font-medium text-neutral-600">{ids.length}</span> trial{ids.length === 1 ? "" : "s"} for this group — instances {ids.join(", ")}. Each participant sees one instance per trial.</p>
                          ) : (
                            <p className="mt-2 text-xs text-amber-600">Enter at least one instance ID (e.g. <code>0, 3, 7</code> or a range <code>0-9</code>) — this defines the trials in the generated survey.</p>
                          )}
                          {badIds.length ? (
                            <p className="mt-1 text-xs font-medium text-red-600">Out of range for {dsLabel} (the {ns} interface allows {range.min}–{range.max}): {badIds.join(", ")}. The two interfaces index different corpora — re-check IDs after changing the explanation form.</p>
                          ) : null}

                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                            {ns === "local" ? flagCheck("Focus the participant on important features", p.focusOnImportant === "1", () => setParam(e, "focusOnImportant", p.focusOnImportant === "1" ? "0" : "1")) : null}
                            {ns === "global" && form === "DT" ? flagCheck("Participant edits the tree", p.DTEditor === "1", () => setParam(e, "DTEditor", p.DTEditor === "1" ? "0" : "1")) : null}
                            {ns === "global" ? flagCheck("Show the explanation's prediction", p.showExplanationPrediction !== "0", () => setParam(e, "showExplanationPrediction", p.showExplanationPrediction === "0" ? "1" : "0")) : null}
                            {ns === "global" && els.includes("sliders") ? flagCheck("Ask participants to confirm slider changes (recourse)", p.recourseConfirm === "1", () => setParam(e, "recourseConfirm", p.recourseConfirm === "1" ? "0" : "1")) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-600">{builtFor(e)}</code>
                          <a href={builtFor(e)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Open ↗</a>
                        </div>
                      </div>
                    );
                  })() : (
                    <div>
                      <div className="flex items-center gap-2">
                        <input value={e.url} onChange={(ev) => patchEntry(e.id, { url: ev.target.value })} placeholder="https://your-study-build.example.com" className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                        {/^https?:\/\//i.test(e.url.trim()) ? (<a href={e.url.trim()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50">Open ↗</a>) : null}
                      </div>
                      {e.url.trim() && !/^https?:\/\//i.test(e.url.trim()) ? <p className="mt-1 text-xs text-amber-600">Enter a full URL starting with http:// or https://</p> : null}
                    </div>
                  )}

                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-neutral-400">Preview</span>
                    {preview ? (
                      <div className="mt-1 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                        {(() => { const nat = studyNaturalSize(e.mode, entryParams(e)); return <ScaledIframe src={preview} title={`Preview ${e.label}`} naturalW={nat.w} naturalH={nat.h} />; })()}
                      </div>
                    ) : (
                      <div className="mt-1 grid h-[160px] place-items-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 text-sm text-neutral-400">Paste a URL to preview.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={addEntry} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          <Plus className="h-4 w-4" /> Add apparatus
        </button>
      </div>
    </>
  );
}

export function ProcedureBody({ page, answers, setAnswer }: { page: Page; answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const steps = parseProcSteps(a.proc_steps);
  const [linkOpen, setLinkOpen] = useState<Record<number, boolean>>({});

  function save(next: ProcStep[]) { setAnswer("proc_steps", JSON.stringify(next)); }
  function add() { save([...steps, { title: "" }]); }
  function remove(i: number) { save(steps.filter((_, idx) => idx !== i)); }
  function patch(i: number, p: Partial<ProcStep>) { save(steps.map((s, idx) => (idx === i ? { ...s, ...p } : s))); }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  }
  function onFile(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) patch(i, { attachment: file.name });
    e.target.value = "";
  }

  const inputCls = "w-full border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] outline-none placeholder:text-neutral-300 focus:border-neutral-500";

  // Common HCI/XAI backbone — a scaffold the user can start from and adapt.
  const TYPICAL_STEPS: ProcStep[] = [
    { title: "Welcome & consent", note: "Greet the participant, explain the study, and collect informed consent." },
    { title: "Demographics questionnaire", note: "Short background questions (e.g. age range, AI familiarity)." },
    { title: "Training / practice", note: "Walk through the interface with a few practice trials so the task is understood before it counts." },
    { title: "Main task (trials)", note: "The core trials where your dependent variables are collected, in the counterbalanced order from Study Design." },
    { title: "Post-task questionnaire", note: "Self-report measures (e.g. trust, workload, satisfaction)." },
    { title: "Debrief", note: "Explain the study's purpose, answer questions, and thank the participant." },
  ];
  function seedTypical() {
    if (steps.some((s) => (s.title || "").trim()) && !window.confirm("Replace the current steps with a typical structure?")) return;
    save(TYPICAL_STEPS);
  }

  return (
    <>
      <h1 className="text-2xl font-semibold leading-snug tracking-tight">{page.prompt}{page.subtitle ? <> <InfoTip>{page.subtitle}</InfoTip></> : null}</h1>
      {page.hints && page.hints.length > 0 && (
        <ul className="mt-3 space-y-1">
          {page.hints.map((h, i) => (
            <li key={i} className="flex gap-2 text-sm text-neutral-500"><span style={{ color: ACCENT }}>•</span><span>{h}</span></li>
          ))}
        </ul>
      )}

      <div className="mt-5 space-y-3" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
        {steps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-4 text-sm text-neutral-600">
            <p>No steps yet. Start from the typical HCI/XAI structure and edit it, or add steps one by one.</p>
            <button onClick={seedTypical} className="mt-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: ACCENT }}>
              <Wand2 className="h-4 w-4" /> Start from a typical structure
            </button>
          </div>
        ) : null}

        {steps.map((s, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-start gap-3">
              <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: ACCENT }}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <input
                  value={s.title}
                  onChange={(e) => patch(i, { title: e.target.value })}
                  list="proc-step-titles"
                  placeholder="Step title — pick one or type your own"
                  className={inputCls}
                />
                <textarea
                  value={s.note ?? ""}
                  onChange={(e) => patch(i, { note: e.target.value })}
                  placeholder="Add more details about this step… (optional)"
                  rows={2}
                  className="mt-2 w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-neutral-300 focus:border-neutral-400"
                />
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                    <Upload className="h-3.5 w-3.5" /> {s.attachment ? s.attachment : "Attach file"}
                    <input type="file" onChange={(e) => onFile(i, e)} className="hidden" />
                  </label>
                  {s.attachment ? <button onClick={() => patch(i, { attachment: "" })} className="text-xs text-neutral-400 underline hover:text-neutral-600">clear file</button> : null}
                  {!(linkOpen[i] || (s.link || "").trim()) ? (
                    <button onClick={() => setLinkOpen((o) => ({ ...o, [i]: true }))} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: ACCENT }}>
                      <Plus className="h-3.5 w-3.5" /> Add link
                    </button>
                  ) : null}
                </div>
                {linkOpen[i] || (s.link || "").trim() ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={s.link ?? ""}
                      onChange={(e) => patch(i, { link: e.target.value })}
                      placeholder="Link (consent form / questionnaire URL)"
                      className={cn(inputCls, "text-sm")}
                    />
                    <button onClick={() => { patch(i, { link: "" }); setLinkOpen((o) => ({ ...o, [i]: false })); }} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" aria-label="Remove link"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-0.5 text-neutral-400 enabled:hover:bg-neutral-100 disabled:opacity-30" aria-label="Move up"><ChevronLeft className="h-4 w-4 rotate-90" /></button>
                <button onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="rounded p-0.5 text-neutral-400 enabled:hover:bg-neutral-100 disabled:opacity-30" aria-label="Move down"><ChevronRight className="h-4 w-4 rotate-90" /></button>
                <button onClick={() => remove(i)} className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" aria-label="Remove step"><X className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}

        <datalist id="proc-step-titles">
          {PROC_STEP_TYPES.map((t) => (<option key={t} value={t} />))}
        </datalist>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
            <Plus className="h-4 w-4" /> Add step
          </button>
          {steps.length ? (
            <button type="button" onClick={seedTypical} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium" style={{ color: ACCENT }}>
              <Wand2 className="h-4 w-4" /> Reset to typical structure
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function UserModelBody({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const [customs, setCustoms] = useState<UserModel[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: "", full: "", description: "", category: "Custom" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("experiment-user-models");
      if (raw) setCustoms(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  function persistCustoms(next: UserModel[]) {
    setCustoms(next);
    try { localStorage.setItem("experiment-user-models", JSON.stringify(next)); } catch { /* ignore */ }
  }
  function addCustom() {
    const name = draft.name.trim();
    if (!name) return;
    const entry: UserModel = { id: name, name, full: draft.full.trim() || name, description: draft.description.trim() || "(custom model)", category: "Custom" };
    persistCustoms([...customs, entry]);
    setAnswer("user_model", name);
    setDraft({ name: "", full: "", description: "", category: "Custom" });
    setShowAdd(false);
  }

  const all = [...USER_MODELS, ...customs];
  const userModels = all.filter((m) => m.category === "Cognitive model" || m.category === "Custom");
  const proxies = all.filter((m) => m.category === "Comparison baseline");
  const selectedProxies = parseIdList(a.ml_proxies);

  function toggleProxy(id: string) {
    const next = selectedProxies.includes(id) ? selectedProxies.filter((x) => x !== id) : [...selectedProxies, id];
    setAnswer("ml_proxies", JSON.stringify(next));
  }

  const cogAgent = a.user_model === "CoAX" ? "CoAX" : a.user_model === "CoXAM" ? "CoXAM" : "";
  const cogParams: CognitiveParam[] = cogAgent ? cognitiveParamsFor(cogAgent) : [];
  const cogCfg: Record<string, string> = (() => { try { return JSON.parse(a.cog_config || "{}"); } catch { return {}; } })();
  function setCog(name: string, val: string) {
    setAnswer("cog_config", JSON.stringify({ ...cogCfg, [name]: val }));
  }
  // Cognitive parameters manipulated as an IV in Study Design (kept in sync — those are varied, not fixed here).
  const manipulatedCog: Record<string, string> = {};
  for (const e of parseIvs(a)) {
    if (e.factor === "cognitive" && e.cogParam) manipulatedCog[e.cogParam] = e.levels || "";
  }

  function Card({ m, on, multi, onClick }: { m: UserModel; on: boolean; multi: boolean; onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors", on ? "border-transparent ring-2" : "border-neutral-200 hover:bg-neutral-50")}
        style={on ? ({ ["--tw-ring-color" as any]: ACCENT, borderColor: ACCENT } as React.CSSProperties) : undefined}
      >
        <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center border", multi ? "rounded-[5px]" : "rounded-full", on ? "border-transparent text-white" : "border-neutral-300")} style={on ? { backgroundColor: ACCENT } : undefined}>
          {on ? <Check className="h-3 w-3" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-neutral-900">{m.name} <span className="font-normal text-neutral-400">· {m.full}</span></span>
          <span className="mt-0.5 block text-sm text-neutral-500">{m.description}</span>
        </span>
      </button>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold leading-snug tracking-tight">
        User model{" "}
        <InfoTip>
          A <span className="font-medium text-neutral-800">user model</span> is a stand-in for a human participant — a program that simulates how a person would read the explanations and make decisions, so you can pilot the study without recruiting people yet. Pick the <span className="font-medium text-neutral-800">one</span> you're studying. <span className="font-medium text-neutral-800">Comparison baselines</span> are simpler, standard models (e.g. k-nearest-neighbours) you run alongside to compare against.
        </InfoTip>
      </h1>
      <p className="mt-1 text-sm text-neutral-400">Pick the model you're studying, plus any baselines to compare against.</p>

      <div className="mt-6 space-y-6">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">User model · select one</p>
          <div className="space-y-2">
            {userModels.map((m) => (
              <Card key={m.id} m={m} multi={false} on={a.user_model === m.id} onClick={() => setAnswer("user_model", m.id)} />
            ))}
          </div>
        </div>

        {cogParams.length ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Cognitive parameters · {cogAgent}</p>
            <div className="space-y-2">
              {cogParams.map((p) => {
                const manip = manipulatedCog[p.name];
                const isManip = manip !== undefined;
                return (
                  <div key={p.name} className="rounded-xl border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-neutral-800">{p.name}</span>
                      <span className="text-xs text-neutral-400">range {p.min} – {p.max}</span>
                    </div>
                    {p.note ? <p className="mt-0.5 text-xs text-neutral-400">{p.note}</p> : null}
                    {isManip ? (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: ACCENT }}>Manipulated in Study Design</span>
                        <span className="text-neutral-600">{manip || "set as an IV"}</span>
                      </div>
                    ) : (() => {
                      const v = cogCfg[p.name] ?? "";
                      const bad = v.trim() !== "" && (Number.isNaN(parseFloat(v)) || parseFloat(v) < p.min || parseFloat(v) > p.max);
                      return (
                        <div>
                          <div className="mt-2 flex items-center gap-2 text-sm">
                            <span className="text-neutral-500">Value:</span>
                            <input
                              type="number"
                              value={v}
                              onChange={(e) => setCog(p.name, e.target.value)}
                              placeholder={`${p.min} – ${p.max}`}
                              className={cn("w-28 border-0 border-b bg-transparent px-0 py-0.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400", bad ? "border-red-400 focus:border-red-500" : "border-neutral-200 focus:border-neutral-500")}
                            />
                          </div>
                          {bad ? <p className="mt-1 text-xs font-medium text-red-600">Value must be between {p.min} and {p.max}.</p> : null}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">Leave blank to use the model’s default. Parameters manipulated as an IV in Study Design are shown here and stay in sync — set their range on the Study Design page.</p>
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center gap-1.5"><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Comparison baselines · select any</p><InfoTip>Simple, standard models (e.g. k-nearest-neighbours) run alongside your user model so you have something to compare its behaviour against. Optional.</InfoTip></div>
          <div className="space-y-2">
            {proxies.map((m) => (
              <Card key={m.id} m={m} multi on={selectedProxies.includes(m.id)} onClick={() => toggleProxy(m.id)} />
            ))}
          </div>
        </div>

        {showAdd ? (
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="mb-2 text-sm font-medium text-neutral-800">Add a user model</p>
            <div className="space-y-2">
              <TextInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Short name (e.g. MyModel)" />
              <TextInput value={draft.full} onChange={(v) => setDraft({ ...draft, full: v })} placeholder="Full name" />
              <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="One-line description" className="min-h-[60px] resize-y bg-white text-sm" />
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={addCustom} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: ACCENT }}>Add</button>
              <button onClick={() => setShowAdd(false)} className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
            <Plus className="h-4 w-4" /> Add your own user model
          </button>
        )}
      </div>
    </>
  );
}

export function ResultsBody({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const status = a.run_status || "idle"; // "idle" | "running" | "done"
  const [note, setNote] = useState("");

  function run() {
    setAnswer("run_status", "running");
    // Placeholder: no real execution yet.
    window.setTimeout(() => setAnswer("run_status", "done"), 1200);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Results & report</h1>
      <p className="mt-1 text-sm text-neutral-500">Run the experiment, then analyse results and generate a report here.</p>

      <div className="mt-6 rounded-xl border border-neutral-200 p-4" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            disabled={status === "running"}
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            <Play className="h-4 w-4" /> {status === "running" ? "Running…" : "Run experiment"}
          </button>
          {status === "done" ? <span className="text-sm text-neutral-500">Run complete (placeholder).</span> : null}
        </div>
        <p className="mt-2 text-xs text-neutral-400">Runs the configured user model / proxies against the design. Execution is a placeholder for now.</p>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Analysis &amp; report</p>
          <Button variant="outline" size="sm" onClick={() => setNote("Report export is a placeholder for now — run the experiment first.")}>
            <Download className="mr-1 h-4 w-4" /> Export report
          </Button>
        </div>
        {note ? <p className="mb-2 text-xs text-neutral-400">{note}</p> : null}
        <div className="grid min-h-[280px] place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center">
          <div>
            <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm font-medium text-neutral-500">No results yet</p>
            <p className="mt-1 text-xs text-neutral-400">After a run, analysis and the generated report will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Review & export ----------------------------- */
