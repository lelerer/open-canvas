// Wizard page model. Most pages ask one open question (kind "text"); two pages
// are custom forms (kind "studydesign", "dataset"). The collected answers are
// turned into the final templated document by the LLM.

export type Answers = Record<string, string>;

export type PageKind = "text" | "studydesign" | "apparatus" | "procedure" | "usermodel" | "review";

export interface Page {
  id: string;
  navTitle: string; // sidebar label
  section: string; // eyebrow
  kind: PageKind;
  prompt?: string; // for text pages
  hints?: string[];
  placeholder?: string;
  required?: boolean; // gates generation unless Advanced mode
}

// ---- Dropdown option lists (placeholders for now) ----
export const IV_OPTIONS = [
  "Explanation method (e.g., LIME vs SHAP)",
  "Explanation modality (visual vs textual)",
  "Explanation presence (with vs without)",
  "Model confidence display (shown vs hidden)",
  "Other / custom",
];

export const AGENT_OPTIONS = ["CoAX", "CoXAM"];

// ---- Datasets available to pick (plus user-uploaded CSVs at runtime) ----
export const DATASET_OPTIONS = [
  "Adult Income",
  "Mushroom",
  "Wine Quality",
  "Forest Cover",
  "Breast Cancer",
  "Heart Disease",
  "King County House",
  "Pima Diabetes",
  "Cardiotocography",
];

// ---- User models (cognitive models + ML proxies) ----
// NOTE: full names / descriptions below are placeholders — please replace with the
// authoritative text. Users can also add their own at runtime (stored locally).
export interface UserModel {
  id: string;
  name: string;
  full: string;
  description: string;
  category: string; // "Cognitive model" | "ML proxy" | "Custom"
}

// tolerant parse for a stored list of ids (JSON array or comma-separated)
export function parseIdList(raw: string | undefined): string[] {
  const s = (raw || "").trim();
  if (!s) return [];
  try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(String); } catch { /* csv */ }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export const USER_MODELS: UserModel[] = [
  { id: "CoAX", name: "CoAX", full: "CoAX — full name TBC", description: "Cognitive user model (please add a 1–2 line description).", category: "Cognitive model" },
  { id: "CoXAM", name: "CoXAM", full: "CoXAM — full name TBC", description: "Cognitive user model (please add a 1–2 line description).", category: "Cognitive model" },
  // ML proxies:
  { id: "KNN", name: "KNN", full: "k-Nearest Neighbours", description: "General ML proxy — applies to both CoAX and CoXAM.", category: "ML proxy" },
  { id: "Decision Tree", name: "Decision Tree", full: "Decision tree", description: "General ML proxy — applies to both CoAX and CoXAM.", category: "ML proxy" },
  { id: "MLP", name: "MLP", full: "Multi-layer perceptron", description: "ML proxy for CoAX.", category: "ML proxy" },
  { id: "Linear Regression", name: "Linear Regression", full: "Linear regression", description: "ML proxy for CoXAM — forward simulation.", category: "ML proxy" },
  { id: "Global SHAP", name: "Global SHAP", full: "Global SHAP", description: "ML proxy for CoXAM — counterfactual simulation.", category: "ML proxy" },
];

export const DESIGN_TYPES = ["Within-subjects", "Between-subjects", "Mixed"] as const;

export const BALANCING_METHODS = [
  "None",
  "Randomized order",
  "Full counterbalancing",
  "Latin square",
] as const;

// ---- IV catalog (levels depend on the model/framework) ----
export const IV_AGENTS = ["CoAX", "CoXAM", "Sim2Real"] as const;

export interface CognitiveParam {
  name: string;
  min: number;
  max: number;
  note?: string;
}

export type IvKind = "categorical" | "range" | "binary" | "cognitive";

