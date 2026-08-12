"use client";

import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { Upload, Plus, X, Wand2, ChevronLeft, ChevronRight, Play, BarChart3, Check, Download, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ACCENT, InfoTip, TextInput } from "./wizardUi";
import {
  Page, PAGES, isPageComplete, Answers, parseIvs, parseDvs, dvDisplayName, parseProcSteps, ProcStep, PROC_STEP_TYPES,
  USER_MODELS, UserModel, parseIdList, cognitiveParamsFor, CognitiveParam,
  cognitiveAgentFor, cogParamType, cogParamRange, cogParamIssue,
  parseCogConfig, manipulatedCogParams, trialSplit,
  parseApparatusList, ApparatusEntry, normalizeApparatusEntry, ivGroupOptions,
  instanceIdsOf, trainingInstanceIdsOf,
  STUDY_UI_ROOT, STUDY_PARAM_DEFAULTS, buildStudyUrl,
  STUDY_DATASETS, EXPLANATION_FORMS, INTERFACE_ELEMENTS, EXPLANATION_PROPERTIES,
  formOf, namespaceOf, elementsOf, instanceRangeFor, testInstanceHint, defaultSim2realInstanceIds,
  apparatusForTrial, trialStudyUrl, trialShowedXai,
  studyNaturalSize, hasXaiPropertyIv,
  sim2realPropertyOf, unsupportedIvLevels, ivFactorUnsupportedByAgent,
} from "./questions";
import { buildExportJson } from "./wizardReview";
import {
  ApiConfig, DEFAULT_API_BASE, API_BASE_KEY, API_TOKEN_KEY, SimulationMode,
  StageProgress, RunOutcome, runStudy, simulateOptionsFor, downloadResultsCsv, pngDataUris,
  TrialView, trialViewOf, runPostHoc, tablesFrom, formatCell, SimpleTable,
  dvColumnsOf, matchDvColumn, getAllResults, runAnalysis, plotGrid,
  dvCoercionWarnings, plotInteraction, ivColumnsOf,
  getHumanComparison, humanComparisonStudyFor, HumanComparisonResponse,
} from "./server";

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

