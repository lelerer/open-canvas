"use client";

import { type ReactNode } from "react";
import { Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ACCENT, SERIF } from "./wizardUi";
import {
  Answers, PAGES, isPageComplete, parseIvs, totalCells, betweenCells, designDescriptor,
  parseDvs, dvSummary, dvDisplayName, parseVars, varsSummary, parseProcSteps, procStepsSummary,
  validateParticipants, parseIdList, ivSummaryLines, participantTotals, mlProxyNames, cogConfigSummary,
  parseApparatusList, apparatusSummaryLines,
} from "./questions";

export function buildExportText(a: Answers): string {
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
    "Independent variables:",
    ...ivLines.map((l) => `  - ${l}`),
    `Control variables (CV): ${varsSummary(parseVars(a.sd_cv)) || "(not provided)"}`,
    `Random variables (RV): ${varsSummary(parseVars(a.sd_rv)) || "(not provided)"}`,
    `Design: ${designDescriptor(ivs) || "(not provided)"}`,
    `Dataset: ${v("ds_dataset")}`,
    `Total conditions / cells: ${ivs.length ? p.cells : "(n/a)"}`,
    `Participants per condition: ${a.sd_participants ? p.per : "(not provided)"}`,
    `Total participants: ${a.sd_participants ? p.totalP : "(n/a)"}`,
    `Trials per participant: ${p.trials}`,
    `Total trials: ${a.sd_participants ? p.totalTrials : "(n/a)"}`,

    "APPARATUS",
    ...(apparatusSummaryLines(a).length ? apparatusSummaryLines(a) : ["(none)"]), "",
    "PROCEDURE",
    ...(parseProcSteps(a.proc_steps).length ? procStepsSummary(parseProcSteps(a.proc_steps)) : ["(no steps)"]),
    "",
    "USER MODEL", v("user_model"),
    `Comparison baselines: ${mlProxyNames(a) || "(none)"}`,
    `Cognitive config: ${cogConfigSummary(a) || "(defaults)"}`, "",
  ].join("\n");
}

export function buildExportJson(a: Answers): string {
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
      trialsPerParticipant: p.trials,
      totalTrials: a.sd_participants ? p.totalTrials : null,
    },
    apparatus: parseApparatusList(a),
    procedure: parseProcSteps(a.proc_steps),
    userModel: t("user_model"),
    mlProxyBaselines: parseIdList(a.ml_proxies),
    cognitiveConfig: (() => { try { return JSON.parse(a.cog_config || "{}"); } catch { return {}; } })(),
    _rawAnswers: a,
  };
  return JSON.stringify(obj, null, 2);
}

export function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Word-compatible HTML (.doc) — preserves headings, bold labels, and tables.

export function buildExportDoc(a: Answers): string {
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
    <p><b>Independent variables:</b></p>${ivHtml}
    ${row("Control variables (CV)", esc(varsSummary(parseVars(a.sd_cv))) || "<i>(none)</i>")}
    ${row("Random variables (RV)", esc(varsSummary(parseVars(a.sd_rv))) || "<i>(none)</i>")}
    ${row("Design", esc(designDescriptor(ivs)) || "<i>(none)</i>")}
    ${row("Dataset", t("ds_dataset"))}
    ${row("Conditions / cells", String(ivs.length ? p.cells : "n/a"))}
    ${row("Participants per condition", a.sd_participants ? String(p.per) : "<i>(not provided)</i>")}
    ${row("Total participants", a.sd_participants ? String(p.totalP) : "n/a")}
    ${row("Trials per participant", String(p.trials))}
    ${row("Total trials", a.sd_participants ? String(p.totalTrials) : "n/a")}
    <h2>Apparatus</h2>
    ${apparatusSummaryLines(a).length ? apparatusSummaryLines(a).map((l) => `<p>${esc(l)}</p>`).join("") : "<p><i>(not provided)</i></p>"}
    <h2>Procedure</h2>
    ${parseProcSteps(a.proc_steps).length ? "<ol>" + parseProcSteps(a.proc_steps).filter((st) => (st.title || "").trim()).map((st) => `<li>${esc(st.title)}${(st.note || "").trim() ? ` — ${esc(st.note || "")}` : ""}${st.attachment ? ` (file: ${esc(st.attachment)})` : ""}${st.link ? ` (<a href="${esc(st.link)}">link</a>)` : ""}</li>`).join("") + "</ol>" : "<p><i>(no steps)</i></p>"}
    <h2>User Model</h2>
    <p>${t("user_model")}</p>
    ${mlProxyNames(a) ? `<p><b>Comparison baselines:</b> ${esc(mlProxyNames(a))}</p>` : ""}
    ${cogConfigSummary(a) ? `<p><b>Cognitive config:</b> ${esc(cogConfigSummary(a))}</p>` : ""}
  `;
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Experiment Design</title><style>
    body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2937;}
    h1{font-size:20pt;} h2{font-size:14pt;border-bottom:1px solid #ccc;padding-bottom:2pt;margin-top:16pt;}
    code{font-family:Consolas,monospace;background:#f3f4f6;}
    ul{margin:4pt 0 8pt 0;}
  </style></head><body>${body}</body></html>`;
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}

export function REmpty() {
  return <span className="text-neutral-300">Not provided yet</span>;
}

export function RSection({ title, done, onJump, children }: { title: string; done: boolean; onJump: () => void; children: ReactNode }) {
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

export function RRow({ label, value }: { label: string; value?: string }) {
  const v = (value || "").trim();
  return (
    <div className="grid grid-cols-[170px_1fr] gap-3 py-1.5 text-[15px]">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900">{v ? v : <REmpty />}</span>
    </div>
  );
}

export function ReviewPage({ answers, onJump }: { answers: Answers; onJump: (id: string) => void }) {
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
          <RRow label="Trials / participant" value={String(participantTotals(a).trials)} />
          <RRow label="Total trials" value={a.sd_participants ? String(participantTotals(a).totalTrials) : ""} />
          {check ? <div className={cn("mt-3 rounded-lg border px-3 py-2 text-sm", checkColor)} style={{ fontFamily: "ui-sans-serif, system-ui" }}>{check.message}</div> : null}
        </RSection>
        <RSection title="Apparatus" done={isPageComplete(PAGES[2], a)} onJump={() => onJump("apparatus")}>
          {apparatusSummaryLines(a).length ? (
            <div className="space-y-1">
              {apparatusSummaryLines(a).map((l, i) => (<p key={i} className="text-[15px] text-neutral-800">{l}</p>))}
            </div>
          ) : <REmpty />}
        </RSection>
        <RSection title="Procedure" done={isPageComplete(PAGES[3], a)} onJump={() => onJump("procedure")}>
          {parseProcSteps(a.proc_steps).length ? (
            <ol className="space-y-1 text-[15px] text-neutral-800">
              {procStepsSummary(parseProcSteps(a.proc_steps)).map((line, i) => (<li key={i} className="leading-7">{line}</li>))}
            </ol>
          ) : <REmpty />}
        </RSection>
        <RSection title="User Model" done={isPageComplete(PAGES[4], a)} onJump={() => onJump("usermodel")}>
          <RRow label="User model" value={a.user_model} />
          <RRow label="Comparison baselines" value={mlProxyNames(a)} />
          <RRow label="Cognitive config" value={cogConfigSummary(a)} />
        </RSection>
      </div>
    </div>
  );
}

/* ----------------------------- Chat panel (right column) ----------------------------- */

// Every field the assistant may fill/modify, anywhere in the form.