export interface IvFactor {
  id: string;
  label: string;
  kind: IvKind;
  group?: string; // semantic grouping for the dropdown
  def?: string; // one-line definition (shown as a tooltip / under the select)
  agents?: string[]; // available only for these models (default: all)
  levels?: string[]; // categorical, same across models
  levelsByAgent?: Record<string, string[]>;
  range?: { min: number; max: number };
  binary?: [string, string];
  cognitiveByAgent?: Record<string, CognitiveParam[]>;
  note?: string;
}

export const IV_GROUP_ORDER = ["Explanation (XAI)", "Data & Model", "User Model", "Task", "Custom"];

export const IV_CATALOG: IvFactor[] = [
  {
    id: "xai_type",
    label: "XAI Type",
    kind: "categorical",
    group: "Explanation (XAI)",
    def: "The category/family of explanation shown to the user.",
    agents: ["CoAX", "CoXAM"],
    levelsByAgent: {
      CoAX: ["None", "Attribution", "Importance"],
      CoXAM: ["Decision Tree", "Logistic Regression", "Hybrid"],
    },
  },
  {
    id: "xai_method",
    label: "XAI Method",
    kind: "categorical",
    group: "Explanation (XAI)",
    def: "The specific algorithm used to generate the explanation.",
    agents: ["CoAX", "CoXAM"],
    levelsByAgent: {
      CoAX: ["LIME", "SHAP", "Integrated Gradients", "Input Gradients (paper)", "Layer-wise Relevance Propagation", "Captum DeepLift"],
      CoXAM: ["Decision Tree", "Logistic Regression Weights (paper)", "Decision List", "Interpretable Decision Sets"],
    },
  },
  { id: "faithfulness", label: "Faithfulness (XAI Fidelity)", kind: "range", group: "Explanation (XAI)", def: "How well the explanation reflects the AI's actual reasoning.", range: { min: 0, max: 100 }, note: "Usually controlled at 80%." },
  { id: "robustness", label: "Robustness", kind: "binary", group: "Explanation (XAI)", def: "Whether the explanation stays stable under small input changes.", binary: ["Robust", "Not robust"] },
  { id: "sparsity", label: "Sparsity", kind: "binary", group: "Explanation (XAI)", def: "Whether the explanation highlights few features (sparse) or many.", binary: ["Sparse", "Not sparse"] },
  { id: "tested_xai", label: "Tested with XAI", kind: "binary", group: "Explanation (XAI)", def: "Whether a trial shows an explanation or not.", binary: ["With XAI", "Without XAI"], note: "Trial-level randomized, within-subjects." },

  { id: "num_attributes", label: "Number of Attributes", kind: "range", group: "Data & Model", def: "How many input features are shown for each instance.", range: { min: 1, max: 10 } },
  { id: "num_training", label: "Number of Training Instances", kind: "range", group: "Data & Model", def: "How many labelled examples are seen before testing.", range: { min: 1, max: 14 }, note: "CoAX default 10; test set 18." },
  {
    id: "dataset",
    label: "Dataset",
    kind: "categorical",
    group: "Data & Model",
    def: "Which dataset the task instances are drawn from.",
    levelsByAgent: {
      CoAX: ["Adult Income (CoAX only)", "Wine Quality", "Forest Cover"],
      CoXAM: ["Mushroom (CoXAM only)", "Wine Quality", "Forest Cover"],
      Sim2Real: ["Wine Quality", "Forest Cover"],
    },
    note: "Untested: Breast Cancer, Heart Disease, King County House, Pima Diabetes, Cardiotocography.",
  },
  { id: "ai_model", label: "AI Model", kind: "categorical", group: "Data & Model", def: "The underlying predictive model being explained.", levels: ["MLP", "XGBoost"], note: "Usually controlled by dataset." },

  {
    id: "cognitive",
    label: "Cognitive Parameters",
    kind: "cognitive",
    group: "User Model",
    def: "Parameters of the cognitive user model (memory, attention, etc.).",
    cognitiveByAgent: {
      CoAX: [
        { name: "Retrieval Threshold", min: -2.3, max: -1.5, note: "Memory capacity; higher = harder retrieval / more forgetting." },
        { name: "Exemplar Distance Sensitivity", min: 1, max: 10, note: "How strongly distance affects similarity." },
        { name: "Attended Features", min: 1, max: 5, note: "Attention span — features attended when comparing exemplars." },
        { name: "Feature-Class Sensitivity", min: 1, max: 7, note: "How strongly attribution maps to classes." },
      ],
      CoXAM: [
        { name: "Retrieval Threshold", min: -2.8, max: -1.5, note: "How easily info is retrieved from memory." },
        { name: "Opportunity Cost", min: 0, max: 10, note: "Accuracy-time tradeoff (computational rationality / RL)." },
        { name: "Diffusion Noise", min: 0, max: 1, note: "Stochasticity during forward simulation." },
        { name: "Counterfactual Margin", min: 0, max: 1, note: "Margin when evaluating counterfactual changes." },
      ],
      Sim2Real: [
        { name: "Memory / cognitive budget", min: 0, max: 0, note: "Top-2 features vs all features." },
      ],
    },
  },

  {
    id: "user_task",
    label: "User Task",
    kind: "categorical",
    group: "Task",
    def: "What the user is asked to do (e.g. forward vs counterfactual simulation).",
    levelsByAgent: {
      CoAX: ["Forward simulation"],
      CoXAM: ["Forward simulation", "Counterfactual simulation"],
      Sim2Real: ["Forward simulation"],
    },
    note: "Forbidden feature is not supported by CoAX/CoXAM; Counterfactual simulation is CoXAM only.",
  },
];

