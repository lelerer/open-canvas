"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAGES, Answers, Page, isPageComplete, totalCells, normalizeIvSpecs, normalizeDvSpecs, normalizeVarSpecs, normalizeProcSpecs, normalizeApparatusList } from "./questions";
import { ACCENT } from "./wizardUi";
import { GLOBAL_OPENING, ChatMsg, ApplyPayload, ALL_FILLABLE, applyOneOp, ivAgentOf, buildChatContext, ChatPanel } from "./wizardChat";
import { TextBody, ApparatusBody, ProcedureBody, UserModelBody, ResultsBody, clearCachedRunOutcome } from "./wizardPages";
import { StudyDesignBody } from "./wizardStudyDesign";
import { ReviewPage } from "./wizardReview";

const STORAGE_KEY = "experiment-interview-v1";

const LAST = PAGES.length - 1;

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
  function resetExperiment() {
    if (!window.confirm("Start a new experiment? This clears all saved answers and the assistant chat on this device.")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    clearCachedRunOutcome();
    setAnswers({});
    setStep(0);
    setMessages([{ role: "assistant", content: GLOBAL_OPENING }]);
  }
  function applyUpdates(payload: ApplyPayload) {
    const { updates, ops } = payload;
    setAnswers((a) => {
      let next: Answers = { ...a };
      const STRUCTURED = new Set(["sd_ivs", "sd_dv", "sd_cv", "sd_rv", "proc_steps", "cog_config", "apparatus_list"]);
      for (const [k, v] of Object.entries(updates)) {
        if (STRUCTURED.has(k)) continue; // handled below
        next[k] = v;
      }
      const parseArr = (s: string): any => { try { return JSON.parse(s); } catch { return null; } };
      // Full-list replacement (only if the model sends a whole array).
      if (updates.sd_ivs != null) {
        const specs = parseArr(updates.sd_ivs);
        if (specs) {
          const norm = normalizeIvSpecs(specs, ivAgentOf(next));
          next.sd_ivs = JSON.stringify(norm);
          next.sd_conditions = String(totalCells(norm));
        }
      }
      if (updates.sd_dv != null) { const s = parseArr(updates.sd_dv); if (s) next.sd_dv = JSON.stringify(normalizeDvSpecs(s)); }
      if (updates.sd_cv != null) { const s = parseArr(updates.sd_cv); if (s) next.sd_cv = JSON.stringify(normalizeVarSpecs(s)); }
      if (updates.sd_rv != null) { const s = parseArr(updates.sd_rv); if (s) next.sd_rv = JSON.stringify(normalizeVarSpecs(s)); }
      if (updates.proc_steps != null) { const s = parseArr(updates.proc_steps); if (s) next.proc_steps = JSON.stringify(normalizeProcSpecs(s)); }
      if (updates.cog_config != null) {
        const s = parseArr(updates.cog_config);
        if (s && typeof s === "object" && !Array.isArray(s)) {
          let existing: Record<string, string> = {};
          try { existing = JSON.parse(next.cog_config || "{}"); } catch { existing = {}; }
          const merged: Record<string, string> = { ...existing };
          for (const [k, v] of Object.entries(s)) merged[k] = String(v);
          next.cog_config = JSON.stringify(merged);
        }
      }
      if (updates.apparatus_list != null) {
        const s = parseArr(updates.apparatus_list);
        if (Array.isArray(s)) next.apparatus_list = JSON.stringify(normalizeApparatusList(s));
      }
      // Incremental ops (preferred for edits).
      for (const op of ops) next = applyOneOp(next, op);
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 text-neutral-900">
      {/* Sidebar — page nav */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-7 w-7 place-items-center rounded-md text-white" style={{ backgroundColor: ACCENT }}>
            <FileText className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Experiment Co-designer</span>
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
        <div className="border-t border-neutral-100 p-3">
          <button
            onClick={resetExperiment}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800"
          >
            <RotateCcw className="h-4 w-4" /> New / reset experiment
          </button>
        </div>
      </aside>

      {/* Middle — current editable page */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto">
          {page.kind === "review" ? (
            <ReviewPage answers={answers} onJump={(id) => setStep(PAGES.findIndex((p) => p.id === id))} />
          ) : page.kind === "results" ? (
            <ResultsBody answers={answers} setAnswer={setAnswer} />
          ) : (
            <div className={cn("mx-auto w-full px-6 py-10", page.kind === "apparatus" ? "max-w-4xl" : "max-w-2xl")}>
              {page.kind === "text" ? (
                <TextBody page={page} answers={answers} setAnswer={setAnswer} />
              ) : page.kind === "studydesign" ? (
                <StudyDesignBody answers={answers} setAnswer={setAnswer} />
              ) : page.kind === "apparatus" ? (
                <ApparatusBody page={page} answers={answers} setAnswer={setAnswer} />
              ) : page.kind === "procedure" ? (
                <ProcedureBody page={page} answers={answers} setAnswer={setAnswer} />
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
          allowedFields={ALL_FILLABLE}
          context={buildChatContext(page, answers)}
          onApplyUpdates={applyUpdates}
        />
      </div>
    </div>
  );
}

/* ----------------------------- Page bodies (editable) ----------------------------- */

// Small info affordance: an "i" icon that reveals an explanation on hover / click.

export default ExperimentWizard;