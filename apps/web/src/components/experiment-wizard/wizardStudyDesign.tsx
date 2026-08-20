"use client";

import React, { useState, useEffect, useRef } from "react";
import { Upload, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT, SERIF, COMMON_VAR_TYPES, InfoTip, DocLabel, DocSelect, TextInput } from "./wizardUi";
import {
  Answers, IvEntry, IvFactor, IV_CATALOG, IV_GROUP_ORDER, ivFactorsForAgent, ivLevelsFor,
  ALLOC_OPTIONS, BALANCING_METHODS, parseIvs, totalCells, betweenCells, validateParticipants,
  participantGroups, withinCoverage, unsupportedIvLevels, ivFactorUnsupportedByAgent,
  DATASET_OPTIONS, DV_CATALOG, DV_GROUP_ORDER, DvEntry, parseDvs, Variable, parseVars,
  ivAgentFor, cogParamType, cogParamRange,
  hasXaiPropertyIv, dvUnsupportedByAgent, datasetUnsupportedByAgent,
  trialSplit, DEFAULT_TRAINING_TRIALS, DEFAULT_TESTING_TRIALS,
} from "./questions";

export function StudyDesignBody({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const ivs = parseIvs(a);
  const cells = totalCells(ivs);
  const check = validateParticipants(a);
  const checkColor =
    check?.level === "ok" ? "text-emerald-700"
      : check?.level === "warn" ? "text-amber-700"
        : "text-sky-700";

  return (
    <div style={{ fontFamily: SERIF }}>
      <h1 className="text-2xl font-semibold leading-snug tracking-tight" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
        Study design{" "}
        <InfoTip>
          This is the heart of the experiment: what you <span className="font-medium text-neutral-800">measure</span>, what you <span className="font-medium text-neutral-800">change on purpose</span>, and what you <span className="font-medium text-neutral-800">keep the same</span> so any difference in results can be attributed to your manipulation. Each section below has its own ⓘ for what it means.
        </InfoTip>
      </h1>
      <p className="mt-1 text-sm text-neutral-400" style={{ fontFamily: "ui-sans-serif, system-ui" }}>Define what you measure, change, and hold constant. Type directly, or let the assistant fill it in. Sections marked <span className="font-medium text-amber-500">*</span> are required.</p>

      <div className="mt-8 space-y-7">
        <div>
          <DocLabel required tip={<span>The outcome you <span className="font-medium text-neutral-800">measure</span> — e.g. accuracy, decision time, trust. This is what your research question is really about. Pick from the list or define a custom one with a formula.</span>}>Dependent Variables (DV)</DocLabel>
          <DvBuilder answers={answers} setAnswer={setAnswer} />
        </div>

        <div>
          <DocLabel required tip={<span>What you <span className="font-medium text-neutral-800">deliberately vary</span> across conditions (e.g. explanation vs none). Each IV and its levels create the conditions participants are split across.</span>}>Independent Variable(s)</DocLabel>
          <IvBuilder answers={answers} setAnswer={setAnswer} />
        </div>

        <div>
          <DocLabel tip={<span>Things you <span className="font-medium text-neutral-800">hold constant</span> across every condition so they can't be an alternative explanation for your results (e.g. same dataset, same device).</span>}>Control Variables (CV)</DocLabel>
          <VariableList valueKey="sd_cv" answers={answers} setAnswer={setAnswer} namePlaceholder="e.g. dataset" />
        </div>

        <div>
          <DocLabel tip={<span>Things that <span className="font-medium text-neutral-800">vary between people or trials but aren't controlled</span> — e.g. the participant, or the order trials happen to appear in.</span>}>Random Variables (RV)</DocLabel>
          <VariableList valueKey="sd_rv" answers={answers} setAnswer={setAnswer} namePlaceholder="e.g. participant, stimulus order" />
        </div>

        {(() => {
          // When Dataset is manipulated as an IV, its levels define the datasets:
          //  - Dataset is the ONLY IV → the picker below is redundant; hide it.
          //  - other IVs exist too → keep the picker (it sets the dataset used by
          //    the other IVs' trials) with a note clarifying its scope.
          const datasetIsIv = ivs.some((e) => e.factor === "dataset");
          const otherIvsExist = ivs.some((e) => e.factor && e.factor !== "dataset");
          if (datasetIsIv && !otherIvsExist) return null;
          return (
            <div className="border-t border-neutral-100 pt-6">
              <DocLabel>Dataset</DocLabel>
              <DatasetPicker answers={answers} setAnswer={setAnswer} />
              {datasetIsIv ? (
                <p className="mt-1.5 text-xs text-amber-700" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
                  Dataset is also an independent variable — this selection applies only to the other IVs' trials; the Dataset IV compares the datasets chosen as its levels above.
                </p>
              ) : null}
            </div>
          );
        })()}

        <div className="border-t border-neutral-100 pt-6">
          <DocLabel required>Participants</DocLabel>
          {(() => {
            const numCls = "w-16 border-0 border-b border-neutral-200 bg-transparent px-0 py-0.5 text-center text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500";
            const per = parseInt(a.sd_participants || "", 10) || 0;
            const between = betweenCells(ivs);
            const totalP = per * (between || 1);
            const split = trialSplit(a);
            const trials = split.total;
            const totalTrials = totalP * trials;
            return (
              <>
                <p className="mt-1 text-[15px] leading-8 text-neutral-800">
                  We will recruit{" "}
                  <input type="number" value={a.sd_participants ?? ""} onChange={(e) => setAnswer("sd_participants", e.target.value)} placeholder="N" className={numCls} />{" "}
                  participants for each condition.
                </p>
                <p className="text-[15px] leading-8 text-neutral-800">
                  Each participant completes{" "}
                  <input type="number" min={0} value={a.sd_trials_training ?? String(split.training)} onChange={(e) => setAnswer("sd_trials_training", e.target.value)} placeholder={String(DEFAULT_TRAINING_TRIALS)} className={numCls} />{" "}
                  training trials and{" "}
                  <input type="number" min={0} value={a.sd_trials_testing ?? String(split.testing)} onChange={(e) => setAnswer("sd_trials_testing", e.target.value)} placeholder={String(DEFAULT_TESTING_TRIALS)} className={numCls} />{" "}
                  testing trials.
                </p>
                <div className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
                  <div><span className="text-neutral-400">Total participants:</span> <span className="font-medium text-neutral-800">{totalP}</span> ({per} × {between || 1} between-subjects group{between === 1 ? "" : "s"}, {cells} cell{cells === 1 ? "" : "s"})</div>
                  <div><span className="text-neutral-400">Total trials:</span> <span className="font-medium text-neutral-800">{totalTrials}</span> ({totalP} × {trials} = {split.training} training + {split.testing} testing)</div>
                </div>
                {check ? <p className={cn("mt-2 text-sm", checkColor)} style={{ fontFamily: "ui-sans-serif, system-ui" }}>{check.message}</p> : null}

                {(() => {
                  const groups = participantGroups(a);
                  const within = withinCoverage(a);
                  return (
                    <div className="mt-3" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">Participant groups — what each goes through</p>
                      <div className="mt-1.5 space-y-1.5">
                        {groups.map((g, i) => (
                          <div key={g.key} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-medium text-neutral-800">{groups.length > 1 ? `Group ${i + 1}: ` : ""}{g.label}</span>
                              <span className="shrink-0 text-xs text-neutral-400">{per || 0} participants</span>
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                              {g.between.length ? <span>Fixed condition: {g.between.map((b) => `${b.factor} = ${b.level}`).join(", ")}. </span> : null}
                              {within.length
                                ? <span>Each participant completes all levels of {within.map((w) => `${w.factor} (${w.levels.join(" / ")})`).join(", ")}{within.length ? " — order counterbalanced" : ""}.</span>
                                : (!g.between.length ? <span>Every participant does the single condition.</span> : <span>No within-subjects factors.</span>)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs text-neutral-400">These groups drive the Apparatus page — assign an interface to each with “Used by”.</p>
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export function DvBuilder({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const items = parseDvs(answers.sd_dv);
  // Flag DV measures the model/framework cannot produce: CoAX has no
  // counterfactual simulation; XAI-Property designs (Sim2Real) have no
  // forward-simulation accuracy.
  const xaiProp = hasXaiPropertyIv(answers);
  const dvAgent = xaiProp ? "Sim2Real" : ivAgentFor(answers);
  const modelKnown = xaiProp || !!(((answers.sd_iv_agent || "").trim()) || ((answers.user_model || "").trim()));

  function save(next: DvEntry[]) { setAnswer("sd_dv", JSON.stringify(next)); }
  function add() { save([...items, { measure: "", name: "", formula: "" }]); }
  function remove(i: number) { save(items.filter((_, idx) => idx !== i)); }
  function patch(i: number, p: Partial<DvEntry>) { save(items.map((e, idx) => (idx === i ? { ...e, ...p } : e))); }
  function setMeasure(i: number, id: string) {
    if (id === "custom") patch(i, { measure: "custom", name: items[i]?.name || "" });
    else patch(i, { measure: id, name: "" });
  }

  const grouped = DV_GROUP_ORDER.filter((g) => g !== "Custom").map((g) => ({ group: g, items: DV_CATALOG.filter((d) => d.group === g) })).filter((x) => x.items.length);

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      {items.length === 0 ? <p className="text-sm text-neutral-400">No dependent variables yet</p> : null}

      <div className="space-y-3">
        {items.map((e, i) => {
          const def = e.measure && e.measure !== "custom" ? DV_CATALOG.find((d) => d.id === e.measure)?.def : "";
          return (
            <div key={i} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-neutral-400">DV {i + 1}</span>
                <select
                  value={e.measure}
                  onChange={(ev) => setMeasure(i, ev.target.value)}
                  className={cn("max-w-[18rem] flex-1 truncate border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] outline-none focus:border-neutral-500", e.measure ? "text-neutral-900" : "text-neutral-400")}
                >
                  {!e.measure ? <option value="">a measure</option> : null}
                  {grouped.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map((d) => (<option key={d.id} value={d.id} title={d.def} className="text-neutral-900">{d.label}</option>))}
                    </optgroup>
                  ))}
                  <optgroup label="Custom">
                    <option value="custom" className="text-neutral-900">Custom DV (define formula)…</option>
                  </optgroup>
                </select>
                <button type="button" onClick={() => remove(i)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" aria-label="Remove DV">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {def ? <p className="mt-1 text-xs text-neutral-400">{def}</p> : null}

              {e.measure && e.measure !== "custom" && modelKnown && dvUnsupportedByAgent(e.measure, dvAgent) ? (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  {dvAgent === "Sim2Real"
                    ? "Sim2Real (XAI Property designs) does not support Forward-Simulation Accuracy — choose a different measure."
                    : `${DV_CATALOG.find((d) => d.id === e.measure)?.label ?? e.measure} is not supported by ${dvAgent} — choose a different measure, or switch the model on the User Model page.`}
                </p>
              ) : null}

              {e.measure === "custom" ? (
                <div className="mt-2 space-y-2">
                  <input
                    value={e.name}
                    onChange={(ev) => patch(i, { name: ev.target.value })}
                    placeholder="DV name (e.g. Calibrated trust index)"
                    className="w-full border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] outline-none placeholder:text-neutral-300 focus:border-neutral-500"
                  />
                  <textarea
                    value={e.formula ?? ""}
                    onChange={(ev) => patch(i, { formula: ev.target.value })}
                    placeholder="Precise formula / how it's calculated — e.g. mean(|confidence − correctness|) per participant"
                    rows={2}
                    className="w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-[13px] outline-none placeholder:text-neutral-300 focus:border-neutral-400"
                  />
                </div>
              ) : null}
            </div>
          );
        })}

        <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          <Plus className="h-4 w-4" /> Add dependent variable
        </button>
      </div>
    </div>
  );
}

const CUSTOM_TYPE = "__custom__";

export function VariableList({ valueKey, answers, setAnswer, namePlaceholder }: { valueKey: string; answers: Answers; setAnswer: (id: string, v: string) => void; namePlaceholder?: string }) {
  const items = parseVars(answers[valueKey]);
  const [types, setTypes] = useState<string[]>([]);
  // Rows where the user picked "Custom…" and is typing a free-text type.
  const [customRows, setCustomRows] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("experiment-var-types");
      if (raw) setTypes(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  function rememberType(t: string) {
    const tt = t.trim();
    if (!tt || types.includes(tt)) return;
    const next = [...types, tt];
    setTypes(next);
    try { localStorage.setItem("experiment-var-types", JSON.stringify(next)); } catch { /* ignore */ }
  }

  function save(next: Variable[]) {
    setAnswer(valueKey, JSON.stringify(next));
  }
  function add() { save([...items, { name: "", type: "" }]); }
  function remove(i: number) {
    save(items.filter((_, idx) => idx !== i));
    setCustomRows((r) => {
      const next: Record<number, boolean> = {};
      for (const [k, on] of Object.entries(r)) {
        const idx = Number(k);
        if (idx === i) continue;
        next[idx > i ? idx - 1 : idx] = on;
      }
      return next;
    });
  }
  function update(i: number, patch: Partial<Variable>) {
    save(items.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  const typeOptions = Array.from(new Set([...COMMON_VAR_TYPES, ...types]));
  const inputCls = "border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] outline-none placeholder:text-neutral-300 focus:border-neutral-500";

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      {items.length === 0 ? <p className="text-sm text-neutral-400">None yet</p> : null}

      <div className="space-y-2">
        {items.map((v, i) => {
          const isCustom = !!customRows[i] || (!!v.type && !typeOptions.includes(v.type));
          return (
            <div key={i} className="flex items-center gap-3">
              <input
                value={v.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder={namePlaceholder || "name"}
                className={cn(inputCls, "flex-1")}
              />
              {isCustom ? (
                <input
                  value={v.type}
                  onChange={(e) => update(i, { type: e.target.value })}
                  onBlur={() => {
                    rememberType(v.type);
                    // An emptied custom field goes back to the dropdown.
                    if (!v.type.trim()) setCustomRows((r) => ({ ...r, [i]: false }));
                  }}
                  placeholder="custom type"
                  autoFocus={!!customRows[i]}
                  className={cn(inputCls, "w-40")}
                />
              ) : (
                <select
                  value={typeOptions.includes(v.type) ? v.type : ""}
                  onChange={(e) => {
                    if (e.target.value === CUSTOM_TYPE) {
                      setCustomRows((r) => ({ ...r, [i]: true }));
                      update(i, { type: "" });
                    } else {
                      setCustomRows((r) => ({ ...r, [i]: false }));
                      update(i, { type: e.target.value });
                    }
                  }}
                  className={cn("w-40 border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] outline-none focus:border-neutral-500", v.type ? "text-neutral-900" : "text-neutral-400")}
                >
                  {!v.type ? <option value="">type…</option> : null}
                  {typeOptions.map((t) => (<option key={t} value={t} className="text-neutral-900">{t}</option>))}
                  <option value={CUSTOM_TYPE} className="text-neutral-900">Custom…</option>
                </select>
              )}
              <button type="button" onClick={() => remove(i)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" aria-label="Remove">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={add} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
        <Plus className="h-4 w-4" /> Add variable
      </button>
    </div>
  );
}

export function DatasetPicker({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const xaiProp = hasXaiPropertyIv(a);
  const agent = xaiProp ? "Sim2Real" : ivAgentFor(a);
  const modelKnown = xaiProp || !!(((a.sd_iv_agent || "").trim()) || ((a.user_model || "").trim()));
  const ds = DATASET_OPTIONS.includes((a.ds_dataset || "").trim()) ? (a.ds_dataset || "").trim() : "";
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      <select
        value={ds}
        onChange={(e) => setAnswer("ds_dataset", e.target.value)}
        className={cn("min-w-[12rem] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400", a.ds_dataset ? "text-neutral-900" : "text-neutral-400")}
      >
        <option value="">— Select a dataset —</option>
        <optgroup label="Available">
          {DATASET_OPTIONS.map((d) => (<option key={d} value={d} className="text-neutral-900">{d}</option>))}
        </optgroup>
      </select>
      <p className="mt-1.5 text-xs text-neutral-400">Pick one of the built-in datasets.</p>
      {ds && datasetUnsupportedByAgent(ds, agent) ? (
        <p className="mt-1.5 text-xs font-medium text-amber-700">
          {agent}{modelKnown ? "" : " (the default model)"} does not support the {ds} dataset — pick a different dataset, or switch the model on the User Model page.
        </p>
      ) : null}
    </div>
  );
}

export function AllocToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-neutral-200" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      {ALLOC_OPTIONS.map((opt) => {
        const on = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn("px-2.5 py-1 text-xs font-medium transition-colors", on ? "text-white" : "bg-white text-neutral-500 hover:bg-neutral-50")}
            style={on ? { backgroundColor: ACCENT } : undefined}
          >
            {opt === "Within-subjects" ? "Within" : "Between"}
          </button>
        );
      })}
    </div>
  );
}

// Discrete numeric levels for range/cognitive IVs (e.g. "2, 8, 10" → 3 levels), each within [min,max].
function NumericLevelsInput({ value, min, max, soft, onChange }: { value: string; min: number; max: number; soft?: boolean; onChange: (levels: string) => void }) {
  const toRaw = (l: string) => l.split("|").map((s) => s.trim()).filter(Boolean).join(", ");
  const toLevels = (r: string) => r.split(",").map((s) => s.trim()).filter(Boolean).join(" | ");
  const [raw, setRaw] = useState(() => toRaw(value));
  const rawRef = useRef(raw);
  rawRef.current = raw;
  useEffect(() => { if (toLevels(rawRef.current) !== value) setRaw(toRaw(value)); }, [value]);
  const nums = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const bad = nums.filter((n) => { const x = Number(n); return Number.isNaN(x) || x < min || x > max; });
  return (
    <div className="text-sm text-neutral-600">
      <div className="flex flex-wrap items-center gap-2">
        <span>Levels:</span>
        <input
          value={raw}
          onChange={(e) => { setRaw(e.target.value); onChange(toLevels(e.target.value)); }}
          placeholder="e.g. 2, 8, 10"
          className="min-w-[12rem] flex-1 border-0 border-b border-neutral-200 bg-transparent px-0 py-0.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
        />
        <span className="text-neutral-400">({soft ? "supported window" : "allowed"} {min}–{max})</span>
      </div>
      {nums.length ? <p className="mt-1 text-xs text-neutral-400">{nums.length} level{nums.length === 1 ? "" : "s"}: {nums.join(", ")}</p> : <p className="mt-1 text-xs text-neutral-400">Enter values separated by commas.</p>}
      {bad.length ? (
        soft
          ? <p className="mt-1 text-xs font-medium text-amber-700">Outside the evidence-supported window {min}–{max} (accepted, but untested): {bad.join(", ")}.</p>
          : <p className="mt-1 text-xs font-medium text-red-600">Each level must be a number between {min} and {max}. Check: {bad.join(", ")}.</p>
      ) : null}
    </div>
  );
}

export function IvLevelEditor({ factor, entry, agent, onPatch, answers }: { factor: IvFactor; entry: IvEntry; agent: string; onPatch: (patch: Partial<IvEntry>) => void; answers?: Answers }) {
  const levels = (entry.levels || "").split(" | ").map((s) => s.trim()).filter(Boolean);

  function toggleLevel(lvl: string) {
    const set = new Set(levels);
    if (set.has(lvl)) set.delete(lvl); else set.add(lvl);
    onPatch({ levels: [...set].join(" | ") });
  }

  const cogParams = factor.kind === "cognitive" && factor.cognitiveByAgent ? factor.cognitiveByAgent[agent] ?? [] : [];
  const cogParam = cogParams.find((p) => p.name === entry.cogParam) || null;

  // Categorical options. For the Dataset factor, offer every built-in dataset so
  // multiple can be compared — not just the agent's few. XAI Type always offers all
  // six levels in two rows (CoAX family / CoXAM family) — the model may not be
  // chosen yet; a mismatch warning below flags unsupported picks once it is.
  const isDataset = factor.id === "dataset";
  const isXaiType = factor.id === "xai_type";
  const xaiTypeRows = isXaiType && factor.levelsByAgent
    ? (() => {
        const r1 = factor.levelsByAgent["CoAX"] ?? [];
        const r2 = (factor.levelsByAgent["CoXAM"] ?? []).filter((l) => !r1.includes(l));
        const leftovers = levels.filter((l) => !r1.includes(l) && !r2.includes(l));
        return leftovers.length ? [r1, r2, leftovers] : [r1, r2];
      })()
    : null;
  const categoricalOptions = Array.from(new Set([
    ...(isDataset ? DATASET_OPTIONS : ivLevelsFor(factor, agent)),
    ...levels, // keep any already-selected value visible even if not in the base list
  ]));

  // Flag mismatches with the chosen model/framework. Level checks also run
  // before a model is chosen (against the default, CoAX), so unsupported picks —
  // e.g. the Decision Tree / Logistic Regression / Hybrid XAI types or the
  // Mushroom dataset, neither supported by CoAX — are flagged immediately.
  const modelKnown = !!(((answers?.sd_iv_agent || "").trim()) || ((answers?.user_model || "").trim()));
  const factorUnsupported = modelKnown && ivFactorUnsupportedByAgent(entry, agent);
  const unsupported = !factorUnsupported ? unsupportedIvLevels(entry, agent) : [];

  return (
    <div className="mt-2" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      {factor.note ? <p className="mb-2 text-xs text-neutral-400">{factor.note}</p> : null}

      {factor.kind === "categorical" ? (
        <>
          {(xaiTypeRows ?? [categoricalOptions]).map((row, ri) => (
            <div key={ri} className={cn("flex flex-wrap gap-2", ri > 0 ? "mt-2" : "")}>
              {row.map((lvl) => {
                const on = levels.includes(lvl);
                return (
                  <button key={lvl} type="button" onClick={() => toggleLevel(lvl)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", on ? "border-transparent text-white" : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100")} style={on ? { backgroundColor: ACCENT } : undefined}>
                    {lvl}
                  </button>
                );
              })}
            </div>
          ))}
          <p className="mt-1.5 text-xs text-neutral-400">
            Tap to select — choose <span className="font-medium text-neutral-500">two or more</span> to compare them as conditions.
            {levels.length ? ` ${levels.length} selected.` : ""}
          </p>
        </>
      ) : null}

      {factorUnsupported ? (
        <p className="mt-2 text-xs font-medium text-amber-700">
          {agent} does not support the {factor.label} IV — pick a different IV, or switch the model on the User Model page.
        </p>
      ) : unsupported.length ? (
        <p className="mt-2 text-xs font-medium text-amber-700">
          {agent}{modelKnown ? "" : " (the default model)"} does not support: {unsupported.join(", ")}. Choose levels supported by {agent}, or switch the model on the User Model page.
        </p>
      ) : null}

      {factor.kind === "binary" && factor.binary ? (
        <p className="text-sm text-neutral-600">Comparing <span className="font-medium text-neutral-800">{factor.binary[0]}</span> vs <span className="font-medium text-neutral-800">{factor.binary[1]}</span> (2 conditions).</p>
      ) : null}

      {factor.kind === "range" && factor.range ? (
        <NumericLevelsInput value={entry.levels ?? ""} min={factor.range.min} max={factor.range.max} onChange={(lv) => onPatch({ levels: lv })} />
      ) : null}

      {factor.kind === "cognitive" ? (
        <div className="space-y-2">
          <DocSelect
            value={entry.cogParam ?? ""}
            onChange={(v) => onPatch({ cogParam: v, label: v ? `Cognitive: ${v}` : "Cognitive Parameters", levels: "" })}
            options={cogParams.map((p) => p.name)}
            placeholder="choose a parameter"
          />
          {cogParam ? (() => {
            const range = cogParamRange(cogParam);
            const isEnum = cogParamType(cogParam) === "enum";
            return (
              <div className="text-sm text-neutral-600">
                {cogParam.note ? <p className="mb-1 text-xs text-neutral-400">{cogParam.note}</p> : null}
                {isEnum ? (
                  <div className="flex flex-wrap gap-2">
                    {(cogParam.options || []).map((opt) => {
                      const on = levels.includes(opt);
                      return (
                        <button key={opt} type="button" onClick={() => toggleLevel(opt)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", on ? "border-transparent text-white" : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100")} style={on ? { backgroundColor: ACCENT } : undefined}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : range ? (
                  <NumericLevelsInput value={entry.levels ?? ""} min={range.min} max={range.max} soft={cogParam.softBounds} onChange={(lv) => onPatch({ levels: lv })} />
                ) : (
                  <input value={entry.levels ?? ""} onChange={(e) => onPatch({ levels: e.target.value })} placeholder="e.g. top-2 features vs all features" className="w-full border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] outline-none placeholder:text-neutral-400 focus:border-neutral-500" />
                )}
              </div>
            );
          })() : null}
        </div>
      ) : null}
    </div>
  );
}

export const IV_TYPES_KEY = "experiment-iv-types";
// Replace with your real docs link for adding IV types.

export const IV_TYPES_DOCS = "#";

export function IvBuilder({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const agent = ivAgentFor(a);
  const ivs = parseIvs(a);

  const [customs, setCustoms] = useState<IvFactor[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: "", levels: "", def: "", pip: "", file: "" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IV_TYPES_KEY);
      if (raw) setCustoms(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  function persistCustoms(next: IvFactor[]) {
    setCustoms(next);
    try { localStorage.setItem(IV_TYPES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  // built-ins available for this model + user-added custom types (available to all)
  const factors = [...ivFactorsForAgent(agent), ...customs];
  const findFactor = (id: string) => factors.find((f) => f.id === id) || null;

  // XAI Property is exclusive — it cannot be combined with any other IV.
  const hasXaiPropElsewhere = (i: number) => ivs.some((e, j) => j !== i && e.factor === "xai_property");
  const hasOtherElsewhere = (i: number) => ivs.some((e, j) => j !== i && e.factor && e.factor !== "xai_property");
  const hasXaiProp = ivs.some((e) => e.factor === "xai_property");
  const mixedXaiProp = hasXaiProp && ivs.some((e) => e.factor && e.factor !== "xai_property");

  // No duplicate factors: each factor may be used by only one IV. (Cognitive
  // Parameters are exempt here — multiple cognitive IVs with different parameters
  // are legitimate; duplicates of the same parameter are dropped on save.)
  const usedElsewhere = (i: number, factorId: string) =>
    factorId !== "cognitive" && ivs.some((e, j) => j !== i && e.factor === factorId);
  const dupFactorLabels = (() => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const e of ivs) {
      if (!e.factor || e.factor === "cognitive") continue;
      if (seen.has(e.factor)) dups.add(e.label || e.factor);
      seen.add(e.factor);
    }
    return Array.from(dups);
  })();

  // One-time migration from the old single-IV fields.
  useEffect(() => {
    if (!a.sd_ivs && a.sd_iv_factor) {
      const migrated: IvEntry[] = [{
        factor: a.sd_iv_factor,
        label: a.sd_iv || "",
        levels: a.sd_iv_levels || "",
        cogParam: a.sd_cog_param || "",
        min: a.sd_iv_min || "",
        max: a.sd_iv_max || "",
        alloc: a.sd_design || "Within-subjects",
      }];
      setAnswer("sd_ivs", JSON.stringify(migrated));
      setAnswer("sd_conditions", String(totalCells(migrated)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save(next: IvEntry[]) {
    setAnswer("sd_ivs", JSON.stringify(next));
    setAnswer("sd_conditions", String(totalCells(next)));
  }
  function addIv() { save([...ivs, { factor: "", label: "", levels: "", alloc: "Within-subjects" }]); }
  function removeIv(i: number) { save(ivs.filter((_, idx) => idx !== i)); }
  function patch(i: number, p: Partial<IvEntry>) { save(ivs.map((e, idx) => (idx === i ? { ...e, ...p } : e))); }
  function setFactor(i: number, id: string) {
    const f = findFactor(id);
    const p: Partial<IvEntry> = { factor: id, label: f ? f.label : "", levels: "", cogParam: "", min: "", max: "" };
    if (f?.kind === "binary" && f.binary) p.levels = `${f.binary[0]} vs ${f.binary[1]}`;
    patch(i, p);
  }

  function addCustomType() {
    const name = draft.name.trim();
    if (!name) return;
    const levels = draft.levels.split(",").map((s) => s.trim()).filter(Boolean);
    const meta = [draft.def.trim(), draft.pip.trim() ? `pip: ${draft.pip.trim()}` : "", draft.file.trim() ? `spec: ${draft.file.trim()}` : ""].filter(Boolean).join(" · ");
    const entry: IvFactor = {
      id: `custom:${name}`,
      label: name,
      kind: "categorical",
      group: "Custom",
      def: meta || "Custom IV type.",
      levels: levels.length ? levels : ["Level 1", "Level 2"],
    };
    persistCustoms([...customs.filter((c) => c.id !== entry.id), entry]);
    setDraft({ name: "", levels: "", def: "", pip: "", file: "" });
    setShowAdd(false);
  }
  function onSpecFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setDraft((d) => ({ ...d, file: file.name }));
    e.target.value = "";
  }

  // group factors for the dropdown
  const grouped = IV_GROUP_ORDER.map((g) => ({ group: g, items: factors.filter((f) => (f.group || "Custom") === g) })).filter((x) => x.items.length);

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      <div className="space-y-3">
        {ivs.length === 0 ? (
          <p className="text-sm text-neutral-400">No independent variables yet</p>
        ) : null}

        {ivs.map((entry, i) => {
          const factor = findFactor(entry.factor);
          return (
            <div key={i} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-neutral-400">IV {i + 1}</span>
                <select
                  value={entry.factor}
                  onChange={(e) => setFactor(i, e.target.value)}
                  className={cn("max-w-[18rem] flex-1 truncate border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] outline-none focus:border-neutral-500", entry.factor ? "text-neutral-900" : "text-neutral-400")}
                >
                  {!entry.factor ? <option value="" disabled hidden>Select a factor…</option> : null}
                  {grouped.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map((f) => {
                        const xaiPropBlocked = f.id === "xai_property" ? hasOtherElsewhere(i) : hasXaiPropElsewhere(i);
                        const dupBlocked = !xaiPropBlocked && usedElsewhere(i, f.id);
                        const blocked = xaiPropBlocked || dupBlocked;
                        const suffix = xaiPropBlocked ? " (not combinable)" : dupBlocked ? " (already used)" : "";
                        return (
                          <option key={f.id} value={f.id} disabled={blocked} title={xaiPropBlocked ? "XAI Property cannot be combined with other IVs" : dupBlocked ? "This factor is already used by another IV" : f.def} className="text-neutral-900">
                            {f.label}{suffix}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
                <AllocToggle value={entry.alloc} onChange={(v) => patch(i, { alloc: v })} />
                <button type="button" onClick={() => removeIv(i)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" aria-label="Remove IV">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {factor?.def ? <p className="mt-1 text-xs text-neutral-400">{factor.def}</p> : null}
              {factor ? <IvLevelEditor factor={factor} entry={entry} agent={agent} onPatch={(p) => patch(i, p)} answers={a} /> : null}
              {entry.alloc === "Within-subjects" ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
                  <span className="text-neutral-500">Counterbalancing:</span>
                  <select
                    value={entry.balancing ?? ""}
                    onChange={(e) => patch(i, { balancing: e.target.value })}
                    className={cn("rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-400", entry.balancing ? "text-neutral-900" : "text-neutral-400")}
                  >
                    <option value="">— none —</option>
                    {BALANCING_METHODS.map((b) => (<option key={b} value={b} className="text-neutral-900">{b}</option>))}
                  </select>
                </div>
              ) : null}
            </div>
          );
        })}

        {mixedXaiProp ? (
          <p className="text-sm font-medium text-red-600">XAI Property cannot be combined with other independent variables — remove one of them.</p>
        ) : null}
        {dupFactorLabels.length ? (
          <p className="text-sm font-medium text-red-600">Duplicate independent variables: {dupFactorLabels.join(", ")} — each factor can only be used once; remove the duplicate.</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {/* Hover goes on the wrapper: disabled buttons don't fire hover events. */}
          <span className="group relative inline-block">
            <button
              type="button"
              onClick={addIv}
              disabled={hasXaiProp}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Add independent variable
            </button>
            {hasXaiProp ? (
              <span className="pointer-events-none absolute left-0 top-full z-10 mt-1.5 hidden w-max max-w-[20rem] rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs leading-relaxed text-white shadow-md group-hover:block">
                XAI Property is an exclusive IV — remove it to add other independent variables.
              </span>
            ) : null}
          </span>
          <button type="button" onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium" style={{ color: ACCENT }}>
            <Upload className="h-4 w-4" /> Add IV type
          </button>
        </div>

        {showAdd ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
            <p className="text-sm font-medium text-neutral-800">Add a new IV type</p>
            <p className="mt-0.5 text-xs text-neutral-400">
              Define a custom factor, or attach a spec / Python / pip package.{" "}
              <a href={IV_TYPES_DOCS} target="_blank" rel="noreferrer" className="underline" style={{ color: ACCENT }}>How it works ↗</a>
            </p>
            <div className="mt-3 space-y-2">
              <TextInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Type name (e.g. Explanation Length)" />
              <TextInput value={draft.levels} onChange={(v) => setDraft({ ...draft, levels: v })} placeholder="Levels, comma-separated (e.g. Short, Long)" />
              <TextInput value={draft.def} onChange={(v) => setDraft({ ...draft, def: v })} placeholder="One-line definition (optional)" />
              <TextInput value={draft.pip} onChange={(v) => setDraft({ ...draft, pip: v })} placeholder="pip install … (optional)" />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100">
                <Upload className="h-4 w-4" /> {draft.file ? draft.file : "Upload spec / .py (optional)"}
                <input type="file" accept=".py,.json,.yaml,.yml,.txt" onChange={onSpecFile} className="hidden" />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={addCustomType} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: ACCENT }}>Add type</button>
              <button onClick={() => setShowAdd(false)} className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