export function ivFactorsForAgent(agent: string): IvFactor[] {
  return IV_CATALOG.filter((f) => !f.agents || f.agents.includes(agent));
}

export function ivLevelsFor(f: IvFactor, agent: string): string[] {
  if (f.levelsByAgent && f.levelsByAgent[agent]) return f.levelsByAgent[agent];
  return f.levels ?? [];
}

// ---- DV / CV / RV variables, each with a user-defined (custom) type ----
export interface Variable {
  name: string;
  type: string; // fully custom / user-defined
}

export function parseVars(raw: string | undefined): Variable[] {
  const s = (raw || "").trim();
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) return arr as Variable[];
  } catch {
    /* legacy free text */
  }
  return [{ name: s, type: "" }];
}

export function varsSummary(vs: Variable[]): string {
  return vs
    .filter((v) => (v.name || "").trim())
    .map((v) => ((v.type || "").trim() ? `${v.name} (${v.type})` : v.name))
    .join(", ");
}

// ---- Dependent variables: a catalog of measures + custom (user-supplied formula) ----
export interface DvMeasure {
  id: string;
  label: string;
  group: string;
  def: string;
}

export const DV_GROUP_ORDER = ["Behavioural", "Subjective", "Understanding", "Custom"];

// NOTE: this list is a sensible default — edit to match what the toolkit actually computes.
export const DV_CATALOG: DvMeasure[] = [
  { id: "task_accuracy", label: "Task Accuracy", group: "Behavioural", def: "Proportion of correct decisions." },
  { id: "decision_time", label: "Decision Time", group: "Behavioural", def: "Time taken per decision (seconds)." },
  { id: "appropriate_reliance", label: "Appropriate Reliance", group: "Behavioural", def: "Following the AI when it's right, overriding when it's wrong." },
  { id: "agreement_rate", label: "Agreement Rate", group: "Behavioural", def: "How often the user agrees with the AI." },
  { id: "trust", label: "Trust", group: "Subjective", def: "Self-reported trust (e.g. Likert)." },
  { id: "confidence", label: "Confidence", group: "Subjective", def: "Self-reported confidence in decisions." },
  { id: "workload", label: "Mental Workload (NASA-TLX)", group: "Subjective", def: "Perceived cognitive load." },
  { id: "satisfaction", label: "Satisfaction / Preference", group: "Subjective", def: "Self-reported satisfaction or preference." },
  { id: "forward_sim", label: "Forward-Simulation Accuracy", group: "Understanding", def: "How well the user predicts the AI's output." },
  { id: "counterfactual_sim", label: "Counterfactual-Simulation Accuracy", group: "Understanding", def: "Predicting the AI's output under changes." },
  { id: "comprehension", label: "Comprehension Score", group: "Understanding", def: "Objective measure of understanding." },
];

