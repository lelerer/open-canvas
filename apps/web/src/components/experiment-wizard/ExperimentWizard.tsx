"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FileJson,
  Check,
  Loader2,
  Send,
  Wand2,
  Download,
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
  AGENT_OPTIONS,
  DESIGN_TYPES,
  BALANCING_METHODS,
  IV_AGENTS,
  IV_CATALOG,
  IvFactor,
  ivFactorsForAgent,
  ivLevelsFor,
} from "./questions";

const STORAGE_KEY = "experiment-interview-v1";
const ACCENT = "#359793";
const SERIF = 'Georgia, Cambria, "Times New Roman", serif';
const LAST = PAGES.length - 1;

export function ExperimentWizard() {
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);

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
          <span className="text-sm font-semibold tracking-tight">Experiment Designer</span>
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
                <DatasetBody answers={answers} setAnswer={setAnswer} />
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

      {/* Right — chat, always present, side by side */}
      <div className="hidden w-[26rem] shrink-0 border-l border-neutral-200 md:flex">
        <ChatPanel
          key={page.id}
          opening={(PAGE_CHAT[page.id] ?? PAGE_CHAT.overview).opening}
          allowedFields={(PAGE_CHAT[page.id] ?? PAGE_CHAT.overview).fields}
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
          <DocLabel>We measure</DocLabel>
          <DocText value={a.sd_dv ?? ""} onChange={(v) => setAnswer("sd_dv", v)} placeholder="the dependent variable(s) — e.g. trust calibration (7-pt), task accuracy (%), decision time (s)" multiline />
        </div>

        <div>
          <DocLabel>We manipulate · independent variable</DocLabel>
          <IvBuilder answers={answers} setAnswer={setAnswer} />
        </div>

        <div>
          <DocLabel>We hold constant</DocLabel>
          <DocText value={a.sd_cv ?? ""} onChange={(v) => setAnswer("sd_cv", v)} placeholder="the control variables — e.g. same dataset, task length, and device across conditions" multiline />
        </div>

        <div className="border-t border-neutral-100 pt-6">
          <DocLabel>Structure</DocLabel>
          <p className="mt-1 text-[15px] leading-8 text-neutral-800">
            This is a{" "}
            <span className="inline-block align-baseline">
              <DocSelect value={a.sd_design ?? ""} onChange={(v) => setAnswer("sd_design", v)} options={DESIGN_TYPES} placeholder="design type" />
            </span>{" "}
            study with{" "}
            <span className="inline-block align-baseline">
              <DocSelect value={a.sd_balancing ?? ""} onChange={(v) => setAnswer("sd_balancing", v)} options={BALANCING_METHODS} placeholder="counterbalancing" />
            </span>.
          </p>
        </div>

        <div className="border-t border-neutral-100 pt-6">
          <DocLabel>Participants</DocLabel>
          <p className="mt-1 text-[15px] leading-8 text-neutral-800">
            We will recruit{" "}
            <input
              type="number"
              value={a.sd_participants ?? ""}
              onChange={(e) => setAnswer("sd_participants", e.target.value)}
              placeholder="N"
              className="w-16 border-0 border-b border-neutral-200 bg-transparent px-0 py-0.5 text-center text-[15px] text-neutral-900 outline-none placeholder:text-neutral-300 focus:border-neutral-400"
            />{" "}
            participants across{" "}
            <input
              type="number"
              value={a.sd_conditions ?? ""}
              onChange={(e) => setAnswer("sd_conditions", e.target.value)}
              placeholder="?"
              className="w-12 border-0 border-b border-neutral-200 bg-transparent px-0 py-0.5 text-center text-[15px] text-neutral-900 outline-none placeholder:text-neutral-300 focus:border-neutral-400"
            />{" "}
            conditions.
          </p>
          {check ? <p className={cn("mt-2 text-sm", checkColor)} style={{ fontFamily: "ui-sans-serif, system-ui" }}>{check.message}</p> : null}
        </div>
      </div>
    </div>
  );
}