// Preview for a researcher-supplied URL. Sites that forbid framing
// (X-Frame-Options / CSP frame-ancestors — e.g. Google, most banks) make the
// iframe show the browser's "refused to connect" error; we check the headers
// via /api/embed-check and show a clear fallback instead.
export function OwnUrlPreview({ url, title, naturalW, naturalH }: { url: string; title: string; naturalW: number; naturalH: number }) {
  const [blocked, setBlocked] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    setBlocked(null);
    fetch(`/api/embed-check?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setBlocked(d?.embeddable === false); })
      .catch(() => { if (!cancelled) setBlocked(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (blocked) {
    return (
      <div className="grid min-h-[160px] place-items-center bg-neutral-50/60 p-6 text-center">
        <div className="max-w-md">
          <p className="text-sm font-medium text-neutral-700">This site doesn't allow embedding</p>
          <p className="mt-1 text-xs text-neutral-400">It blocks being shown inside other pages (X-Frame-Options), so no preview is possible here. The URL itself is fine — participants will open it directly.</p>
          <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Open in a new tab ↗</a>
        </div>
      </div>
    );
  }
  if (blocked === null) {
    return <div className="grid min-h-[160px] place-items-center bg-neutral-50/60 text-sm text-neutral-400">Checking preview…</div>;
  }
  return <ScaledIframe src={url} title={title} naturalW={naturalW} naturalH={naturalH} />;
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
      // XAI-Property designs run on the Sim2Real screen — seed its train/test
      // split unless the legacy params already carry instance lists.
      params: hasXaiPropertyIv(a) && !legacyParams.trainingInstanceIds && !legacyParams.instanceIds
        ? { ...defaultSim2realInstanceIds(), ...legacyParams }
        : legacyParams,
      url: a.apparatus_url || "",
    });
    setAnswer("apparatus_list", JSON.stringify([seed]));
    setEditingId(seed.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveList(next: ApparatusEntry[]) { setAnswer("apparatus_list", JSON.stringify(next)); }
  function patchEntry(id: string, patch: Partial<ApparatusEntry>) { saveList(entries.map((e) => (e.id === id ? { ...e, ...patch } : e))); }
  function setParam(e: ApparatusEntry, k: string, v: string) { patchEntry(e.id, { params: { ...e.params, [k]: v } }); }
  // XAI Property designs run on the Sim2Real interface — seed new configs accordingly.
  const hasXP = hasXaiPropertyIv(a);
  function addEntry() {
    const seedParams = hasXP ? { appId: "adult_sim2real", ...defaultSim2realInstanceIds() } : {};
    const e = normalizeApparatusEntry({ label: `Configuration ${entries.length + 1}`, group: "All participants", mode: "ours", params: seedParams, url: "" });
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
    const ds = STUDY_DATASETS.find((d) => d.appId === (p.appId || "wine_quality"))?.label ?? p.appId;
    const n = instanceIdsOf(p).length || 1;
    const nTrain = trainingInstanceIdsOf(p).length;
    const what = namespaceOf(p) === "sim2real"
      ? `XAI Property: ${sim2realPropertyOf(p)}`
      : EXPLANATION_FORMS.find((f) => f.id === formOf(p))?.label ?? formOf(p);
    return `Our interface · ${what}, ${ds} · ${nTrain ? `${nTrain} practice + ` : ""}${n} trial${n === 1 ? "" : "s"}`;
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
                    const sim2real = ns === "sim2real";
                    const els = elementsOf(p);
                    const range = instanceRangeFor(p);
                    const ids = instanceIdsOf(p);
                    const trainIds = trainingInstanceIdsOf(p);
                    const hint = testInstanceHint(p); // what's left for testing once training has taken its share
                    const outOfRange = (id: string) => { const n = Number(id); return !Number.isInteger(n) || n < range.min || n > range.max; };
                    const badIds = [...trainIds, ...ids].filter(outOfRange);
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
                        {!hasXP && sim2real ? (
                          <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                            This dataset uses the <strong>Sim2Real (XAI Property)</strong> interface — it's meant for designs where XAI Property is the independent variable.
                          </p>
                        ) : null}
                        {/* Choose interface elements — not applicable to the Sim2Real study screen (no widget system) */}
                        {!sim2real ? (
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
                        ) : null}

                        {/* Material configuration */}
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Material configuration</p>
                          <p className="mt-0.5 text-xs text-neutral-400">Choose the explanation and example shown in the preview. The dataset comes from the Study Design page; the AI model is set automatically by the dataset.</p>
                          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <ParamField label="Dataset">
                              <div className={cn(pcls, "bg-neutral-50 text-neutral-500")} title="Set on the Study Design page (or by this group's Dataset IV level)">{dsLabel}</div>
                            </ParamField>
                            {!sim2real ? (
                              <ParamField label="Explanation form">
                                <select value={form} onChange={(ev) => setParam(e, "form", ev.target.value)} className={pcls}>
                                  {EXPLANATION_FORMS.map((f) => (<option key={f.id} value={f.id}>{f.label}</option>))}
                                </select>
                              </ParamField>
                            ) : null}
                            {sim2real ? (
                              <>
                                {/* Sim2Real only supports LIME; the URL's expMethod param carries the property condition. */}
                                <ParamField label="Explanation method">
                                  <div className={cn(pcls, "bg-neutral-50 text-neutral-500")} title="Sim2Real supports LIME only">LIME</div>
                                </ParamField>
                                <ParamField label="Explanation property">
                                  <select value={sim2realPropertyOf(p)} onChange={(ev) => setParam(e, "expMethod", ev.target.value)} className={pcls}>
                                    {EXPLANATION_PROPERTIES.map((x) => (<option key={x} value={x}>{x}</option>))}
                                  </select>
                                </ParamField>
                              </>
                            ) : ns === "local" ? (
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
                            <ParamField label={`Train instances (trials) · ${range.min}–${range.max}`}>
                              <input
                                type="text"
                                value={p.trainingInstanceIds ?? ""}
                                onChange={(ev) => setParam(e, "trainingInstanceIds", ev.target.value)}
                                placeholder="optional — e.g. 0-9"
                                className={pcls}
                              />
                            </ParamField>
                            {/* The test range narrows past whatever the train list has taken. */}
                            <ParamField label={`Test instances (trials) · ${hint.min}–${hint.max}`}>
                              <input
                                type="text"
                                value={p.instanceIds ?? ids.join(", ")}
                                onChange={(ev) => setParam(e, "instanceIds", ev.target.value)}
                                placeholder={`e.g. ${hint.min}-${Math.min(hint.min + 9, hint.max)}`}
                                className={pcls}
                              />
                            </ParamField>
                          </div>

                          {ids.length ? (
                            <p className="mt-2 text-xs text-neutral-400">
                              {trainIds.length ? <>Generates <span className="font-medium text-neutral-600">{trainIds.length}</span> practice trial{trainIds.length === 1 ? "" : "s"} <span className="text-neutral-500">(feedback shown, instances {trainIds.join(", ")})</span> followed by </> : <>Generates </>}
                              <span className="font-medium text-neutral-600">{ids.length}</span> test trial{ids.length === 1 ? "" : "s"} — instances {ids.join(", ")}. Each participant sees one instance per trial.
                            </p>
                          ) : (
                            <p className="mt-2 text-xs text-amber-600">Enter at least one test instance ID (e.g. <code>0, 3, 7</code> or a range <code>0-9</code>) — this defines the trials in the generated survey.</p>
                          )}
                          {badIds.length ? (
                            <p className="mt-1 text-xs font-medium text-red-600">Out of range for {dsLabel} (the {ns} interface allows {range.min}–{range.max}): {badIds.join(", ")}. The two interfaces index different corpora — re-check IDs after changing the explanation form.</p>
                          ) : null}
                          {hint.overlap.length ? (
                            <p className="mt-1 text-xs font-medium text-red-600">
                              Instance{hint.overlap.length === 1 ? "" : "s"} {hint.overlap.join(", ")} {hint.overlap.length === 1 ? "is" : "are"} in both the train and test lists — participants would be tested on an instance they already practised. Remove {hint.overlap.length === 1 ? "it" : "them"} from one list.
                            </p>
                          ) : null}

                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                            {sim2real ? flagCheck("Show change to consider (delta)", p.showDelta !== "0", () => setParam(e, "showDelta", p.showDelta === "0" ? "1" : "0")) : null}
                            {sim2real ? flagCheck("Show AI prediction", p.showPrediction !== "0", () => setParam(e, "showPrediction", p.showPrediction === "0" ? "1" : "0")) : null}
                            {sim2real ? flagCheck("Show question", p.showQuestion !== "0", () => setParam(e, "showQuestion", p.showQuestion === "0" ? "1" : "0")) : null}
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
                        {(() => {
                          const nat = studyNaturalSize(e.mode, entryParams(e));
                          return e.mode === "own"
                            ? <OwnUrlPreview url={preview} title={`Preview ${e.label}`} naturalW={nat.w} naturalH={nat.h} />
                            : <ScaledIframe src={preview} title={`Preview ${e.label}`} naturalW={nat.w} naturalH={nat.h} />;
                        })()}
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

  const cogAgent = cognitiveAgentFor(a.user_model);
  const cogParams: CognitiveParam[] = cogAgent ? cognitiveParamsFor(cogAgent) : [];
  const cogCfg: Record<string, string> = parseCogConfig(a);
  function setCog(name: string, val: string) {
    setAnswer("cog_config", JSON.stringify({ ...cogCfg, [name]: val }));
  }
  // Cognitive parameters manipulated as an IV in Study Design (kept in sync — those are varied, not fixed here).
  const manipulatedCog = manipulatedCogParams(a);

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
          {m.category !== "Cognitive model" ? <span className="mt-0.5 block text-sm text-neutral-500">{m.description}</span> : null}
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
      <p className="mt-1 text-sm text-neutral-400">Pick the model you're studying, plus any baselines to compare against. Sections marked <span className="font-medium text-amber-500">*</span> are required.</p>

      <div className="mt-6 space-y-6">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400"><span className="mr-0.5 text-amber-500" title="Required">*</span>User model · select one</p>
          <div className="space-y-2">
            {userModels.map((m) => (
              <Card key={m.id} m={m} multi={false} on={a.user_model === m.id} onClick={() => setAnswer("user_model", m.id)} />
            ))}
          </div>
          {(() => {
            // CoAX and CoXAM support different IV levels — flag conflicts with the Study Design.
            const agentOfModel = a.user_model ? cognitiveAgentFor(a.user_model) || "CoAX" : "";
            if (!agentOfModel) return null;
            const conflicts = parseIvs(a)
              .map((e) => {
                const label = e.label || e.factor;
                if (ivFactorUnsupportedByAgent(e, agentOfModel)) return `the ${label} IV (not supported at all)`;
                const bad = unsupportedIvLevels(e, agentOfModel);
                return bad.length ? `${label}: ${bad.join(", ")}` : "";
              })
              .filter(Boolean);
            return conflicts.length ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {agentOfModel} does not support {conflicts.join(" · ")} from your Study Design — adjust the IVs there or pick the other model.
              </p>
            ) : null;
          })()}
        </div>

        {cogParams.length ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Cognitive parameters · {a.user_model}</p>
            <div className="space-y-2">
              {cogParams.map((p) => {
                const manip = manipulatedCog[p.name];
                const isManip = manip !== undefined;
                const range = cogParamRange(p);
                const kind = cogParamType(p);
                return (
                  <div key={p.name} className="rounded-xl border border-neutral-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-neutral-800">{p.name}</span>
                      <span className="shrink-0 text-xs text-neutral-400">
                        {kind === "enum" ? (p.options || []).join(" · ") : range ? `range ${range.min} – ${range.max}` : ""}
                      </span>
                    </div>
                    {p.note ? <p className="mt-0.5 text-xs text-neutral-400">{p.note}</p> : null}
                    {isManip ? (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: ACCENT }}>Manipulated in Study Design</span>
                        <span className="text-neutral-600">{manip || "set as an IV"}</span>
                      </div>
                    ) : (() => {
                      const v = cogCfg[p.name] ?? "";
                      const issue = cogParamIssue(p, v);
                      const bad = issue?.level === "error";
                      return (
                        <div>
                          {/* Enum parameters pick from their options; everything else stays a number field. */}
                          {kind === "enum" ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {(p.options || []).map((opt) => {
                                const on = v === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setCog(p.name, on ? "" : opt)}
                                    className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", on ? "border-transparent text-white" : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100")}
                                    style={on ? { backgroundColor: ACCENT } : undefined}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center gap-2 text-sm">
                              <span className="text-neutral-500">Value:</span>
                              <input
                                type="number"
                                value={v}
                                onChange={(e) => setCog(p.name, e.target.value)}
                                placeholder={range ? `${range.min} – ${range.max}` : ""}
                                className={cn("w-28 border-0 border-b bg-transparent px-0 py-0.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400", bad ? "border-red-400 focus:border-red-500" : "border-neutral-200 focus:border-neutral-500")}
                              />
                            </div>
                          )}
                          {issue ? (
                            <p className={cn("mt-1 text-xs font-medium", bad ? "text-red-600" : "text-amber-700")}>{issue.message}</p>
                          ) : null}
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

/**
 * One trial: the explanation preview on top, the predictions below.
 *
 * The preview is deliberately empty. Drawing the explanation the trial was
 * actually simulated with needs per-trial data the server does not expose yet
 * (the /explanations stage writes them to disk; nothing reads them back), and
 * the hosted apparatus renderer would show its own explanation rather than
 * that one. The frame and the prediction rows work now; the preview fills in
 * once the endpoint lands.
 */
// Rows carry raw 0/1. What they mean depends on the question the run asked:
// a class ("Type 1"/"Type 2") for CoAX and CoXAM, a direction for Sim2Real,
// whose counterfactual screen asks whether income goes higher or lower.
const ANSWER_LABELS: Record<TrialView["answerKind"], string[]> = {
  class: ["Type 1", "Type 2"],
  direction: ["Lower", "Higher"],
};
const ANSWER_COLORS = ["#dc2626", "#2563eb"]; // 0 red, 1 blue

function answerIndex(v: string): number {
  const n = Number((v ?? "").trim());
  return Number.isInteger(n) && n >= 0 && n < 2 ? n : -1;
}
function answerLabel(v: string, kind: TrialView["answerKind"]): string {
  const i = answerIndex(v);
  return i < 0 ? v : ANSWER_LABELS[kind][i];
}
function answerColor(v: string): string {
  const i = answerIndex(v);
  return i < 0 ? "#1c1917" : ANSWER_COLORS[i];
}

export function TrialPreview({ view, caseNumber, url }: { view: TrialView; caseNumber: number; url?: string }) {
  // Every design here (forward- or counterfactual-simulation, on every agent)
  // has the participant predict the AI, never the dataset's true label — so
  // "AI prediction" is the only reference that means anything. A dataset ground
  // truth is deliberately not shown as its own row: some result rows carry a
  // ground_truth/target/etc. column anyway (left over from the source
  // dataset), and showing it next to "AI prediction" reads as if it were the
  // thing being measured, which it isn't.
  const rows: { key: string; label: string; text: string; note?: string; badge: string; icon: ReactNode }[] = [
    {
      key: "sim",
      label: "Virtual Participant",
      text: view.simulation?.prediction ?? "",
      note: view.probCorrect !== null ? `P(correct) ${view.probCorrect.toFixed(0)}%`
        : view.simulation?.confidence != null ? `Confidence ${view.simulation.confidence.toFixed(0)}%`
          : undefined,
      badge: "#1d4ed8",
      icon: <Bot className="h-4 w-4" />,
    },
    {
      key: "human",
      label: "Human",
      text: view.human?.prediction ?? "",
      note: view.human?.confidence != null ? `Confidence ${view.human.confidence.toFixed(0)}%` : undefined,
      badge: "#e8590c",
      icon: <User className="h-4 w-4" />,
    },
    {
      key: "ai",
      label: "AI prediction",
      text: view.ai?.prediction ?? "",
      note: view.ai?.confidence != null ? `Confidence ${view.ai.confidence.toFixed(0)}%` : undefined,
      badge: "#7c2d12",
      icon: <span className="text-[9px] font-bold leading-none">AI</span>,
    },
  ].filter((r) => r.text !== "");

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      <p className="border-b border-neutral-200 px-3 py-2 text-center text-sm text-neutral-700">
        Case {caseNumber}
        {view.instanceId ? <> · Instance {view.instanceId}</> : null}
        {view.phase || view.step ? (
          <span className="text-neutral-400"> · {[view.phase, view.step].filter(Boolean).join(" / ")}</span>
        ) : null}
        <span className="text-neutral-400">
          {" · "}
          {trialShowedXai(view)
            ? `with XAI${view.shownXaiType ? ` (${view.shownXaiType})` : ""}`
            : "without XAI"}
        </span>
      </p>

      {/* The study interface replayed at this trial's instance. Note this is the
          renderer's own explanation for the instance, not the one the run
          generated — those are only on the server's disk today. */}
      {url ? (
        <iframe
          src={url}
          title={`Trial ${caseNumber} — instance ${view.instanceId}`}
          className="block w-full border-b border-neutral-200"
          style={{ height: 620 }}
        />
      ) : (
        <div className="grid min-h-[220px] place-items-center border-b border-neutral-200 bg-neutral-50/60 p-6 text-center">
          <p className="max-w-sm text-xs text-neutral-400">
            No interface for this trial — the results carry no instance id, or the apparatus for this condition uses your own URL.
          </p>
        </div>
      )}

      <p className="px-3 pb-1 pt-2 text-center text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">
        Prediction
      </p>

      <div className="divide-y divide-neutral-100 border-t border-neutral-100">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 px-4 py-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white" style={{ backgroundColor: r.badge }}>
              {r.icon}
            </span>
            <span className="w-32 shrink-0 text-[15px] text-neutral-400">{r.label}</span>
            <span className="flex-1 font-mono text-[15px] font-semibold tracking-tight" style={{ color: answerColor(r.text) }}>
              {answerLabel(r.text, view.answerKind)}
            </span>
            {r.note ? <span className="shrink-0 font-mono text-sm text-neutral-400">{r.note}</span> : null}
          </div>
        ))}
      </div>

      {view.matchesAi !== null ? (
        // Amber rather than red for a mismatch: red already means "Type 1" above.
        <p className="border-t border-neutral-100 px-4 py-2 text-xs" style={{ color: view.matchesAi ? ACCENT : "#b45309" }}>
          {view.matchesAi ? "Virtual participant matched the AI prediction" : "Virtual participant differed from the AI prediction"}
        </p>
      ) : null}
    </div>
  );
}

// Renders whatever rows the server returned — columns follow the payload, so
// this survives the analysis / post-hoc schemas changing shape.
function StatTable({ table }: { table: SimpleTable }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  // Only advertise scrolling when the table really is wider than its box.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const over = el.scrollWidth > el.clientWidth + 1;
      setOverflow(over);
      setAtEnd(!over || el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => { el.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [table]);

  return (
    <div className="rounded-xl border border-neutral-200">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
        {table.label ? <p className="text-xs font-medium text-neutral-500">{table.label}</p> : null}
        {overflow ? (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-neutral-400">
            scroll for {table.columns.length} columns <ChevronRight className="h-3 w-3" />
          </span>
        ) : null}
      </div>
      <div className="relative">
        {/* Fade on the right edge while there is more table off-screen. */}
        {overflow && !atEnd ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent" />
        ) : null}
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-neutral-400">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-1.5 font-medium">{c.replace(/_/g, " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-neutral-700">
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  {table.columns.map((c) => (
                    <td key={c} className="whitespace-nowrap px-3 py-1.5 font-mono">{formatCell(r[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HumanComparisonTableView({ table }: { table: HumanComparisonResponse["fit_stats"]["tables"][number] }) {
  const formatFit = (cell: HumanComparisonResponse["fit_stats"]["tables"][number]["models"][number]["cells"][string]) => {
    if (!cell || typeof cell.nll_mean !== "number") return "—";
    const mean = cell.nll_mean.toFixed(2);
    return typeof cell.nll_sd === "number" ? `${mean} ± ${cell.nll_sd.toFixed(2)}` : mean;
  };

  return (
    <div className="rounded-xl border border-neutral-200">
      <div className="border-b border-neutral-100 px-3 py-2">
        <h4 className="text-sm font-medium text-neutral-800">{table.title}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-neutral-400">
            <tr>
              <th className="whitespace-nowrap px-3 py-1.5 font-medium">Model</th>
              {table.facets.map((f) => (
                <th key={f} className="whitespace-nowrap px-3 py-1.5 font-medium">{f}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-neutral-700">
            {table.models.map((m) => (
              <tr key={m.name} className={cn("border-t border-neutral-100", m.is_target ? "bg-emerald-50/60" : "")}>
                <td className="whitespace-nowrap px-3 py-1.5 font-medium">{m.label}</td>
                {table.facets.map((f) => (
                  <td key={f} className="whitespace-nowrap px-3 py-1.5 font-mono">{formatFit(m.cells[f])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HumanComparisonPanelView({
  data,
  study,
  loading,
  error,
}: {
  data: HumanComparisonResponse | null;
  study: string;
  loading: boolean;
  error: string;
}) {
  const plotSrc = data
    ? data.plot_png.startsWith("data:")
      ? data.plot_png
      : `data:image/png;base64,${data.plot_png}`
    : "";

  return (
    <div className="space-y-4" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Published comparison</p>
        <span className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-500">{study}</span>
      </div>

      {loading ? <p className="text-xs text-neutral-400">Loading published comparison…</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

      {data ? (
        <>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={plotSrc}
              alt={data.panels?.task || "Human vs Virtual comparison plot"}
              className="mx-auto block h-auto w-full max-w-full"
            />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">
              {data.fit_stats.name || "Fit statistics"}
            </p>
            {data.fit_stats.tables.map((table) => (
              <HumanComparisonTableView key={table.title} table={table} />
            ))}
          </div>
        </>
      ) : !loading && !error ? (
        <div className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center">
          <p className="max-w-sm text-xs text-neutral-400">No human-comparison payload has been loaded yet.</p>
        </div>
      ) : null}
    </div>
  );
}

// A finished run's outcome (rows/analysis/plot) is cached here, keyed by study
// id, so leaving Results & Report and coming back still shows it without a
// re-run or a server round trip. Kept in its own key (not folded into the
// `answers` blob) since a plot's PNG and thousands of result rows can be
// sizeable, and this only ever needs to hold the most recent run — validated
// against the current `run_study_id` on read so a stale cache (e.g. from a
// design that was since reset or re-run) is never shown as if it were current.
const RUN_OUTCOME_KEY = "xaikit-run-outcome-v1";

function loadCachedOutcome(studyId: string): RunOutcome | null {
  try {
    const raw = localStorage.getItem(RUN_OUTCOME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { studyId?: string; outcome?: RunOutcome };
    return parsed.studyId === studyId && parsed.outcome ? parsed.outcome : null;
  } catch {
    return null;
  }
}

function saveCachedOutcome(studyId: string, outcome: RunOutcome) {
  try {
    localStorage.setItem(RUN_OUTCOME_KEY, JSON.stringify({ studyId, outcome }));
  } catch {
    // Quota exceeded or storage unavailable — the run still renders for this
    // session, it just won't survive a reload.
  }
}

// Exported so a wizard reset (a new/discarded design) doesn't leave a stale
// run's results behind for the next design to accidentally pick up.
export function clearCachedRunOutcome() {
  try { localStorage.removeItem(RUN_OUTCOME_KEY); } catch { /* ignore */ }
}

export function ResultsBody({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const status = a.run_status || "idle"; // "idle" | "running" | "done" | "failed"

  const [baseUrl, setBaseUrl] = useState(DEFAULT_API_BASE);
  const [token, setToken] = useState("");
  // Runs always simulate the whole experiment; the narrower /simulate modes are
  // not exposed here.
  const mode: SimulationMode = "whole_experiment";
  const [stages, setStages] = useState<StageProgress[]>([]);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [note, setNote] = useState("");
  const [trialIdx, setTrialIdx] = useState(0);
  const [pid, setPid] = useState("");
  const [cond, setCond] = useState("");
  const [resultView, setResultView] = useState<"trial" | "overall" | "human">("trial");
  const [dv, setDv] = useState("");
  const [posthoc, setPosthoc] = useState<unknown>(null);
  const [posthocErr, setPosthocErr] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [xIv, setXIv] = useState("");
  const [hueIv, setHueIv] = useState("");
  const [interactionPlot, setInteractionPlot] = useState<string | null>(null);
  const [interactionErr, setInteractionErr] = useState("");
  const [humanComparison, setHumanComparison] = useState<HumanComparisonResponse | null>(null);
  const [humanComparisonStudy, setHumanComparisonStudy] = useState("");
  const [humanComparisonLoading, setHumanComparisonLoading] = useState(false);
  const [humanComparisonErr, setHumanComparisonErr] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  // Whether THIS mount is the one that clicked Run (owns abortRef/the live
  // promise) vs. inherited "running" from a previous mount via persisted
  // answers — see the reconnect-poll effect below.
  const startedHereRef = useRef(false);

  // The server URL and token are machine settings, not part of the design, so
  // they live in localStorage rather than in the answers. There's no UI to set
  // them anymore (kept out of Results & Report on purpose), but this still
  // picks up a value saved by an earlier build, or set directly in devtools.
  useEffect(() => {
    try {
      setBaseUrl(localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE);
      setToken(localStorage.getItem(API_TOKEN_KEY) || "");
    } catch { /* ignore */ }
  }, []);

  const cfg: ApiConfig = { baseUrl, token };

  // A finished run's outcome (rows/analysis/plot) lives only in this component's
  // state, so leaving the page and coming back would otherwise show a blank
  // results panel. `run_status`/`run_study_id` do persist (in `answers`), so on
  // (re)mount after a completed run: try the local cache first (instant, no
  // network), and only hit the server as a fallback if that cache is missing
  // (e.g. cleared, or a different browser).
  useEffect(() => {
    if (a.run_status !== "done" || !a.run_study_id || outcome) return;
    const studyId = a.run_study_id;

    const cached = loadCachedOutcome(studyId);
    if (cached) { setOutcome(cached); return; }

    let cancelled = false;
    setRestoring(true);
    setError("");
    (async () => {
      try {
        const [{ rows, plotVariables }, analysis, plot] = await Promise.all([
          getAllResults(cfg, studyId),
          runAnalysis(cfg, studyId).catch(() => undefined),
          plotGrid(cfg, studyId, { include_png: true }).catch(() => undefined),
        ]);
        if (cancelled) return;
        const restored: RunOutcome = { studyId, created: { study_id: studyId }, stages: [], results: rows, analysis, plot, plotVariables };
        setOutcome(restored);
        saveCachedOutcome(studyId, restored);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.run_status, a.run_study_id, baseUrl, token]);

  // `run_status: "running"` is persisted (in `answers`), but the actual
  // in-flight run — the AbortController and the runStudy() promise walking
  // the pipeline — lives only in THIS component instance's local state.
  // Navigating away and back remounts ResultsBody: the new instance inherits
  // "running" from storage but owns no controller and has no window into
  // whether the original run is still going, finished, or died silently —
  // that's the "stuck on Running…" bug. This polls the server directly so a
  // reconnected mount can self-heal regardless of what happened to the
  // original request.
  useEffect(() => {
    if (status !== "running" || !a.run_study_id || startedHereRef.current) return;
    const sid = a.run_study_id;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const { rows, plotVariables } = await getAllResults(cfg, sid);
        if (cancelled || !rows.length) return;
        clearInterval(timer);
        const [analysis, plot] = await Promise.all([
          runAnalysis(cfg, sid).catch(() => undefined),
          plotGrid(cfg, sid, { include_png: true }).catch(() => undefined),
        ]);
        if (cancelled) return;
        const restored: RunOutcome = { studyId: sid, created: { study_id: sid }, stages: [], results: rows, analysis, plot, plotVariables };
        setOutcome(restored);
        saveCachedOutcome(sid, restored);
        setAnswer("run_status", "done");
      } catch {
        // Not ready yet (results endpoint 404s until the run reaches the
        // collect stage) — keep polling rather than surfacing every miss.
      }
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, a.run_study_id, baseUrl, token]);

  // Only Study Design and User Model need to be finished before running a
  // simulation — the other pages (research questions, apparatus, procedure)
  // are useful for the write-up but not required by the simulation itself.
  const incomplete = PAGES.filter((p) => (p.kind === "studydesign" || p.kind === "usermodel") && !isPageComplete(p, a));
  const ready = incomplete.length === 0;

  const { options: simOptions, warning: cogWarning } = simulateOptionsFor(
    a.user_model || "",
    hasXaiPropertyIv(a),
    parseCogConfig(a),
    mode
  );
  const comparisonStudy = humanComparisonStudyFor(a.user_model || "", hasXaiPropertyIv(a));

  async function run() {
    if (!ready || status === "running") return;
    // The design is assembled here, at the click, from the finalized answers —
    // byte-identical to the Design JSON export so the two can't drift.
    let design: unknown;
    try {
      design = JSON.parse(buildExportJson(a));
    } catch (e) {
      setError(`Could not build the design JSON: ${(e as Error).message}`);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    startedHereRef.current = true;
    setError("");
    setNote("");
    setOutcome(null);
    setStages([]);
    setAnswer("run_status", "running");
    try {
      const split = trialSplit(a);
      const res = await runStudy(
        cfg,
        design,
        simOptions,
        {
          signal: ctrl.signal,
          onStages: setStages,
          onStudyId: (id) => setAnswer("run_study_id", id),
        },
        // The training / testing split set on the Study Design page.
        { trials: { num_training: split.training, num_testing: split.testing } }
      );
      setOutcome(res);
      saveCachedOutcome(res.studyId, res);
      setAnswer("run_status", "done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAnswer("run_status", "failed");
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    if (abortRef.current) {
      // This mount owns the live request — a real cancel.
      abortRef.current.abort();
      return;
    }
    // Reconnected to a "running" state this mount didn't start (e.g. after
    // navigating away and back) — there's no controller here to abort, so
    // this can only stop watching locally, not guarantee the server-side run
    // itself stops. Without this, Cancel silently did nothing and the page
    // stayed on "Running…" forever once the background poll gave up hope of
    // ever seeing results (or if the original run genuinely died).
    setAnswer("run_status", "failed");
    setError("Stopped watching this run — it may still be executing on the server, this page just isn't tracking it anymore.");
  }

  async function openHumanComparison() {
    if (!comparisonStudy) {
      setHumanComparisonErr("Pick CoAX, CoXAM, or Sim2Real on the User Model page before opening the human comparison.");
      setHumanComparison(null);
      setHumanComparisonStudy("");
      setResultView("human");
      return;
    }
    setResultView("human");
    setHumanComparisonStudy(comparisonStudy);
    setHumanComparisonErr("");
    if (humanComparison && humanComparisonStudy === comparisonStudy) return;
    setHumanComparisonLoading(true);
    try {
      const data = await getHumanComparison(cfg, comparisonStudy);
      setHumanComparison(data);
    } catch (e) {
      setHumanComparison(null);
      setHumanComparisonErr(e instanceof Error ? e.message : String(e));
    } finally {
      setHumanComparisonLoading(false);
    }
  }

  const studyId = outcome?.studyId || a.run_study_id || "";
  const rows = outcome?.results ?? [];
  const pngs = pngDataUris(outcome?.plot);
  // Trials are stepped through one participant at a time, so the case number
  // never runs past what a single participant actually saw.
  const views = rows.map(trialViewOf);
  // Condition first, then participant within it, then trial within that.
  const conditions = Array.from(new Set(views.map((v) => v.condition).filter(Boolean)));
  const activeCond = conditions.includes(cond) ? cond : conditions[0] ?? "";
  const cViews = activeCond ? views.filter((v) => v.condition === activeCond) : views;
  const participantIds = Array.from(new Set(cViews.map((v) => v.participantId).filter(Boolean)));
  const activePid = participantIds.includes(pid) ? pid : participantIds[0] ?? "";
  const pViews = activePid ? cViews.filter((v) => v.participantId === activePid) : cViews;
  const trialAt = pViews.length ? Math.min(trialIdx, pViews.length - 1) : 0;
  const trial = pViews.length ? pViews[trialAt] : null;

  // Statistics for the Overall view. The omnibus analysis comes back with the
  // run; post-hoc needs a DV, so it is fetched on demand once that view is open.
  // The server analyses its own results columns, so the options come from the
  // data; the design's DV labels only decide which one is selected first.
  const dvOptions = dvColumnsOf(rows).filter((c) => /^(forward|counterfactual)_accuracy$/.test(c));
  const designDvs = parseDvs(a.sd_dv).map(dvDisplayName).filter(Boolean);
  const preferredDv = designDvs.map((d) => matchDvColumn(d, dvOptions)).find(Boolean) ?? "";
  const activeDv = dvOptions.includes(dv) ? dv : preferredDv || dvOptions[0] || "";
  const analysisTables = tablesFrom(outcome?.analysis, "");
  const posthocTables = tablesFrom(posthoc, "");
  // Flagged when the server substituted a DV the cognitive model can't
  // produce (currently always forward_accuracy) — the tables above already
  // exclude the coerced/warning fields themselves (server.ts's tablesFrom),
  // this is what surfaces the caveat instead.
  const dvWarnings = dvCoercionWarnings(outcome?.analysis);

  useEffect(() => {
    if (resultView !== "overall" || !studyId || !activeDv) return;
    let cancelled = false;
    setPosthocErr("");
    runPostHoc(cfg, studyId, { dv: activeDv })
      .then((r) => { if (!cancelled) setPosthoc(r); })
      .catch((e) => { if (!cancelled) { setPosthoc(null); setPosthocErr(e instanceof Error ? e.message : String(e)); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultView, studyId, activeDv, baseUrl, token]);

  // Interaction plot: X-axis IV × a second IV as the split/color, for one DV
  // ("Accuracy by XAI type, split by Dataset" is the natural view once a
  // design has a Dataset IV). Options come from the server's own
  // `plot_variables` (the design's actual IVs, filtered to those present in
  // the results) — NOT the design's declared IV labels (buildExportJson's
  // `factor`, e.g. "XAI Type": /plots/interaction wants the results table's
  // real column name, "xai_type", and 400s on a label — see server.ts) — and
  // not every results column either: some (explanation_type, condition_name,
  // shown_xai_type, …) read like IVs but are explicitly rejected as plot
  // factors. Falls back to the ivColumnsOf heuristic only for an outcome
  // cached before plotVariables existed.
  const ivOptions = outcome?.plotVariables?.length ? outcome.plotVariables : ivColumnsOf(rows);
  const activeXIv = ivOptions.includes(xIv) ? xIv : ivOptions[0] || "";
  const activeHueIv = ivOptions.includes(hueIv) && hueIv !== activeXIv
    ? hueIv
    : ivOptions.find((l) => l !== activeXIv) || "";

  useEffect(() => {
    if (resultView !== "overall" || !studyId || !activeDv || !activeXIv || !activeHueIv) { setInteractionPlot(null); return; }
    let cancelled = false;
    setInteractionErr("");
    plotInteraction(cfg, studyId, { x_iv: activeXIv, hue_iv: activeHueIv, dv: activeDv, include_png: true })
      .then((r) => { if (!cancelled) setInteractionPlot(pngDataUris(r)[0] ?? null); })
      .catch((e) => { if (!cancelled) { setInteractionPlot(null); setInteractionErr(e instanceof Error ? e.message : String(e)); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultView, studyId, activeDv, activeXIv, activeHueIv, baseUrl, token]);

  // Replay the trial on the study interface: the apparatus config for this
  // trial's condition, at the instance the run actually used.
  const trialUrl = (() => {
    if (!trial || !trial.instanceId) return "";
    const entry = apparatusForTrial(parseApparatusList(a), { condition: trial.condition, datasetId: trial.datasetId });
    if (entry?.mode === "own") return (entry.url || "").trim();
    return trialStudyUrl(STUDY_UI_ROOT, entry, {
      instanceId: trial.instanceId,
      phase: trial.phase,
      condition: trial.condition,
      shownXaiType: trial.shownXaiType,
      datasetId: trial.datasetId,
      explanationType: trial.explanationType,
      xaiType: trial.xaiType,
      testedWithXai: trial.testedWithXai,
      xaiProperty: trial.xaiProperty,
    });
  })();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Results & report</h1>
      <p className="mt-1 text-sm text-neutral-500">Run the experiment on the study server, then review the results, CSV and plots it returns.</p>

      <div className="mt-6 rounded-xl border border-neutral-200 p-4" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            disabled={status === "running" || !ready}
            title={ready ? undefined : "Finish the design first"}
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            <Play className="h-4 w-4" /> {status === "running" ? "Running…" : "Run experiment"}
          </button>
          {status === "running" ? (
            <Button variant="outline" size="sm" onClick={cancel}>Cancel</Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (resultView === "human") {
                setResultView(rows.length || pngs.length ? "overall" : "trial");
                return;
              }
              openHumanComparison();
            }}
            title={comparisonStudy ? undefined : "Pick CoAX, CoXAM, or Sim2Real on the User Model page first"}
          >
            <User className="mr-1 h-4 w-4" /> Human vs Virtual
          </Button>
        </div>

        <p className="mt-2 text-xs text-neutral-400">
          {status === "running"
            ? "The simulator is running the experiment you have planned."
            : status === "done"
              ? "The simulator has completed the experiment you planned."
              : "The simulator will run the experiment you have planned."}
        </p>

        {!ready ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Finish the design before running — still incomplete: {incomplete.map((p) => p.navTitle).join(", ")}.
          </p>
        ) : null}
        {restoring ? (
          <p className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            Loading your previous run&apos;s results…
          </p>
        ) : null}
        {cogWarning ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{cogWarning}</p>
        ) : null}
        {error ? (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        ) : null}
      </div>

      {stages.length ? (
        <div className="mt-6 rounded-xl border border-neutral-200 p-4" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Run progress</p>
          </div>
          <ol className="space-y-1.5">
            {stages.map((s) => (
              <li key={s.stage} className="text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px]",
                      s.status === "succeeded" ? "text-white"
                        : s.status === "failed" ? "bg-red-500 text-white"
                          : s.status === "running" ? "border-2 border-neutral-300 border-t-neutral-500 animate-spin"
                            : "border border-neutral-300"
                    )}
                    style={s.status === "succeeded" ? { backgroundColor: ACCENT } : undefined}
                  >
                    {s.status === "succeeded" ? <Check className="h-2.5 w-2.5" /> : null}
                  </span>
                  <span className={cn(s.status === "pending" ? "text-neutral-400" : "text-neutral-800")}>{s.label}</span>
                  {typeof s.elapsed === "number" ? <span className="text-xs text-neutral-400">{s.elapsed.toFixed(0)}s</span> : null}
                </div>
                {s.error ? <p className="ml-6 mt-0.5 text-xs text-red-600">{s.error}</p> : null}
                {s.status === "running" && s.log ? (
                  <pre className="ml-6 mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-2 text-[11px] leading-relaxed text-neutral-500">{s.log.slice(-1200)}</pre>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Analysis &amp; report</p>
          {studyId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadResultsCsv(cfg, studyId).catch((e) => setNote(e.message))}
            >
              <Download className="mr-1 h-4 w-4" /> Results CSV
            </Button>
          ) : null}
        </div>
        {note ? <p className="mb-2 text-xs text-red-600">{note}</p> : null}

        {rows.length || pngs.length || resultView === "human" ? (
          <div className="space-y-4" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">
                  {resultView === "trial" ? "Trial by trial" : resultView === "overall" ? "Overall" : "Human vs Virtual"}
                </p>

                {/* Trial-scoped controls only make sense in the trial view. */}
                {resultView === "trial" ? (
                  <>
                    {/* Always shown, even with a single condition, so it never
                        looks like the control vanished. */}
                    {conditions.length ? (
                      <select
                        value={activeCond}
                        onChange={(ev) => { setCond(ev.target.value); setPid(""); setTrialIdx(0); }}
                        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-400"
                        aria-label="Condition"
                      >
                        {conditions.map((c) => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    ) : null}
                    {participantIds.length ? (
                      <select
                        value={activePid}
                        onChange={(ev) => { setPid(ev.target.value); setTrialIdx(0); }}
                        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-400"
                        aria-label="Participant"
                      >
                        {participantIds.map((id) => (<option key={id} value={id}>Participant {id}</option>))}
                      </select>
                    ) : null}
                    {pViews.length ? <span className="text-xs text-neutral-400">trial {trialAt + 1} of {pViews.length}</span> : null}
                  </>
                ) : null}

                <div className="ml-auto flex items-center gap-2">
                  {resultView === "trial" && pViews.length ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTrialIdx(Math.max(0, trialAt - 1))}
                        disabled={trialAt <= 0}
                        className="rounded-md border border-neutral-200 p-1 text-neutral-500 disabled:opacity-40 hover:bg-neutral-50"
                        aria-label="Previous trial"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrialIdx(Math.min(pViews.length - 1, trialAt + 1))}
                        disabled={trialAt >= pViews.length - 1}
                        className="rounded-md border border-neutral-200 p-1 text-neutral-500 disabled:opacity-40 hover:bg-neutral-50"
                        aria-label="Next trial"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  <div className="flex overflow-hidden rounded-md border border-neutral-200">
                    {(["trial", "overall"] as const).map((k) => {
                      const on = resultView === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setResultView(k)}
                          className={cn("px-2.5 py-1 text-xs font-medium capitalize transition-colors", on ? "text-white" : "bg-white text-neutral-500 hover:bg-neutral-50")}
                          style={on ? { backgroundColor: ACCENT } : undefined}
                        >
                          {k}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {resultView === "human" ? (
                <HumanComparisonPanelView
                  data={humanComparison}
                  study={humanComparisonStudy || comparisonStudy || "not selected"}
                  loading={humanComparisonLoading}
                  error={humanComparisonErr}
                />
              ) : resultView === "trial" ? (
                trial ? (
                  <TrialPreview view={trial} caseNumber={trialAt + 1} url={trialUrl} />
                ) : (
                  <div className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center">
                    <p className="text-xs text-neutral-400">No trials in this selection.</p>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  {pngs.length ? (
                    // Two-up once the server returns more than one *separate*
                    // figure, each capped so the pair stays readable; a single
                    // figure (often a multi-panel composite, e.g. one XAI-type
                    // /Tested-W-XAI/Dataset grid) instead gets the full width —
                    // capping it the same as a lone panel squeezed every
                    // sub-plot down to unreadable.
                    <div className={cn("grid gap-3", pngs.length > 1 ? "sm:grid-cols-2" : "")}>
                      {pngs.map((src, i) => (
                        <div key={i} className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={`Overall results plot ${i + 1} rendered by the study server`}
                            className={cn("mx-auto block h-auto w-full", pngs.length > 1 ? "max-w-[420px]" : "max-w-full")}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center">
                      <p className="max-w-sm text-xs text-neutral-400">No overall plot came back from the server for this run.</p>
                    </div>
                  )}

                  {ivOptions.length > 1 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Interaction plot</p>
                        {dvOptions.length > 1 ? (
                          <select
                            value={activeDv}
                            onChange={(ev) => setDv(ev.target.value)}
                            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-400"
                            aria-label="Dependent variable"
                          >
                            {dvOptions.map((d) => (<option key={d} value={d}>{d}</option>))}
                          </select>
                        ) : null}
                        <select
                          value={activeXIv}
                          onChange={(ev) => setXIv(ev.target.value)}
                          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-400"
                          aria-label="X-axis IV"
                        >
                          {ivOptions.map((l) => (<option key={l} value={l}>{l.replace(/_/g, " ")}</option>))}
                        </select>
                        <span className="text-xs text-neutral-400">split by</span>
                        <select
                          value={activeHueIv}
                          onChange={(ev) => setHueIv(ev.target.value)}
                          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-400"
                          aria-label="Split-by IV"
                        >
                          {ivOptions.filter((l) => l !== activeXIv).map((l) => (<option key={l} value={l}>{l.replace(/_/g, " ")}</option>))}
                        </select>
                      </div>
                      {interactionErr ? (
                        <p className="text-xs text-amber-700">{interactionErr}</p>
                      ) : interactionPlot ? (
                        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={interactionPlot}
                            alt={`${activeDv || "Results"} by ${activeXIv}, split by ${activeHueIv}`}
                            className="mx-auto block h-auto w-full max-w-[420px]"
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400">Loading interaction plot…</p>
                      )}
                    </div>
                  ) : null}

                  {dvWarnings.length ? (
                    <div className="space-y-1.5">
                      {dvWarnings.map((w, i) => (
                        <p key={i} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {w.dv ? <span className="font-medium">{w.dv}: </span> : null}{w.message}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {analysisTables.length ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Statistical analysis</p>
                      {analysisTables.map((t, i) => (<StatTable key={i} table={t} />))}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Pairwise comparisons</p>
                      {dvOptions.length > 1 ? (
                        <select
                          value={activeDv}
                          onChange={(ev) => setDv(ev.target.value)}
                          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-400"
                          aria-label="Dependent variable"
                        >
                          {dvOptions.map((d) => (<option key={d} value={d}>{d}</option>))}
                        </select>
                      ) : activeDv ? <span className="text-xs text-neutral-400">{activeDv}</span> : null}
                    </div>
                    {posthocErr ? (
                      <p className="text-xs text-amber-700">{posthocErr}</p>
                    ) : posthocTables.length ? (
                      posthocTables.map((t, i) => (<StatTable key={i} table={t} />))
                    ) : (
                      <p className="text-xs text-neutral-400">{activeDv ? "Loading pairwise comparisons…" : "Set a dependent variable on the Study Design page to see pairwise comparisons."}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* The raw rows are downloaded, not rendered — a run is thousands of
                them, and the trial viewer above is the readable form. */}
            {rows.length ? (
              <p className="text-xs text-neutral-400">
                {rows.length} row{rows.length === 1 ? "" : "s"} · {participantIds.length} participant{participantIds.length === 1 ? "" : "s"} in {activeCond || "this run"} — use Results CSV for the full data.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid min-h-[280px] place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center">
            <div>
              <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" />
              <p className="mt-2 text-sm font-medium text-neutral-500">No results yet</p>
              <p className="mt-1 text-xs text-neutral-400">After a run, the results table, plots and analysis from the server appear here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Review & export ----------------------------- */