export interface DvEntry {
  measure: string; // DV_CATALOG id, or "custom"
  name: string; // display name (auto for catalog, user-typed for custom)
  formula?: string; // precise calculation (required for custom; optional override otherwise)
  unit?: string;
}

export function dvLabel(id: string): string {
  return DV_CATALOG.find((d) => d.id === id)?.label ?? "";
}

export function parseDvs(raw: string | undefined): DvEntry[] {
  const s = (raw || "").trim();
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) {
      return arr.map((e: any) => {
        if (e && typeof e === "object" && "measure" in e) return e as DvEntry;
        // legacy Variable {name,type} → custom DV
        if (e && typeof e === "object" && "name" in e) return { measure: "custom", name: e.name, formula: "", unit: e.type } as DvEntry;
        return { measure: "custom", name: String(e), formula: "" } as DvEntry;
      });
    }
  } catch {
    /* legacy free text */
  }
  return [{ measure: "custom", name: s, formula: "" }];
}

export function dvDisplayName(e: DvEntry): string {
  return e.measure === "custom" ? (e.name || "") : (dvLabel(e.measure) || e.name || "");
}

export function dvSummary(dvs: DvEntry[]): string {
  return dvs
    .map((e) => dvDisplayName(e))
    .filter((n) => n.trim())
    .join(", ");
}

// ---- Multiple IVs (factorial), each with its own within/between allocation ----
export const ALLOC_OPTIONS = ["Within-subjects", "Between-subjects"] as const;

export interface IvEntry {
  factor: string; // factor id from IV_CATALOG
  label: string;
  levels: string; // "A | B" (categorical), "A vs B" (binary), or "min–max" (range/cognitive)
  cogParam?: string;
  min?: string;
  max?: string;
  alloc: string; // "Within-subjects" | "Between-subjects"
  balancing?: string; // counterbalancing for THIS IV (only meaningful for within-subjects)
}

export function parseIvs(a: Answers): IvEntry[] {
  try {
    const arr = JSON.parse(a.sd_ivs || "[]");
    return Array.isArray(arr) ? (arr as IvEntry[]) : [];
  } catch {
    return [];
  }
}

// Number of levels (cells contributed) for one IV.
export function ivCellCount(e: IvEntry): number {
  const lv = (e.levels || "").trim();
  if (!lv) return 1;
  if (lv.includes(" vs ")) return 2;
  if (lv.includes(" | ")) return lv.split(" | ").filter(Boolean).length || 1;
  return 1; // range / cognitive / single value
}

export function totalCells(ivs: IvEntry[]): number {
  return ivs.reduce((n, e) => n * Math.max(1, ivCellCount(e)), 1);
}

// Participants are split only across the between-subjects cells.
export function betweenCells(ivs: IvEntry[]): number {
  return ivs.filter((e) => e.alloc === "Between-subjects").reduce((n, e) => n * Math.max(1, ivCellCount(e)), 1);
}

export function designDescriptor(ivs: IvEntry[]): string {
  if (!ivs.length) return "";
  const allocs = new Set(ivs.map((e) => e.alloc));
  if (allocs.size > 1) return "mixed";
  return allocs.has("Between-subjects") ? "between-subjects" : "within-subjects";
}

// ---- Build IvEntry objects from loose chat specs (so the assistant can fill IVs) ----
export function findIvFactor(idOrLabel: string): IvFactor | null {
  const q = (idOrLabel || "").trim().toLowerCase();
  if (!q) return null;
  return (
    IV_CATALOG.find((f) => f.id.toLowerCase() === q || f.label.toLowerCase() === q) ||
    // looser contains-match as a fallback (e.g. "method" → "XAI Method")
    IV_CATALOG.find((f) => f.label.toLowerCase().includes(q) || q.includes(f.label.toLowerCase())) ||
    null
  );
}