function IvBuilder({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  const agent = a.sd_iv_agent || a.ds_agent || "CoAX";
  const factors = ivFactorsForAgent(agent);
  const factor: IvFactor | null = IV_CATALOG.find((f) => f.id === a.sd_iv_factor) || null;
  const levels = (a.sd_iv_levels || "").split(" | ").map((s) => s.trim()).filter(Boolean);

  function setAgent(v: string) {
    setAnswer("sd_iv_agent", v); setAnswer("sd_iv_factor", ""); setAnswer("sd_iv", ""); setAnswer("sd_iv_levels", ""); setAnswer("sd_cog_param", "");
  }
  function setFactor(id: string) {
    const f = IV_CATALOG.find((x) => x.id === id) || null;
    setAnswer("sd_iv_factor", id); setAnswer("sd_iv", f ? f.label : ""); setAnswer("sd_iv_levels", ""); setAnswer("sd_cog_param", "");
    if (f?.kind === "binary" && f.binary) { setAnswer("sd_iv_levels", `${f.binary[0]} vs ${f.binary[1]}`); setAnswer("sd_conditions", "2"); }
  }
  function toggleLevel(level: string) {
    const set = new Set(levels);
    if (set.has(level)) set.delete(level); else set.add(level);
    const arr = [...set];
    setAnswer("sd_iv_levels", arr.join(" | ")); setAnswer("sd_conditions", String(arr.length));
  }
  function setRange(min: string, max: string) {
    setAnswer("sd_iv_min", min); setAnswer("sd_iv_max", max);
    setAnswer("sd_iv_levels", min || max ? `${min || "?"}–${max || "?"}` : "");
  }

  const cogParams = factor?.kind === "cognitive" && factor.cognitiveByAgent ? factor.cognitiveByAgent[agent] ?? [] : [];
  const cogParam = cogParams.find((p) => p.name === a.sd_cog_param) || null;
  const numCls = "w-20 border-0 border-b border-neutral-200 bg-transparent px-0 py-0.5 text-center text-[15px] outline-none placeholder:text-neutral-300 focus:border-neutral-400";

  return (
    <div>
      <p className="mt-1 text-[15px] leading-8 text-neutral-800" style={{ fontFamily: SERIF }}>
        Using{" "}
        <span className="inline-block align-baseline" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          <DocSelect value={agent} onChange={setAgent} options={IV_AGENTS} placeholder="model" />
        </span>
        , we vary{" "}
        <span className="inline-block align-baseline" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          <select
            value={a.sd_iv_factor ?? ""}
            onChange={(e) => setFactor(e.target.value)}
            className={cn("max-w-[16rem] truncate border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] leading-7 outline-none focus:border-neutral-500", a.sd_iv_factor ? "text-neutral-900" : "text-neutral-400")}
          >
            <option value="">a factor</option>
            {factors.map((f) => (<option key={f.id} value={f.id} className="text-neutral-900">{f.label}</option>))}
          </select>
        </span>.
      </p>

      {factor ? (
        <div className="mt-2 pl-4" style={{ fontFamily: "ui-sans-serif, system-ui", borderLeft: `2px solid #e5e7eb` }}>
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
              From{" "}
              <input type="number" value={a.sd_iv_min ?? ""} onChange={(e) => setRange(e.target.value, a.sd_iv_max ?? "")} placeholder={String(factor.range.min)} className={numCls} />{" "}
              to{" "}
              <input type="number" value={a.sd_iv_max ?? ""} onChange={(e) => setRange(a.sd_iv_min ?? "", e.target.value)} placeholder={String(factor.range.max)} className={numCls} />{" "}
              <span className="text-neutral-400">(allowed {factor.range.min}–{factor.range.max})</span>
            </p>
          ) : null}

          {factor.kind === "cognitive" ? (
            <div className="space-y-2">
              <DocSelect
                value={a.sd_cog_param ?? ""}
                onChange={(v) => { setAnswer("sd_cog_param", v); setAnswer("sd_iv", v ? `Cognitive: ${v}` : "Cognitive parameters"); setAnswer("sd_iv_levels", ""); }}
                options={cogParams.map((p) => p.name)}
                placeholder="choose a parameter"
              />
              {cogParam ? (
                <div className="text-sm text-neutral-600">
                  {cogParam.note ? <p className="mb-1 text-xs text-neutral-400">{cogParam.note}</p> : null}
                  {cogParam.min < cogParam.max ? (
                    <p>
                      From{" "}
                      <input type="number" value={a.sd_iv_min ?? ""} onChange={(e) => setRange(e.target.value, a.sd_iv_max ?? "")} placeholder={String(cogParam.min)} className={numCls} />{" "}
                      to{" "}
                      <input type="number" value={a.sd_iv_max ?? ""} onChange={(e) => setRange(a.sd_iv_min ?? "", e.target.value)} placeholder={String(cogParam.max)} className={numCls} />{" "}
                      <span className="text-neutral-400">(allowed {cogParam.min} to {cogParam.max})</span>
                    </p>
                  ) : (
                    <input value={a.sd_iv_levels ?? ""} onChange={(e) => setAnswer("sd_iv_levels", e.target.value)} placeholder="e.g. top-2 features vs all features" className="w-full border-0 border-b border-neutral-200 bg-transparent px-0 py-1 text-[15px] outline-none placeholder:text-neutral-300 focus:border-neutral-400" />
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DatasetBody({ answers, setAnswer }: { answers: Answers; setAnswer: (id: string, v: string) => void }) {
  const a = answers;
  return (
    <>
      <h1 className="text-2xl font-semibold leading-snug tracking-tight">Dataset & agent</h1>
      <p className="mt-2 text-sm text-neutral-500">Choose the agent participants evaluate, and describe the trial configuration.</p>

      <Field label="Agent under evaluation" hint="The system whose predictions/explanations participants judge.">
        <Select value={a.ds_agent ?? ""} onChange={(v) => setAnswer("ds_agent", v)} options={AGENT_OPTIONS} placeholder="— Select an agent —" />
      </Field>

      <Field label="Dataset / trial configuration" hint="Practice / baseline / main blocks, trials per block, analysed trials per participant.">
        <Textarea value={a.ds_dataset ?? ""} onChange={(e) => setAnswer("ds_dataset", e.target.value)} placeholder="e.g. 5 practice + 40 main trials, 2 blocks, dataset = German Credit, 20 analysed trials per participant" className="min-h-[120px] resize-y bg-white text-sm" />
      </Field>
    </>
  );
}

/* ----------------------------- Review & export ----------------------------- */

function ivLabel(a: Answers) {
  return [a.sd_iv, a.sd_iv_agent ? `(${a.sd_iv_agent})` : ""].filter(Boolean).join(" ");
}

function buildExportText(a: Answers): string {
  const v = (k: string) => (a[k] || "").trim() || "(not provided)";
  return [
    "EXPERIMENT DESIGN", "=================", "",
    "OVERVIEW", v("overview"), "",
    "RESEARCH QUESTIONS", v("rq"), "",
    "STUDY DESIGN, VARIABLES & PARTICIPANTS",
    `Dependent variable(s): ${v("sd_dv")}`,
    `Independent variable: ${ivLabel(a) || "(not provided)"}`,
    `IV levels / range: ${v("sd_iv_levels")}`,
    `Control variables: ${v("sd_cv")}`,
    `Design type: ${v("sd_design")}`,
    `Counterbalancing: ${v("sd_balancing")}`,
    `Number of conditions / cells: ${v("sd_conditions")}`,
    `Participants (total N): ${v("sd_participants")}`, "",
    "DATASET & AGENT",
    `Agent under evaluation: ${v("ds_agent")}`,
    `Dataset / trial configuration: ${v("ds_dataset")}`, "",
  ].join("\n");
}

function buildExportJson(a: Answers): string {
  const t = (k: string) => (a[k] || "").trim();
  const obj = {
    overview: t("overview"),
    researchQuestions: t("rq"),
    studyDesign: {
      dependentVariables: t("sd_dv"),
      independentVariable: { factor: t("sd_iv"), modelFramework: t("sd_iv_agent"), levelsOrRange: t("sd_iv_levels") },
      controlVariables: t("sd_cv"),
      designType: t("sd_design"),
      counterbalancing: t("sd_balancing"),
      conditions: t("sd_conditions"),
      participants: t("sd_participants"),
    },
    datasetAndAgent: { agent: t("ds_agent"), datasetConfig: t("ds_dataset") },
    _rawAnswers: a,
  };
  return JSON.stringify(obj, null, 2);
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
          <p className="mt-1 text-sm text-neutral-500">A read-only summary of your design. Export it as plain text or JSON.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadFile("experiment-design.txt", buildExportText(a), "text/plain;charset=utf-8")}>
            <Download className="mr-1 h-4 w-4" /> .txt
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadFile("experiment-design.json", buildExportJson(a), "application/json")}>
            <FileJson className="mr-1 h-4 w-4" /> .json
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-6" style={{ fontFamily: SERIF }}>
        <RSection title="Overview" done={isPageComplete(PAGES[0], a)} onJump={() => onJump("overview")}>
          {has("overview") ? <p className="leading-7 text-[15px] text-neutral-800">{a.overview}</p> : <REmpty />}
        </RSection>
        <RSection title="Research Questions" done={isPageComplete(PAGES[1], a)} onJump={() => onJump("rq")}>
          {has("rq") ? <p className="whitespace-pre-wrap leading-7 text-[15px] text-neutral-800">{a.rq}</p> : <REmpty />}
        </RSection>
        <RSection title="Study Design, Variables & Participants" done={isPageComplete(PAGES[2], a)} onJump={() => onJump("studydesign")}>
          <RRow label="Dependent variable(s)" value={a.sd_dv} />
          <RRow label="Independent variable" value={ivLabel(a)} />
          <RRow label="IV levels / range" value={a.sd_iv_levels} />
          <RRow label="Control variables" value={a.sd_cv} />
          <RRow label="Design type" value={a.sd_design} />
          <RRow label="Counterbalancing" value={a.sd_balancing} />
          <RRow label="Conditions / cells" value={a.sd_conditions} />
          <RRow label="Participants (N)" value={a.sd_participants} />
          {check ? <div className={cn("mt-3 rounded-lg border px-3 py-2 text-sm", checkColor)} style={{ fontFamily: "ui-sans-serif, system-ui" }}>{check.message}</div> : null}
        </RSection>
        <RSection title="Dataset & Agent" done={isPageComplete(PAGES[3], a)} onJump={() => onJump("dataset")}>
          <RRow label="Agent under evaluation" value={a.ds_agent} />
          <RRow label="Dataset / trial config" value={a.ds_dataset} />
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
  overview: "experiment overview",
  rq: "research question(s)",
  sd_dv: "dependent variable(s)",
  sd_iv_agent: "model/framework",
  sd_iv: "independent variable (factor)",
  sd_iv_levels: "IV levels / range",
  sd_cv: "control variables",
  sd_design: "design type (within/between/mixed)",
  sd_balancing: "counterbalancing method",
  sd_conditions: "number of conditions",
  sd_participants: "number of participants",
  ds_agent: "agent (CoAX or CoXAM)",
  ds_dataset: "dataset / trial configuration",
};

// Per-page chat: a fresh conversation, its own opening, and the only fields it may fill.
const PAGE_CHAT: Record<string, { opening: string; focus: string; fields: string[] }> = {
  overview: {
    opening: "Let's start with the big picture. What's this experiment about — what are you hoping to test or explore? A rough direction is completely fine; we'll sharpen it together.",
    focus: "the experiment overview — a short description of what's being studied",
    fields: ["overview"],
  },
  rq: {
    opening: "Now the research questions. What do you actually want to find out in this study? Even one core question is a great start.",
    focus: "the research question(s)",
    fields: ["rq"],
  },
  studydesign: {
    opening: "Let's work out the study mechanics. To begin: what will you measure as your outcomes, and what's the one thing you want to manipulate?",
    focus: "the dependent variable(s), the independent variable (model/framework, factor, and levels), control variables, design type, counterbalancing, number of conditions, and number of participants",
    fields: ["sd_dv", "sd_iv_agent", "sd_iv", "sd_iv_levels", "sd_cv", "sd_design", "sd_balancing", "sd_conditions", "sd_participants"],
  },
  dataset: {
    opening: "Last piece: which agent will participants evaluate — CoAX or CoXAM — and how are the trials and datasets set up?",
    focus: "the agent under evaluation and the dataset / trial configuration",
    fields: ["ds_agent", "ds_dataset"],
  },
  review: {
    opening: "Here's your design coming together on the left. Want me to sanity-check anything — the sample size, the variables, or how it hangs together?",
    focus: "reviewing the overall design (there are no fields to fill on this page)",
    fields: [],
  },
};

function buildChatContext(page: Page, a: Answers): string {
  const cfg = PAGE_CHAT[page.id] ?? PAGE_CHAT.overview;
  const snip = (k: string, n = 120) => {
    const v = (a[k] || "").trim();
    return v ? (v.length > n ? v.slice(0, n) + "…" : v) : "(empty)";
  };
  const lines = cfg.fields.map((k) => `- ${k} (${FIELD_LABELS[k] ?? k}): ${snip(k)}`);
  const missing = cfg.fields.filter((k) => !(a[k] || "").trim());
  const fillable = cfg.fields.length ? cfg.fields.join(", ") : "(none — this is a review page)";
  const status = cfg.fields.length ? lines.join("\n") : "(no fields on this page)";
  const missingLine = cfg.fields.length === 0
    ? "There are no fields to fill here; just help the user review."
    : missing.length === 0
      ? "All fields on this page are filled — tell the user this page looks complete and they can move on."
      : `Still missing on this page: ${missing.map((k) => FIELD_LABELS[k] ?? k).join("; ")}. Ask about the next one or two.`;
  return [
    `Current page: ${page.navTitle}`,
    `This page covers: ${cfg.focus}`,
    `Fields you may fill on this page: ${fillable}`,
    `Status of those fields:\n${status}`,
    missingLine,
  ].join("\n\n");
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

function ChatPanel({ opening, allowedFields, context, onApplyUpdates }: { opening: string; allowedFields: string[]; context: string; onApplyUpdates: (u: Record<string, string>) => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: opening }]);
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