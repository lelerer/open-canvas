import { ExperimentDesign } from "./types";

// Escape | and newlines inside table cells so the markdown table doesn't break.
function cell(v: string): string {
  const t = (v || "").trim();
  return t ? t.replace(/\|/g, "\\|").replace(/\n+/g, " ") : "—";
}

function or(v: string, fallback = "_[unspecified]_"): string {
  const t = (v || "").trim();
  return t ? t : fallback;
}

const DESIGN_LABEL: Record<string, string> = {
  within: "Within-subject",
  between: "Between-subject",
  mixed: "Mixed",
};

const CB_LABEL: Record<string, string> = {
  full: "Full counterbalancing",
  latin: "Latin square",
  none: "None",
};

export function buildMarkdown(d: ExperimentDesign): string {
  const lines: string[] = [];

  lines.push(`# What experiment do you want to conduct?`);
  lines.push(or(d.title));
  lines.push("");

  // 1. Research Questions
  lines.push(`# 1. Research Questions`);
  const rqs = d.researchQuestions.filter((q) => q.trim());
  if (rqs.length) {
    rqs.forEach((q, i) => lines.push(`*   RQ${i + 1}: ${q.trim()}`));
  } else {
    lines.push(`*   RQ1: _[unspecified]_`);
  }
  lines.push("");

  // 2. Variables
  lines.push(`# 2. Variables`);

  lines.push(`## 2.1 Dependent Variables (DVs) — what you measure`);
  lines.push(`| DV# | Name | Scale | Measurement Description |`);
  lines.push(`| --- | --- | --- | --- |`);
  d.dvs.forEach((r, i) =>
    lines.push(`| DV${i + 1} | ${cell(r.name)} | ${cell(r.scale)} | ${cell(r.measurement)} |`)
  );
  lines.push("");

  lines.push(`## 2.2 Independent Variables (IVs) — what you manipulate`);
  lines.push(`| IV# | Name | #lvls | Levels | Description |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  d.ivs.forEach((r, i) =>
    lines.push(
      `| IV${i + 1} | ${cell(r.name)} | ${cell(r.nLevels)} | ${cell(r.levels)} | ${cell(r.description)} |`
    )
  );
  lines.push("");

  lines.push(`## 2.3a Control Variables (CVs) — held constant`);
  lines.push(`| CV# | Name | #lvls | Level | Description / Rationale |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  d.cvs.forEach((r, i) =>
    lines.push(
      `| CV${i + 1} | ${cell(r.name)} | ${cell(r.nLevels)} | ${cell(r.level)} | ${cell(r.rationale)} |`
    )
  );
  lines.push("");

  lines.push(`## 2.3b Random Variables (RVs) — not controlled, may vary`);
  lines.push(`| RV# | Name | #lvls | Levels | Description / Rationale |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  d.rvs.forEach((r, i) =>
    lines.push(
      `| RV${i + 1} | ${cell(r.name)} | ${cell(r.nLevels)} | ${cell(r.levels)} | ${cell(r.rationale)} |`
    )
  );
  lines.push("");

  // 3. Study Design
  lines.push(`# 3. Study Design`);
  lines.push(`## 3.1 Design Type`);
  if (d.designType) {
    let dt = DESIGN_LABEL[d.designType];
    if (d.designType === "mixed" && d.designMixedSpec.trim()) {
      dt += ` — ${d.designMixedSpec.trim()}`;
    }
    lines.push(dt);
  } else {
    lines.push(`_[unspecified]_`);
  }
  lines.push("");
  lines.push(`## 3.2 Counterbalancing & Ordering`);
  {
    const cb = d.counterbalancing ? CB_LABEL[d.counterbalancing] : "";
    const notes = d.counterbalancingNotes.trim();
    if (cb || notes) {
      lines.push([cb, notes].filter(Boolean).join(". "));
    } else {
      lines.push(`_[unspecified]_`);
    }
  }
  lines.push("");

  // 4. Participants
  lines.push(`# 4. Participants`);
  {
    const p = d.participants;
    const parts: string[] = [];
    if (p.targetN.trim()) parts.push(`Target N: ${p.targetN.trim()}`);
    if (p.perGroupN.trim()) parts.push(`Per-group N: ${p.perGroupN.trim()}`);
    if (p.recruitment.trim()) parts.push(`Recruitment: ${p.recruitment.trim()}`);
    if (p.inclusionExclusion.trim())
      parts.push(`Inclusion/Exclusion: ${p.inclusionExclusion.trim()}`);
    if (p.consent.trim()) parts.push(`Consent: ${p.consent.trim()}`);
    if (p.compensation.trim()) parts.push(`Compensation: ${p.compensation.trim()}`);
    lines.push(parts.length ? parts.join("\n") : `_[unspecified]_`);
  }
  lines.push("");

  // 5. Apparatus & Materials
  lines.push(`# 5. Apparatus & Materials`);
  {
    const a = d.apparatus;
    const parts: string[] = [];
    if (a.hardware.trim()) parts.push(`Hardware: ${a.hardware.trim()}`);
    if (a.software.trim()) parts.push(`Software: ${a.software.trim()}`);
    if (a.stimulus.trim()) parts.push(`Stimulus / explanation materials: ${a.stimulus.trim()}`);
    if (a.questionnaires.trim()) parts.push(`Questionnaires: ${a.questionnaires.trim()}`);
    if (a.testMaterials.trim()) parts.push(`Test materials: ${a.testMaterials.trim()}`);
    lines.push(parts.length ? parts.join("\n") : `_[unspecified]_`);
  }
  lines.push("");

  // 6. Procedure
  lines.push(`# 6. Procedure`);
  const steps = d.procedure.steps.filter((s) => s.text.trim());
  if (steps.length) {
    steps.forEach((s, i) => {
      const dur = s.duration.trim() ? ` _(${s.duration.trim()})_` : "";
      lines.push(`${i + 1}.  ${s.text.trim()}${dur}`);
    });
  } else {
    lines.push(`1.  _[unspecified]_`);
  }
  if (d.procedure.totalDuration.trim()) {
    lines.push("");
    lines.push(`**Total estimated duration: ${d.procedure.totalDuration.trim()}**`);
  }
  lines.push("");

  // 7. Dataset & Agent
  lines.push(`# 7. Dataset & Agent`);
  lines.push(`## 7.1 Trial Configuration`);
  lines.push(or(d.trialConfig));
  lines.push("");
  lines.push(`## 7.2 Agent`);
  lines.push(or(d.agent));

  return lines.join("\n");
}