// A spec looks like: { factor, levels?, min?, max?, cogParam?, alloc?, balancing? }
export function ivEntryFromSpec(spec: any, agent: string): IvEntry | null {
  if (!spec || typeof spec !== "object") return null;
  const alloc = ALLOC_OPTIONS.includes(spec.alloc) ? spec.alloc : "Within-subjects";
  const balancing = alloc === "Within-subjects" && typeof spec.balancing === "string" ? spec.balancing : "";
  const f = findIvFactor(spec.factor || spec.label || spec.id || "");

  // Unknown factor → custom categorical from the provided levels.
  if (!f) {
    const name = String(spec.factor || spec.label || "").trim();
    if (!name) return null;
    const lvls = Array.isArray(spec.levels) ? spec.levels.map((x: any) => String(x).trim()).filter(Boolean) : [];
    return { factor: `custom:${name}`, label: name, levels: lvls.join(" | "), alloc, balancing };
  }

  if (f.kind === "binary" && f.binary) {
    return { factor: f.id, label: f.label, levels: `${f.binary[0]} vs ${f.binary[1]}`, alloc, balancing };
  }

  if (f.kind === "range") {
    const arr = Array.isArray(spec.levels) ? spec.levels : [];
    const min = spec.min ?? arr[0];
    const max = spec.max ?? arr[1];
    const minS = min != null && min !== "" ? String(min) : "";
    const maxS = max != null && max !== "" ? String(max) : "";
    const levels = minS || maxS ? `${minS || "?"}\u2013${maxS || "?"}` : "";
    return { factor: f.id, label: f.label, levels, min: minS, max: maxS, alloc, balancing };
  }

  if (f.kind === "cognitive") {
    const params = (f.cognitiveByAgent && f.cognitiveByAgent[agent]) || [];
    const wanted = String(spec.cogParam || spec.param || "").trim().toLowerCase();
    const cp = params.find((p) => p.name.toLowerCase() === wanted) || params.find((p) => p.name.toLowerCase().includes(wanted) && wanted) || null;
    const cogParam = cp ? cp.name : "";
    const min = spec.min ?? "";
    const max = spec.max ?? "";
    const minS = min !== "" && min != null ? String(min) : "";
    const maxS = max !== "" && max != null ? String(max) : "";
    const levels = minS || maxS ? `${minS || "?"}\u2013${maxS || "?"}` : "";
    return { factor: f.id, label: cogParam ? `Cognitive: ${cogParam}` : f.label, levels, cogParam, min: minS, max: maxS, alloc, balancing };
  }

  // categorical: keep only valid levels (normalising case), else fall back to provided.
  const valid = ivLevelsFor(f, agent);
  const provided = Array.isArray(spec.levels) ? spec.levels.map((x: any) => String(x).trim()).filter(Boolean) : [];
  const matched = provided
    .map((l) => valid.find((v) => v.toLowerCase() === l.toLowerCase()) || null)
    .filter((v): v is string => !!v);
  const use = matched.length ? matched : provided;
  return { factor: f.id, label: f.label, levels: use.join(" | "), alloc, balancing };
}

export function normalizeIvSpecs(specs: any, agent: string): IvEntry[] {
  if (!Array.isArray(specs)) return [];
  return specs.map((s) => ivEntryFromSpec(s, agent)).filter((e): e is IvEntry => !!e);
}

