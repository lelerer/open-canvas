"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  Loader2,
  Send,
  Wand2,
  Download,
  Upload,
  X,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  PAGES,
  Answers,
  Page,
  isPageComplete,
  validateParticipants,
  BALANCING_METHODS,
  DATASET_OPTIONS,
  USER_MODELS,
  UserModel,
  IV_AGENTS,
  IV_CATALOG,
  IV_GROUP_ORDER,
  IvFactor,
  ivFactorsForAgent,
  ivLevelsFor,
  ALLOC_OPTIONS,
  IvEntry,
  parseIvs,
  totalCells,
  betweenCells,
  designDescriptor,
  Variable,
  parseVars,
  varsSummary,
  DV_CATALOG,
  DV_GROUP_ORDER,
  DvEntry,
  parseDvs,
  dvSummary,
  dvDisplayName,
} from "./questions";

const STORAGE_KEY = "experiment-interview-v1";
const ACCENT = "#359793";
const SERIF = 'Georgia, Cambria, "Times New Roman", serif';
const LAST = PAGES.length - 1;

const GLOBAL_OPENING =
  "Hi! I'm your XAI experiment-design assistant. We'll build this together across the sections on the left — start wherever you like, even with a rough idea. What research direction or question do you have in mind?";

export function ExperimentWizard() {
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: GLOBAL_OPENING }]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAnswers(JSON.parse(raw));
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch { /* ignore */ }
  }, [answers, loaded]);

  const page = PAGES[step];

  function setAnswer(id: string, v: string) {
    setAnswers((a) => ({ ...a, [id]: v }));
  }
  function applyUpdates(updates: Record<string, string>) {
    setAnswers((a) => ({ ...a, ...updates }));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 text-neutral-900">
      {/* Sidebar — page nav */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-7 w-7 place-items-center rounded-md text-white" style={{ backgroundColor: ACCENT }}>
            <FileText className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">XAI Experiment Designer</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 pb-4">
          {PAGES.map((item, i) => {
            const active = i === step;
            const done = item.kind !== "review" && isPageComplete(item, answers);
            const missing = !!item.required && !done;
            const isReview = item.kind === "review";
            return (
              <button
                key={item.id}
                onClick={() => setStep(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50",
                  isReview ? "mt-2 border-t border-neutral-100 pt-3" : ""
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs",
                    active || done ? "border-transparent text-white" : missing ? "border-amber-400 text-amber-500" : "border-neutral-300 text-neutral-400"
                  )}
                  style={active || done ? { backgroundColor: ACCENT } : undefined}
                >
                  {isReview ? <FileText className="h-3.5 w-3.5" /> : done ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className={cn("flex-1 truncate", active ? "text-neutral-900" : "text-neutral-600")}>{item.navTitle}</span>
                {item.required && !done ? <span className="text-amber-500" title="Required">*</span> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Middle — current editable page */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto">
          {page.kind === "review" ? (
            <ReviewPage answers={answers} onJump={(id) => setStep(PAGES.findIndex((p) => p.id === id))} />
          ) : (
            <div className="mx-auto w-full max-w-2xl px-6 py-10">
              {page.kind === "text" ? (
                <TextBody page={page} answers={answers} setAnswer={setAnswer} />
              ) : page.kind === "studydesign" ? (
                <StudyDesignBody answers={answers} setAnswer={setAnswer} />
              ) : (
                <UserModelBody answers={answers} setAnswer={setAnswer} />
              )}
            </div>
          )}
        </main>

        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {step < LAST ? (
              <button
                onClick={() => setStep((s) => Math.min(LAST, s + 1))}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: ACCENT }}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </button>
            ) : (
              <span className="text-xs text-neutral-400">End of wizard</span>
            )}
          </div>
        </footer>
      </div>

      {/* Right — chat: one ongoing conversation, aware of every page, side by side */}
      <div className="hidden w-[26rem] shrink-0 border-l border-neutral-200 md:flex">
        <ChatPanel
          messages={messages}
          setMessages={setMessages}
          allowedFields={(PAGE_CHAT[page.id] ?? { fields: [] }).fields}
          context={buildChatContext(page, answers)}
          onApplyUpdates={applyUpdates}
        />
      </div>
    </div>
  );
}

/* ----------------------------- Page bodies (editable) ----------------------------- */

function TextBody({ page, answers, setAnswer }: { page: Page; answers: Answers; setAnswer: (id: string, v: string) => void }) {
  return (
    <>
      <h1 className="text-2xl font-semibold leading-snug tracking-tight">{page.prompt}</h1>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <label className="block text-sm font-medium text-neutral-800">{label}</label>
      {hint ? <p className="mb-1.5 mt-0.5 text-xs text-neutral-400">{hint}</p> : <div className="mb-1.5" />}
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400">
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400" />
  );
}

function DocLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">{children}</p>;
}

// Borderless, document-style inputs: read like prose, underline only on focus.
function DocText({ value, onChange, placeholder, multiline }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  const cls = "w-full resize-none border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] leading-7 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500";
  if (multiline) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className={cn(cls, "min-h-[2.5rem]")} />;
  }
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />;
}

function DocSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string }) {
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

function StudyDesignBody({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
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
      <h1 className="text-2xl font-semibold leading-snug tracking-tight" style={{ fontFamily: "ui-sans-serif, system-ui" }}>Study design</h1>
      <p className="mt-1 text-sm text-neutral-400" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
        Describe the variables, structure, and participants. Type directly, or let the assistant fill it in.
      </p>

      <div className="mt-8 space-y-7">
        <div>
          <DocLabel>Dependent Variables (DV)</DocLabel>
          <DvBuilder answers={answers} setAnswer={setAnswer} />
        </div>

        <div>
          <DocLabel>Independent Variable(s)</DocLabel>
          <IvBuilder answers={answers} setAnswer={setAnswer} />
        </div>

        <div>
          <DocLabel>Control Variables (CV)</DocLabel>
          <VariableList valueKey="sd_cv" answers={answers} setAnswer={setAnswer} namePlaceholder="e.g. dataset" />
        </div>

        <div>
          <DocLabel>Random Variables (RV)</DocLabel>
          <VariableList valueKey="sd_rv" answers={answers} setAnswer={setAnswer} namePlaceholder="e.g. participant, stimulus order" />
        </div>

        <div className="border-t border-neutral-100 pt-6">
          <DocLabel>Dataset</DocLabel>
          <DatasetPicker answers={answers} setAnswer={setAnswer} />
        </div>

        <div className="border-t border-neutral-100 pt-6">
          <DocLabel>Participants</DocLabel>
          {(() => {
            const numCls = "w-16 border-0 border-b border-neutral-200 bg-transparent px-0 py-0.5 text-center text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500";
            const per = parseInt(a.sd_participants || "", 10) || 0;
            const between = betweenCells(ivs);
            const totalP = per * (between || 1);
            const timePer = parseFloat(a.sd_time_per || "") || 0;
            const costPer = parseFloat(a.sd_cost_per || "") || 0;
            const totalMin = totalP * timePer;
            const totalCost = totalP * costPer;
            const hrs = totalMin / 60;
            return (
              <>
                <p className="mt-1 text-[15px] leading-8 text-neutral-800">
                  We will recruit{" "}
                  <input type="number" value={a.sd_participants ?? ""} onChange={(e) => setAnswer("sd_participants", e.target.value)} placeholder="N" className={numCls} />{" "}
                  participants for each condition.
                </p>
                <p className="text-[15px] leading-8 text-neutral-800">
                  Each participant takes{" "}
                  <input type="number" value={a.sd_time_per ?? ""} onChange={(e) => setAnswer("sd_time_per", e.target.value)} placeholder="min" className={numCls} />{" "}
                  minutes and costs{" "}
                  <input type="number" value={a.sd_cost_per ?? ""} onChange={(e) => setAnswer("sd_cost_per", e.target.value)} placeholder="0" className={numCls} />{" "}
                  per session.
                </p>
                <div className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
                  <div><span className="text-neutral-400">Total participants:</span> <span className="font-medium text-neutral-800">{totalP}</span> ({per} × {between || 1} between-subjects group{between === 1 ? "" : "s"}, {cells} cell{cells === 1 ? "" : "s"})</div>
                  {totalMin > 0 ? <div><span className="text-neutral-400">Estimated total time:</span> <span className="font-medium text-neutral-800">{totalMin} min</span> (~{hrs.toFixed(1)} h)</div> : null}
                  {totalCost > 0 ? <div><span className="text-neutral-400">Estimated total cost:</span> <span className="font-medium text-neutral-800">{totalCost.toLocaleString()}</span></div> : null}
                </div>
                {check ? <p className={cn("mt-2 text-sm", checkColor)} style={{ fontFamily: "ui-sans-serif, system-ui" }}>{check.message}</p> : null}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function DvBuilder({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const items = parseDvs(answers.sd_dv);

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
      {items.length === 0 ? <p className="text-sm text-neutral-400">No dependent variables yet — add one below.</p> : null}

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

function VariableList({ valueKey, answers, setAnswer, namePlaceholder }: { valueKey: string; answers: Answers; setAnswer: (id: string, v: string) => void; namePlaceholder?: string }) {
  const items = parseVars(answers[valueKey]);
  const [types, setTypes] = useState<string[]>([]);

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
  function remove(i: number) { save(items.filter((_, idx) => idx !== i)); }
  function update(i: number, patch: Partial<Variable>) {
    save(items.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  const listId = `vartypes-${valueKey}`;
  const inputCls = "border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] outline-none placeholder:text-neutral-300 focus:border-neutral-500";

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      <datalist id={listId}>
        {types.map((t) => (<option key={t} value={t} />))}
      </datalist>

      {items.length === 0 ? <p className="text-sm text-neutral-400">None yet — add one below.</p> : null}

      <div className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex items-center gap-3">
            <input
              value={v.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder={namePlaceholder || "name"}
              className={cn(inputCls, "flex-1")}
            />
            <input
              value={v.type}
              onChange={(e) => update(i, { type: e.target.value })}
              onBlur={() => rememberType(v.type)}
              list={listId}
              placeholder="type (custom)"
              className={cn(inputCls, "w-40")}
            />
            <button type="button" onClick={() => remove(i)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" aria-label="Remove">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={add} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
        <Plus className="h-4 w-4" /> Add variable
      </button>
    </div>
  );
}

function DatasetPicker({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  // user-uploaded CSV names are remembered in ds_custom_datasets (comma-joined)
  const custom = (a.ds_custom_datasets || "").split("|").map((s) => s.trim()).filter(Boolean);
  const options = [...DATASET_OPTIONS, ...custom];

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.csv$/i, "");
    const nextCustom = Array.from(new Set([...custom, name]));
    setAnswer("ds_custom_datasets", nextCustom.join(" | "));
    setAnswer("ds_dataset", name);
    e.target.value = "";
  }

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={a.ds_dataset ?? ""}
          onChange={(e) => setAnswer("ds_dataset", e.target.value)}
          className={cn("min-w-[12rem] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400", a.ds_dataset ? "text-neutral-900" : "text-neutral-400")}
        >
          <option value="">— Select a dataset —</option>
          <optgroup label="Available">
            {DATASET_OPTIONS.map((d) => (<option key={d} value={d} className="text-neutral-900">{d}</option>))}
          </optgroup>
          {custom.length ? (
            <optgroup label="Your uploads">
              {custom.map((d) => (<option key={d} value={d} className="text-neutral-900">{d}</option>))}
            </optgroup>
          ) : null}
        </select>

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          <Upload className="h-4 w-4" /> Upload CSV
          <input type="file" accept=".csv,text/csv" onChange={onUpload} className="hidden" />
        </label>
      </div>
      <p className="mt-1.5 text-xs text-neutral-400">Pick a built-in dataset or upload your own CSV (the file name is recorded; data stays in your browser).</p>
    </div>
  );
}

function AllocToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

function IvLevelEditor({ factor, entry, agent, onPatch }: { factor: IvFactor; entry: IvEntry; agent: string; onPatch: (patch: Partial<IvEntry>) => void }) {
  const levels = (entry.levels || "").split(" | ").map((s) => s.trim()).filter(Boolean);
  const numCls = "w-20 border-0 border-b border-neutral-200 bg-transparent px-0 py-0.5 text-center text-[15px] outline-none placeholder:text-neutral-400 focus:border-neutral-500";

  function toggleLevel(lvl: string) {
    const set = new Set(levels);
    if (set.has(lvl)) set.delete(lvl); else set.add(lvl);
    onPatch({ levels: [...set].join(" | ") });
  }
  function setRange(min: string, max: string) {
    onPatch({ min, max, levels: min || max ? `${min || "?"}\u2013${max || "?"}` : "" });
  }

  const cogParams = factor.kind === "cognitive" && factor.cognitiveByAgent ? factor.cognitiveByAgent[agent] ?? [] : [];
  const cogParam = cogParams.find((p) => p.name === entry.cogParam) || null;

  return (
    <div className="mt-2" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
      {factor.note ? <p className="mb-2 text-xs text-neutral-400">{factor.note}</p> : null}

      {factor.kind === "categorical" ? (
        <div className="flex flex-wrap gap-2">
          {ivLevelsFor(factor, agent).map((lvl) => {
            const on = levels.includes(lvl);
            return (
              <button key={lvl} type="button" onClick={() => toggleLevel(lvl)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", on ? "border-transparent text-white" : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100")} style={on ? { backgroundColor: ACCENT } : undefined}>
                {lvl}
              </button>
            );
          })}
        </div>
      ) : null}

      {factor.kind === "binary" && factor.binary ? (
        <p className="text-sm text-neutral-600">Comparing <span className="font-medium text-neutral-800">{factor.binary[0]}</span> vs <span className="font-medium text-neutral-800">{factor.binary[1]}</span> (2 conditions).</p>
      ) : null}

      {factor.kind === "range" && factor.range ? (
        <p className="text-sm text-neutral-600">
          From <input type="number" value={entry.min ?? ""} onChange={(e) => setRange(e.target.value, entry.max ?? "")} placeholder={String(factor.range.min)} className={numCls} /> to{" "}
          <input type="number" value={entry.max ?? ""} onChange={(e) => setRange(entry.min ?? "", e.target.value)} placeholder={String(factor.range.max)} className={numCls} />{" "}
          <span className="text-neutral-400">(allowed {factor.range.min}\u2013{factor.range.max})</span>
        </p>
      ) : null}

      {factor.kind === "cognitive" ? (
        <div className="space-y-2">
          <DocSelect
            value={entry.cogParam ?? ""}
            onChange={(v) => onPatch({ cogParam: v, label: v ? `Cognitive: ${v}` : "Cognitive Parameters", levels: "" })}
            options={cogParams.map((p) => p.name)}
            placeholder="choose a parameter"
          />
          {cogParam ? (
            <div className="text-sm text-neutral-600">
              {cogParam.note ? <p className="mb-1 text-xs text-neutral-400">{cogParam.note}</p> : null}
              {cogParam.min < cogParam.max ? (
                <p>
                  From <input type="number" value={entry.min ?? ""} onChange={(e) => setRange(e.target.value, entry.max ?? "")} placeholder={String(cogParam.min)} className={numCls} /> to{" "}
                  <input type="number" value={entry.max ?? ""} onChange={(e) => setRange(entry.min ?? "", e.target.value)} placeholder={String(cogParam.max)} className={numCls} />{" "}
                  <span className="text-neutral-400">(allowed {cogParam.min} to {cogParam.max})</span>
                </p>
              ) : (
                <input value={entry.levels ?? ""} onChange={(e) => onPatch({ levels: e.target.value })} placeholder="e.g. top-2 features vs all features" className="w-full border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] outline-none placeholder:text-neutral-400 focus:border-neutral-500" />
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const IV_TYPES_KEY = "experiment-iv-types";
// Replace with your real docs link for adding IV types.
const IV_TYPES_DOCS = "#";

function IvBuilder({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const agent = a.sd_iv_agent || "CoAX";
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
  function setAgent(v: string) {
    setAnswer("sd_iv_agent", v);
    const valid = new Set([...ivFactorsForAgent(v), ...customs].map((f) => f.id));
    save(ivs.map((e) => (valid.has(e.factor) ? e : { ...e, factor: "", label: "", levels: "", cogParam: "", min: "", max: "" })));
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
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="text-neutral-500">Model / framework:</span>
        <DocSelect value={agent} onChange={setAgent} options={IV_AGENTS} placeholder="model" />
      </div>

      <div className="space-y-3">
        {ivs.length === 0 ? (
          <p className="text-sm text-neutral-400">No independent variables yet — add one below.</p>
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
                  {!entry.factor ? <option value="">a factor</option> : null}
                  {grouped.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map((f) => (<option key={f.id} value={f.id} title={f.def} className="text-neutral-900">{f.label}</option>))}
                    </optgroup>
                  ))}
                </select>
                <AllocToggle value={entry.alloc} onChange={(v) => patch(i, { alloc: v })} />
                <button type="button" onClick={() => removeIv(i)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" aria-label="Remove IV">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {factor?.def ? <p className="mt-1 text-xs text-neutral-400">{factor.def}</p> : null}
              {factor ? <IvLevelEditor factor={factor} entry={entry} agent={agent} onPatch={(p) => patch(i, p)} /> : null}
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

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={addIv} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
            <Plus className="h-4 w-4" /> Add independent variable
          </button>
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

function UserModelBody({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const [customs, setCustoms] = useState<UserModel[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: "", full: "", description: "", category: "Custom" });

  // load user-added models from localStorage
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
  const cats = ["Cognitive model", "ML proxy", "Custom"];

  return (
    <>
      <h1 className="text-2xl font-semibold leading-snug tracking-tight">User model</h1>
      <p className="mt-2 text-sm text-neutral-500">The model whose behaviour stands in for (or simulates) the user — a cognitive model or an ML proxy. Pick one, or add your own.</p>

      <div className="mt-6 space-y-6">
        {cats.map((cat) => {
          const items = all.filter((m) => m.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-400">{cat}</p>
              <div className="space-y-2">
                {items.map((m) => {
                  const on = a.user_model === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAnswer("user_model", m.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                        on ? "border-transparent ring-2" : "border-neutral-200 hover:bg-neutral-50"
                      )}
                      style={on ? ({ ["--tw-ring-color" as any]: ACCENT, borderColor: ACCENT } as React.CSSProperties) : undefined}
                    >
                      <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", on ? "border-transparent text-white" : "border-neutral-300")} style={on ? { backgroundColor: ACCENT } : undefined}>
                        {on ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-neutral-900">{m.name} <span className="font-normal text-neutral-400">· {m.full}</span></span>
                        <span className="mt-0.5 block text-sm text-neutral-500">{m.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

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

/* ----------------------------- Review & export ----------------------------- */

function ivSummaryLines(a: Answers): string[] {
  const ivs = parseIvs(a);
  if (!ivs.length) return [];
  return ivs.map((e, i) => {
    const allocShort = e.alloc === "Between-subjects" ? "between" : "within";
    const bal = e.alloc === "Within-subjects" && e.balancing ? `, ${e.balancing}` : "";
    return `IV ${i + 1}: ${e.label || "(factor not set)"} — ${e.levels || "(no levels)"} [${allocShort}-subjects${bal}]`;
  });
}

function participantTotals(a: Answers) {
  const ivs = parseIvs(a);
  const per = parseInt(a.sd_participants || "", 10) || 0;
  const between = betweenCells(ivs) || 1;
  const cells = totalCells(ivs);
  const totalP = per * between;
  const timePer = parseFloat(a.sd_time_per || "") || 0;
  const costPer = parseFloat(a.sd_cost_per || "") || 0;
  return { per, between, cells, totalP, timePer, costPer, totalMin: totalP * timePer, totalCost: totalP * costPer };
}

function buildExportText(a: Answers): string {
  const v = (k: string) => (a[k] || "").trim() || "(not provided)";
  const ivs = parseIvs(a);
  const ivLines = ivs.length ? ivSummaryLines(a) : ["(none provided)"];
  const p = participantTotals(a);
  return [
    "EXPERIMENT DESIGN", "=================", "",
    "RESEARCH QUESTIONS", v("rq"), "",
    "STUDY DESIGN, VARIABLES & PARTICIPANTS",
    `Dependent variables (DV): ${dvSummary(parseDvs(a.sd_dv)) || "(not provided)"}`,
    ...parseDvs(a.sd_dv).filter((e) => (e.formula || "").trim()).map((e) => `    formula[${dvDisplayName(e)}]: ${e.formula}`),
    `Model / framework: ${v("sd_iv_agent")}`,
    "Independent variables:",
    ...ivLines.map((l) => `  - ${l}`),
    `Control variables (CV): ${varsSummary(parseVars(a.sd_cv)) || "(not provided)"}`,
    `Random variables (RV): ${varsSummary(parseVars(a.sd_rv)) || "(not provided)"}`,
    `Design: ${designDescriptor(ivs) || "(not provided)"}`,
    `Dataset: ${v("ds_dataset")}`,
    `Total conditions / cells: ${ivs.length ? p.cells : "(n/a)"}`,
    `Participants per condition: ${a.sd_participants ? p.per : "(not provided)"}`,
    `Total participants: ${a.sd_participants ? p.totalP : "(n/a)"}`,
    `Time per participant (min): ${a.sd_time_per || "(not provided)"}`,
    `Cost per participant: ${a.sd_cost_per || "(not provided)"}`,
    `Estimated total time (min): ${p.totalMin || "(n/a)"}`,
    `Estimated total cost: ${p.totalCost || "(n/a)"}`, "",
    "APPARATUS", v("apparatus"), "",
    "PROCEDURE", v("procedure"), "",
    "USER MODEL", v("user_model"), "",
  ].join("\n");
}

function buildExportJson(a: Answers): string {
  const t = (k: string) => (a[k] || "").trim();
  const ivs = parseIvs(a);
  const p = participantTotals(a);
  const obj = {
    researchQuestions: t("rq"),
    studyDesign: {
      dependentVariables: parseDvs(a.sd_dv),
      modelFramework: t("sd_iv_agent"),
      independentVariables: ivs.map((e) => ({
        factor: e.label,
        levelsOrRange: e.levels,
        allocation: e.alloc,
        counterbalancing: e.alloc === "Within-subjects" ? e.balancing || "" : "",
      })),
      controlVariablesCV: parseVars(a.sd_cv),
      randomVariablesRV: parseVars(a.sd_rv),
      design: designDescriptor(ivs),
      dataset: t("ds_dataset"),
      totalConditions: ivs.length ? p.cells : null,
      betweenSubjectsCells: ivs.length ? p.between : null,
      participantsPerCondition: a.sd_participants ? p.per : null,
      totalParticipants: a.sd_participants ? p.totalP : null,
      timePerParticipantMin: a.sd_time_per ? p.timePer : null,
      costPerParticipant: a.sd_cost_per ? p.costPer : null,
      estimatedTotalTimeMin: p.totalMin || null,
      estimatedTotalCost: p.totalCost || null,
    },
    apparatus: t("apparatus"),
    procedure: t("procedure"),
    userModel: t("user_model"),
    _rawAnswers: a,
  };
  return JSON.stringify(obj, null, 2);
}

function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Word-compatible HTML (.doc) — preserves headings, bold labels, and tables.
function buildExportDoc(a: Answers): string {
  const t = (k: string) => esc((a[k] || "").trim()) || "<i>(not provided)</i>";
  const ivs = parseIvs(a);
  const p = participantTotals(a);
  const dvs = parseDvs(a.sd_dv);
  const dvHtml = dvs.length
    ? "<ul>" + dvs.map((e) => `<li>${esc(dvDisplayName(e))}${(e.formula || "").trim() ? ` — <i>formula:</i> <code>${esc(e.formula || "")}</code>` : ""}</li>`).join("") + "</ul>"
    : "<i>(none)</i>";
  const ivHtml = ivs.length
    ? "<ul>" + ivSummaryLines(a).map((l) => `<li>${esc(l)}</li>`).join("") + "</ul>"
    : "<i>(none)</i>";
  const row = (k: string, val: string) => `<p><b>${k}:</b> ${val}</p>`;

  const body = `
    <h1>Experiment Design</h1>
    <h2>Research Questions</h2>
    <p>${esc((a.rq || "").trim()).replace(/\n/g, "<br/>") || "<i>(not provided)</i>"}</p>
    <h2>Study Design, Variables &amp; Participants</h2>
    <p><b>Dependent variables (DV):</b></p>${dvHtml}
    ${row("Model / framework", t("sd_iv_agent"))}
    <p><b>Independent variables:</b></p>${ivHtml}
    ${row("Control variables (CV)", esc(varsSummary(parseVars(a.sd_cv))) || "<i>(none)</i>")}
    ${row("Random variables (RV)", esc(varsSummary(parseVars(a.sd_rv))) || "<i>(none)</i>")}
    ${row("Design", esc(designDescriptor(ivs)) || "<i>(none)</i>")}
    ${row("Dataset", t("ds_dataset"))}
    ${row("Conditions / cells", String(ivs.length ? p.cells : "n/a"))}
    ${row("Participants per condition", a.sd_participants ? String(p.per) : "<i>(not provided)</i>")}
    ${row("Total participants", a.sd_participants ? String(p.totalP) : "n/a")}
    ${row("Estimated total time", p.totalMin ? `${p.totalMin} min (~${(p.totalMin / 60).toFixed(1)} h)` : "n/a")}
    ${row("Estimated total cost", p.totalCost ? String(p.totalCost) : "n/a")}
    <h2>Apparatus</h2>
    <p>${esc((a.apparatus || "").trim()).replace(/\n/g, "<br/>") || "<i>(not provided)</i>"}</p>
    <h2>Procedure</h2>
    <p>${esc((a.procedure || "").trim()).replace(/\n/g, "<br/>") || "<i>(not provided)</i>"}</p>
    <h2>User Model</h2>
    <p>${t("user_model")}</p>
  `;
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Experiment Design</title><style>
    body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2937;}
    h1{font-size:20pt;} h2{font-size:14pt;border-bottom:1px solid #ccc;padding-bottom:2pt;margin-top:16pt;}
    code{font-family:Consolas,monospace;background:#f3f4f6;}
    ul{margin:4pt 0 8pt 0;}
  </style></head><body>${body}</body></html>`;
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}

function REmpty() {
  return <span className="text-neutral-300">Not provided yet</span>;
}

function RSection({ title, done, onJump, children }: { title: string; done: boolean; onJump: () => void; children: ReactNode }) {
  return (
    <section className="border-t border-neutral-200 pt-6">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <span className={cn("grid h-4 w-4 place-items-center rounded-full text-[9px]", done ? "text-white" : "border border-neutral-300 text-neutral-300")} style={done ? { backgroundColor: ACCENT } : undefined}>
          {done ? <Check className="h-2.5 w-2.5" /> : ""}
        </span>
        <button onClick={onJump} className="ml-auto text-xs text-neutral-400 hover:text-neutral-600" style={{ fontFamily: "ui-sans-serif, system-ui" }}>Edit →</button>
      </div>
      {children}
    </section>
  );
}

function RRow({ label, value }: { label: string; value?: string }) {
  const v = (value || "").trim();
  return (
    <div className="grid grid-cols-[170px_1fr] gap-3 py-1.5 text-[15px]">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900">{v ? v : <REmpty />}</span>
    </div>
  );
}

function ReviewPage({ answers, onJump }: { answers: Answers; onJump: (id: string) => void }) {
  const a = answers;
  const has = (k: string) => (a[k] || "").trim().length > 0;
  const check = validateParticipants(a);
  const checkColor =
    check?.level === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : check?.level === "warn" ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-sky-200 bg-sky-50 text-sky-800";

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      <div className="flex items-start justify-between gap-4" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review & export</h1>
          <p className="mt-1 text-sm text-neutral-500">A read-only summary of your design. Download it as a Word document or JSON.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm text-neutral-400">Export:</span>
          <Button variant="outline" size="sm" onClick={() => downloadFile("experiment-design.doc", buildExportDoc(a), "application/msword")}>
            <Download className="mr-1 h-4 w-4" /> Word (.doc)
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadFile("experiment-design.json", buildExportJson(a), "application/json")}>
            <Download className="mr-1 h-4 w-4" /> JSON (.json)
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-6" style={{ fontFamily: SERIF }}>
        <RSection title="Research Questions" done={isPageComplete(PAGES[0], a)} onJump={() => onJump("rq")}>
          {has("rq") ? <p className="whitespace-pre-wrap leading-7 text-[15px] text-neutral-800">{a.rq}</p> : <REmpty />}
        </RSection>
        <RSection title="Study Design, Variables & Participants" done={isPageComplete(PAGES[1], a)} onJump={() => onJump("studydesign")}>
          <RRow label="Dependent variables" value={dvSummary(parseDvs(a.sd_dv))} />
          <RRow label="Model / framework" value={a.sd_iv_agent} />
          <div className="grid grid-cols-[170px_1fr] gap-3 py-1.5 text-[15px]">
            <span className="text-neutral-500">Independent variables</span>
            <span className="text-neutral-900">
              {parseIvs(a).length === 0 ? <REmpty /> : (
                <span className="space-y-0.5">
                  {ivSummaryLines(a).map((line, i) => (<span key={i} className="block">{line}</span>))}
                </span>
              )}
            </span>
          </div>
          <RRow label="Control variables (CV)" value={varsSummary(parseVars(a.sd_cv))} />
          <RRow label="Random variables (RV)" value={varsSummary(parseVars(a.sd_rv))} />
          <RRow label="Design" value={designDescriptor(parseIvs(a))} />
          <RRow label="Dataset" value={a.ds_dataset} />
          <RRow label="Conditions / cells" value={parseIvs(a).length ? String(totalCells(parseIvs(a))) : ""} />
          <RRow label="Participants / condition" value={a.sd_participants} />
          <RRow label="Total participants" value={a.sd_participants ? String(participantTotals(a).totalP) : ""} />
          {participantTotals(a).totalMin ? <RRow label="Est. total time" value={`${participantTotals(a).totalMin} min (~${(participantTotals(a).totalMin / 60).toFixed(1)} h)`} /> : null}
          {participantTotals(a).totalCost ? <RRow label="Est. total cost" value={String(participantTotals(a).totalCost)} /> : null}
          {check ? <div className={cn("mt-3 rounded-lg border px-3 py-2 text-sm", checkColor)} style={{ fontFamily: "ui-sans-serif, system-ui" }}>{check.message}</div> : null}
        </RSection>
        <RSection title="Apparatus" done={isPageComplete(PAGES[2], a)} onJump={() => onJump("apparatus")}>
          {has("apparatus") ? <p className="whitespace-pre-wrap leading-7 text-[15px] text-neutral-800">{a.apparatus}</p> : <REmpty />}
        </RSection>
        <RSection title="Procedure" done={isPageComplete(PAGES[3], a)} onJump={() => onJump("procedure")}>
          {has("procedure") ? <p className="whitespace-pre-wrap leading-7 text-[15px] text-neutral-800">{a.procedure}</p> : <REmpty />}
        </RSection>
        <RSection title="User Model" done={isPageComplete(PAGES[4], a)} onJump={() => onJump("usermodel")}>
          <RRow label="User model" value={a.user_model} />
        </RSection>
      </div>
    </div>
  );
}

/* ----------------------------- Chat panel (right column) ----------------------------- */

const APPLY_KEYS = new Set([
  "overview", "rq", "sd_dv", "sd_iv_agent", "sd_iv", "sd_iv_levels", "sd_cv",
  "sd_conditions", "sd_design", "sd_balancing", "sd_participants", "ds_agent", "ds_dataset",
]);

function parseUpdates(text: string, allowed: Set<string>): { clean: string; updates: Record<string, string> | null } {
  const m = text.match(/@@APPLY@@([\s\S]*?)@@END@@/);
  const clean = text.replace(/@@APPLY@@[\s\S]*?@@END@@/g, "").trim();
  if (!m) return { clean, updates: null };
  try {
    const raw = JSON.parse(m[1].trim());
    const updates: Record<string, string> = {};
    for (const [k, val] of Object.entries(raw)) {
      if (APPLY_KEYS.has(k) && allowed.has(k) && val != null) updates[k] = String(val);
    }
    return { clean, updates: Object.keys(updates).length ? updates : null };
  } catch {
    return { clean, updates: null };
  }
}

function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

const FIELD_LABELS: Record<string, string> = {
  rq: "research question(s)",
  sd_dv: "dependent variables",
  sd_iv_agent: "model/framework",
  sd_cv: "control variables (CV)",
  sd_rv: "random variables (RV)",
  sd_participants: "number of participants",
  ds_dataset: "dataset",
  apparatus: "apparatus & materials",
  procedure: "experiment procedure",
  user_model: "user model",
};

// Per-page chat focus + the fields the assistant may fill while on that page.
const PAGE_CHAT: Record<string, { focus: string; fields: string[] }> = {
  rq: {
    focus: "the research question(s)",
    fields: ["rq"],
  },
  studydesign: {
    focus: "the model/framework, the dataset, and number of participants. Note: the variables (DV / IV / CV / RV) are added by the user as typed lists in the panel, and the user model is chosen on its own page — guide them, but you cannot set those yourself.",
    fields: ["sd_iv_agent", "ds_dataset", "sd_participants"],
  },
  apparatus: {
    focus: "the apparatus and materials (devices, software/toolkit, what participants interact with)",
    fields: ["apparatus"],
  },
  procedure: {
    focus: "the step-by-step experiment procedure",
    fields: ["procedure"],
  },
  usermodel: {
    focus: "the user model — a cognitive model or ML proxy; the user picks one from the list (you cannot set it yourself, but help them choose)",
    fields: [],
  },
  review: {
    focus: "reviewing the overall design (there are no fields to fill on this page)",
    fields: [],
  },
};

const ALL_CONTENT_KEYS = ["rq", "sd_iv_agent", "sd_participants", "ds_dataset", "apparatus", "procedure", "user_model"];

function buildChatContext(page: Page, a: Answers): string {
  const cfg = PAGE_CHAT[page.id] ?? { focus: "", fields: [] as string[] };
  const snip = (k: string, n = 120) => {
    const v = (a[k] || "").trim();
    return v ? (v.length > n ? v.slice(0, n) + "…" : v) : "(empty)";
  };

  // Whole-design awareness: a compact view of every section.
  const ivs = parseIvs(a);
  const ivLine = ivs.length ? ivs.map((e, i) => `IV${i + 1} ${e.label || "?"}=${e.levels || "?"} [${e.alloc === "Between-subjects" ? "between" : "within"}${e.balancing ? ", " + e.balancing : ""}]`).join("; ") : "(none yet)";
  const lines = ALL_CONTENT_KEYS.map((k) => `- ${FIELD_LABELS[k] ?? k}: ${snip(k)}`);
  lines.splice(1, 0, `- dependent variables: ${dvSummary(parseDvs(a.sd_dv)) || "(empty)"}`);
  lines.push(`- control variables (CV): ${varsSummary(parseVars(a.sd_cv)) || "(empty)"}`);
  lines.push(`- random variables (RV): ${varsSummary(parseVars(a.sd_rv)) || "(empty)"}`);
  lines.push(`- independent variables: ${ivLine}`);
  const overview = lines.join("\n");

  const fillable = cfg.fields.length ? cfg.fields.join(", ") : "(none — user-driven page)";
  const missing = cfg.fields.filter((k) => !(a[k] || "").trim());
  const missingLine = cfg.fields.length === 0
    ? "There are no fields for you to fill here; help the user with this section."
    : missing.length === 0
      ? "All fields you can fill on this page are done — say it looks complete and they can move on."
      : `Still missing on this page: ${missing.map((k) => FIELD_LABELS[k] ?? k).join("; ")}. Ask about the next one or two.`;

  return [
    `Whole design so far (all sections):\n${overview}`,
    `Current page: ${page.navTitle}`,
    `This page covers: ${cfg.focus}`,
    `Fields you may fill right now: ${fillable}`,
    missingLine,
  ].join("\n\n");
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

function ChatPanel({ messages, setMessages, allowedFields, context, onApplyUpdates }: { messages: ChatMsg[]; setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>; allowedFields: string[]; context: string; onApplyUpdates: (u: Record<string, string>) => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef(context);
  contextRef.current = context;
  const allowedRef = useRef(new Set(allowedFields));
  allowedRef.current = new Set(allowedFields);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context: contextRef.current }),
      });
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const visible = acc.split("@@APPLY@@")[0].trimEnd();
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: visible };
          return copy;
        });
      }
      const { clean, updates } = parseUpdates(acc, allowedRef.current);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: clean || "Done." };
        return copy;
      });
      if (updates) onApplyUpdates(updates);
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Sorry — I couldn't reach the assistant just now. Please try again." };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
        <span className="grid h-6 w-6 place-items-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
          <Wand2 className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-semibold">Design assistant</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" ? (
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
                  <Wand2 className="h-4 w-4" />
                </span>
              ) : null}
              <div className={cn("max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed", m.role === "user" ? "text-white" : "bg-neutral-100 text-neutral-800")} style={m.role === "user" ? { backgroundColor: ACCENT } : undefined}>
                {m.content ? stripMd(m.content) : (loading && i === messages.length - 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : null)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-neutral-200 px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Describe your study, or answer the assistant…"
            className="max-h-40 flex-1 resize-none rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
          <button onClick={send} disabled={loading || !input.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }} aria-label="Send">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExperimentWizard;