// DV specs from chat: { measure?: catalog id/label or "custom", name?, formula?, unit? }
export function normalizeDvSpecs(specs: any): DvEntry[] {
  if (!Array.isArray(specs)) return [];
  return specs
    .map((s): DvEntry | null => {
      if (typeof s === "string") {
        const n = s.trim();
        return n ? { measure: "custom", name: n, formula: "" } : null;
      }
      if (!s || typeof s !== "object") return null;
      const key = String(s.measure ?? s.id ?? "").trim().toLowerCase();
      const cat = DV_CATALOG.find((d) => d.id.toLowerCase() === key || d.label.toLowerCase() === key);
      if (cat) return { measure: cat.id, name: "", formula: String(s.formula ?? "") };
      // also try matching by name against catalog
      const nameKey = String(s.name ?? "").trim().toLowerCase();
      const catByName = DV_CATALOG.find((d) => d.label.toLowerCase() === nameKey);
      if (catByName && !s.formula) return { measure: catByName.id, name: "", formula: "" };
      const name = String(s.name ?? s.measure ?? "").trim();
      if (!name && !String(s.formula ?? "").trim()) return null;
      return { measure: "custom", name, formula: String(s.formula ?? ""), unit: s.unit ? String(s.unit) : undefined };
    })
    .filter((e): e is DvEntry => !!e);
}

// CV / RV specs from chat: { name, type? } | "name"
export function normalizeVarSpecs(specs: any): Variable[] {
  if (!Array.isArray(specs)) return [];
  return specs
    .map((s): Variable | null => {
      if (typeof s === "string") {
        const n = s.trim();
        return n ? { name: n, type: "" } : null;
      }
      if (!s || typeof s !== "object") return null;
      const name = String(s.name ?? "").trim();
      if (!name) return null;
      return { name, type: String(s.type ?? "").trim() };
    })
    .filter((v): v is Variable => !!v);
}

// Procedure step specs from chat: { title, note?, link?, attachment? } | "title"
export function normalizeProcSpecs(specs: any): ProcStep[] {
  if (!Array.isArray(specs)) return [];
  return specs
    .map((s): ProcStep | null => {
      if (typeof s === "string") {
        const t = s.trim();
        return t ? { title: t } : null;
      }
      if (!s || typeof s !== "object") return null;
      const title = String(s.title ?? "").trim();
      if (!title) return null;
      const out: ProcStep = { title };
      if (s.note) out.note = String(s.note);
      if (s.link) out.link = String(s.link);
      if (s.attachment) out.attachment = String(s.attachment);
      return out;
    })
    .filter((p): p is ProcStep => !!p);
}

export const PAGES: Page[] = [
  {
    id: "rq",
    navTitle: "Research Questions",
    section: "Section 1",
    kind: "text",
    prompt: "What are your research questions?",
    hints: ["A rough direction is fine to start — the assistant can help shape it.", "List them as RQ1, RQ2, RQ3…", "Each should be clear and testable."],
    placeholder: "RQ1: …\nRQ2: …",
    required: true,
  },
  {
    id: "studydesign",
    navTitle: "Study Design",
    section: "Section 2",
    kind: "studydesign",
    required: true,
  },
  {
    id: "apparatus",
    navTitle: "Apparatus",
    section: "Section 3",
    kind: "apparatus",
    prompt: "What apparatus and materials will you use?",
    hints: ["Devices, displays, software / toolkit.", "Paste a link to your study / formative-study build to preview it here."],
  },
  {
    id: "procedure",
    navTitle: "Procedure",
    section: "Section 4",
    kind: "procedure",
    prompt: "Build the procedure, step by step.",
    hints: ["Each step is one thing the participant does.", "Attach a consent form or questionnaire to a step if needed."],
  },
  {
    id: "usermodel",
    navTitle: "User Model",
    section: "Section 5",
    kind: "usermodel",
    required: true,
  },
  {
    id: "review",
    navTitle: "Review & Export",
    section: "Final",
    kind: "review",
  },
];

// ---- Completeness ----
export function isPageComplete(page: Page, a: Answers): boolean {
  const has = (k: string) => (a[k] || "").trim().length > 0;
  if (page.kind === "text") return has(page.id);
  if (page.kind === "studydesign") {
    const ivs = parseIvs(a);
    const ivOk = ivs.length > 0 && ivs.every((e) => e.factor && (e.levels || "").trim());
    const dvOk = parseDvs(a.sd_dv).some((e) => dvDisplayName(e).trim());
    return dvOk && ivOk && has("sd_participants");
  }
  if (page.kind === "apparatus") return has("apparatus") || has("apparatus_url");
  if (page.kind === "procedure") return parseProcSteps(a.proc_steps).some((s) => (s.title || "").trim());
  if (page.kind === "usermodel") return has("user_model");
  return true; // review or unknown
}

// ---- Procedure: ordered steps, each optionally carrying an attachment ----
// Suggested step titles (the title field is a combobox: pick one or type your own).
export const PROC_STEP_TYPES = ["Welcome & consent", "Demographics questionnaire", "Training / practice", "Main task", "Post-task questionnaire", "Break", "Debrief"];

export interface ProcStep {
  title: string;
  attachment?: string; // uploaded file name (consent form, questionnaire, …)
  link?: string; // or an external link
  note?: string;
}

export function parseProcSteps(raw: string | undefined): ProcStep[] {
  const s = (raw || "").trim();
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) return arr as ProcStep[];
  } catch {
    /* legacy free text → one step per non-empty line */
    return s.split("\n").map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean).map((title) => ({ title }));
  }
  return [];
}

export function procStepsSummary(steps: ProcStep[]): string[] {
  return steps
    .filter((s) => (s.title || "").trim())
    .map((s, i) => {
      const bits = [s.title, (s.note || "").trim() ? `— ${s.note}` : "", s.attachment ? `(file: ${s.attachment})` : "", s.link ? `(link: ${s.link})` : ""].filter(Boolean);
      return `${i + 1}. ${bits.join(" ")}`;
    });
}

// ---- Participant-vs-design sanity check ----
export function validateParticipants(
  a: Answers
): { level: "ok" | "warn" | "info"; message: string } | null {
  const ivs = parseIvs(a);
  const per = parseInt(a.sd_participants || "", 10);
  if (!ivs.length || !a.sd_participants) return null;
  if (!Number.isFinite(per) || per <= 0) return { level: "warn", message: "Enter participants per condition as a number." };

  const cells = totalCells(ivs);
  const between = betweenCells(ivs);
  const total = per * between;
  const hasWithin = ivs.some((e) => e.alloc === "Within-subjects");

  if (between > 1) {
    return { level: "ok", message: `${per} per condition × ${between} between-subjects group(s) = ${total} participants${hasWithin ? ", each also completing all within-subjects cells" : ""} (design has ${cells} cell(s) total).` };
  }
  return { level: "ok", message: `${per} participants, each completing all ${cells} cell(s) = ${total} total.` };
}

function factorial(k: number): number {
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
}

// ---- Transcript for the generator ----
export function buildTranscript(a: Answers): string {
  const v = (k: string) => (a[k] || "").trim();
  const blocks: string[] = [];

  blocks.push(`Overview\n${v("overview") || "(none)"}`);
  blocks.push(`Research Questions\n${v("rq") || "(none)"}`);

  const ivAgent = v("sd_iv_agent") || v("ds_agent");
  const iv = v("sd_iv");
  const sd = [
    `Dependent variable(s) (measured): ${v("sd_dv") || "(none)"}`,
    `Model/framework context: ${ivAgent || "(none)"}`,
    `Independent variable (manipulated): ${iv || "(none)"}`,
    `IV levels / range: ${v("sd_iv_levels") || "(none)"}`,
    `Number of conditions/cells: ${v("sd_conditions") || "(none)"}`,
    `Control variables: ${v("sd_cv") || "(none)"}`,
    `Design type: ${v("sd_design") || "(none)"}`,
    `Counterbalancing: ${v("sd_balancing") || "(none)"}`,
    `Participants (total N): ${v("sd_participants") || "(none)"}`,
  ].join("\n");
  blocks.push(`Study Design, Variables & Participants\n${sd}`);

  const ds = [
    `Agent under evaluation: ${v("ds_agent") || "(none)"}`,
    `Dataset / trial configuration: ${v("ds_dataset") || "(none)"}`,
  ].join("\n");
  blocks.push(`Dataset & Agent\n${ds}`);

  return blocks.join("\n\n");
}
