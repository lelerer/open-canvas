// Wizard page model. Most pages ask one open question (kind "text"); two pages
// are custom forms (kind "studydesign", "dataset"). The collected answers are
// turned into the final templated document by the LLM.

export type Answers = Record<string, string>;

export type PageKind = "text" | "studydesign" | "apparatus" | "procedure" | "usermodel" | "review" | "results";

export interface Page {
  id: string;
  navTitle: string; // sidebar label
  section: string; // eyebrow
  kind: PageKind;
  prompt?: string; // for text pages
  subtitle?: string; // one-paragraph "why this matters / what it means"
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
];

// ---- User models (cognitive models) ----
// NOTE: full names / descriptions below are placeholders — please replace with the
// authoritative text.
export interface UserModel {
  id: string;
  name: string;
  full: string;
  description: string;
  category: string; // "Cognitive model"
}

// tolerant parse for a stored list of ids (JSON array or comma-separated)
export function parseIdList(raw: string | undefined): string[] {
  const s = (raw || "").trim();
  if (!s) return [];
  try { const a = JSON.parse(s); if (Array.isArray(a)) return a.map(String); } catch { /* csv */ }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

// The CoAX variant for XAI-Property designs. It runs on the Sim2Real
// synthetic-AI interface, so it resolves to the "Sim2Real" IV/cognitive agent.
export const COAX_XAI_PROPERTY = "CoAX (XAI Property)";

export const USER_MODELS: UserModel[] = [
  { id: "CoAX", name: "CoAX", full: "Interpreting Attribution XAI", description: "A cognitive user model of how people interpret attribution-based explanations (e.g. LIME / SHAP feature attributions).", category: "Cognitive model" },
  { id: COAX_XAI_PROPERTY, name: "Sim2Real", full: "Interpreting XAI with Different Properties", description: "The CoAX model for XAI-Property designs — how people interpret explanations that are faithful, sparse, robust or sparse_robust. Runs on the Sim2Real synthetic-AI interface.", category: "Cognitive model" },
  { id: "CoXAM", name: "CoXAM", full: "Interpreting Global XAI (Rules vs Weights)", description: "A cognitive user model of how people interpret global surrogate explanations — decision-tree rules vs logistic-regression weights.", category: "Cognitive model" },
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

export type CogParamType = "float" | "integer" | "enum";

export interface CognitiveParam {
  name: string; // display label — also the key used inside cog_config
  key?: string; // backend parameter name (e.g. "max_features_attended"); derived from `name` when absent
  type?: CogParamType; // default "float"
  min?: number; // numeric types only
  max?: number;
  step?: number; // input granularity for numeric types
  options?: string[]; // enum only
  default?: string | number; // recommended starting value (what the wizard suggests)
  modelDefault?: string | number; // what the model itself uses when left blank
  softBounds?: boolean; // the backend accepts any value — min/max is an advisory window
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
  unsupportedAgents?: string[]; // models that cannot manipulate this IV at all (shown, but flagged)
  hidden?: boolean; // kept in the catalog (legacy saves still parse) but not offered in the IV dropdown
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
    // Always offered as an IV; Sim2Real designs can't manipulate it, which is
    // flagged as a warning in the editor rather than hidden from the dropdown.
    unsupportedAgents: ["Sim2Real"],
    // CoAX supports only the local family; CoXAM supports all six.
    levelsByAgent: {
      CoAX: ["None", "Attribution", "Importance"],
      CoXAM: ["None", "Attribution", "Importance", "Decision Tree", "Logistic Regression", "Hybrid"],
    },
  },
  {
    id: "xai_method",
    label: "XAI Method",
    kind: "categorical",
    group: "Explanation (XAI)",
    def: "The specific algorithm used to generate the explanation.",
    hidden: true, // removed from the IV dropdown; kept so older saved designs still parse
    agents: ["CoAX", "CoXAM"],
    // Always the same six methods; the IV itself is only supported by CoAX.
    levels: ["LIME", "SHAP", "Integrated Gradients", "Input Gradients (paper)", "Layer-wise Relevance Propagation", "Captum DeepLift"],
    unsupportedAgents: ["CoXAM"],
  },
  {
    id: "xai_property",
    label: "XAI Property",
    kind: "categorical",
    group: "Explanation (XAI)",
    def: "Which property the explanation satisfies — faithful, sparse, robust, or sparse_robust. Runs on the Sim2Real synthetic-AI interface (exclusive: no other IVs).",
    levels: ["faithful", "sparse", "robust", "sparse_robust"],
  },
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
      CoAX: ["Adult Income", "Wine Quality", "Forest Cover"],
      CoXAM: ["Adult Income", "Mushroom (CoXAM only)", "Wine Quality", "Forest Cover"],
      Sim2Real: ["Adult Income"],
    },
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
        { name: "Retrieval Threshold", min: -4.0, max: -0.97, note: "Memory capacity; higher = harder retrieval / more forgetting." },
        { name: "Exemplar Distance Sensitivity", min: 1, max: 20, note: "How sensitive the virtual participant is to similarity between instances — higher = it relies only on the most similar past examples when judging a new one." },
        { name: "Attended Features", min: 1, max: 5, note: "How many features the virtual participant is able to pay attention to when comparing instances." },
        { name: "Feature-Class Sensitivity", min: 1, max: 8, note: "How strongly the shown feature attributions pull the virtual participant's prediction toward a class — higher = it follows the explanation more literally." },
      ],
      CoXAM: [
        // The valid range depends on the user task, so the field spans both; the
        // note carries the per-task window and default.
        { name: "Retrieval Threshold", key: "memory_recall_threshold", type: "float", min: -2.0, max: 2.0, step: 0.05, note: "How easily info is retrieved from memory. Valid range depends on the task — forward simulation: -1.0 to 2.0 (default 0.5); counterfactual simulation: -2.0 to 0.5 (default -0.75)." },
        { name: "Opportunity Cost", key: "opportunity_cost", type: "float", min: 0.0, max: 0.02, step: 0.001, default: 0.01, note: "Accuracy-time tradeoff (computational rationality / RL). Forward simulation only." },
        { name: "Diffusion Noise", key: "decision_noise", type: "float", min: 0.3, max: 0.7, step: 0.01, default: 0.4, note: "Stochasticity during forward simulation. Forward simulation only." },
        { name: "Counterfactual Margin", key: "counterfactual_overshoot_fraction", type: "float", min: 0.0, max: 0.5, step: 0.01, default: 0.25, note: "Margin when evaluating counterfactual changes. Counterfactual simulation only." },
      ],
      // CoAX (XAI Property) — the Sim2Real synthetic-AI study.
      Sim2Real: [
        {
          name: "Max Features Attended",
          key: "max_features_attended",
          type: "integer",
          min: 1,
          max: 12,
          step: 1,
          default: 4,
          modelDefault: 12,
          note: "How many explanation features the simulated user attends to. The model itself defaults to all 12; 4 is the value that best matches the measured behaviour.",
        },
        {
          name: "Aggregation Strategy",
          key: "aggregation_strategy",
          type: "enum",
          options: ["attribution", "value_weighted"],
          default: "value_weighted",
          modelDefault: "attribution",
          note: "How evidence from the attended features is combined into a decision.",
        },
        {
          name: "Confidence Responsiveness",
          key: "confidence_responsiveness",
          type: "float",
          min: -3.0,
          max: 1.0,
          step: 0.1,
          default: -1.5,
          modelDefault: 0.0,
          softBounds: true,
          note: "Applies to all aggregation strategies. Lower = more responsive to the change. The backend accepts any float; −3.0 to 1.0 is the evidence-supported window, with the optimum at −1.5 (flat between −2.0 and −1.0), which is most accurate to the measured effect.",
        },
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
  return IV_CATALOG.filter((f) => !f.hidden && (!f.agents || f.agents.includes(agent)));
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

// Only the measures the toolkit actually supports.
export const DV_CATALOG: DvMeasure[] = [
  { id: "forward_sim", label: "Forward-Simulation Accuracy", group: "Understanding", def: "How well the user predicts the AI's output." },
  { id: "counterfactual_sim", label: "Counterfactual-Simulation Accuracy", group: "Understanding", def: "Predicting the AI's output under changes." },
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

// XAI Property is an exclusive IV: when manipulated, the study runs on the
// Sim2Real interface and no other IV may be combined with it.
export function hasXaiPropertyIv(a: Answers): boolean {
  return parseIvs(a).some((e) => e.factor === "xai_property");
}

// XAI Property designs only run on Sim2Real — CoAX and CoXAM can't simulate
// across different XAI properties. Returns the conflict message for the
// current user model, or "" when there's no conflict.
export function xaiPropertyModelConflict(a: Answers): string {
  if (!hasXaiPropertyIv(a)) return "";
  const agent = cognitiveAgentFor(a.user_model);
  return agent === "CoAX" || agent === "CoXAM" ? `${agent} cannot handle simulations for different XAI Properties` : "";
}

// CoAX and CoXAM support different levels for some IVs (XAI Type, XAI Method,
// User Task). Returns the selected levels of an IV entry that the given
// model/framework does NOT support, so the UI can flag the mismatch.
const AGENT_CHECKED_FACTORS = new Set(["xai_type", "xai_method", "user_task", "dataset"]);
// "Mushroom (CoXAM only)" and "Mushroom" are the same level — the parenthetical
// suffixes on catalog entries are display-only.
const normalizeLevel = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
export function unsupportedIvLevels(e: IvEntry, agent: string): string[] {
  if (!AGENT_CHECKED_FACTORS.has(e.factor)) return [];
  const f = IV_CATALOG.find((x) => x.id === e.factor);
  if (!f || !f.levelsByAgent) return [];
  const supported = ivLevelsFor(f, agent).map(normalizeLevel);
  if (!supported.length) return [];
  return ivLevelList(e).filter((l) => !supported.includes(normalizeLevel(l)));
}

// Whether the given model cannot manipulate this IV at all (e.g. XAI Method is
// CoAX-only — CoXAM has no method variants to compare).
export function ivFactorUnsupportedByAgent(e: IvEntry, agent: string): boolean {
  const f = IV_CATALOG.find((x) => x.id === e.factor);
  return !!f?.unsupportedAgents?.includes(agent);
}

// ---- Toolkit capability constraints (flagged as warnings in the UI) ----
// DV measures a model/framework cannot produce: CoAX has no counterfactual
// simulation; Sim2Real (XAI Property) has no forward-simulation accuracy.
const DV_UNSUPPORTED_BY_AGENT: Record<string, string[]> = {
  CoAX: ["counterfactual_sim"],
  Sim2Real: ["forward_sim"],
};
export function dvUnsupportedByAgent(measure: string, agent: string): boolean {
  return (DV_UNSUPPORTED_BY_AGENT[agent] ?? []).includes(measure);
}

// Whether a dataset pick is outside what the model/framework supports, per the
// Dataset IV catalog (e.g. Mushroom is CoXAM-only; Sim2Real uses Adult Income).
export function datasetUnsupportedByAgent(dataset: string, agent: string): boolean {
  const f = IV_CATALOG.find((x) => x.id === "dataset");
  const supported = (f?.levelsByAgent?.[agent] ?? []).map(normalizeLevel);
  return supported.length > 0 && !supported.includes(normalizeLevel(dataset));
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
    const lvls = Array.isArray(spec.levels) ? spec.levels.map((x: any) => String(x).trim()).filter(Boolean) : [];
    return { factor: f.id, label: f.label, levels: lvls.join(" | "), alloc, balancing };
  }

  if (f.kind === "cognitive") {
    const params = (f.cognitiveByAgent && f.cognitiveByAgent[agent]) || [];
    const wanted = String(spec.cogParam || spec.param || "").trim().toLowerCase();
    const cp = params.find((p) => p.name.toLowerCase() === wanted) || params.find((p) => p.name.toLowerCase().includes(wanted) && wanted) || null;
    const cogParam = cp ? cp.name : "";
    const lvls = Array.isArray(spec.levels) ? spec.levels.map((x: any) => String(x).trim()).filter(Boolean) : [];
    return { factor: f.id, label: cogParam ? `Cognitive: ${cogParam}` : f.label, levels: lvls.join(" | "), cogParam, alloc, balancing };
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

// Each factor may be used by at most ONE IV (a duplicate "Dataset" IV is a design
// error). Cognitive Parameters are keyed per parameter — two cognitive IVs are fine
// as long as they manipulate different parameters. Keeps the first occurrence.
export function dedupeIvEntries(list: IvEntry[]): IvEntry[] {
  const seen = new Set<string>();
  const out: IvEntry[] = [];
  for (const e of list) {
    const key = e.factor === "cognitive" ? `cognitive:${(e.cogParam || "").toLowerCase()}` : e.factor;
    if (e.factor && seen.has(key)) continue;
    if (e.factor) seen.add(key);
    out.push(e);
  }
  return out;
}

export function normalizeIvSpecs(specs: any, agent: string): IvEntry[] {
  if (!Array.isArray(specs)) return [];
  return dedupeIvEntries(specs.map((s) => ivEntryFromSpec(s, agent)).filter((e): e is IvEntry => !!e));
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
    subtitle: "Everything else in this tool exists to answer these questions — the variables you measure, the conditions you compare, and the task participants do. Writing them down first keeps the rest of the design focused. A good research question names what you're comparing and what outcome you expect it to change (e.g. \"Does showing feature-attribution explanations improve people's ability to catch the AI's mistakes, compared to no explanation?\").",
    hints: ["A rough direction is fine to start — the assistant can help you sharpen it into a testable question.", "Number them RQ1, RQ2, … so you can refer back to them later.", "Testable = you could imagine a result that would answer it yes or no."],
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
    prompt: "What will participants actually use?",
    subtitle: "\"Apparatus\" is the concrete setup a participant sits down to — the device and the software they interact with. \"Materials\" are the things you present to them (the interface, task instructions, questionnaires). The point of this page is reproducibility: enough detail that another researcher could rebuild your setup, and a live preview so you can confirm participants will see what you intend. You don't need to be a programmer — if your study runs in a browser, just paste its link.",
    hints: ["Add one configuration per participant group. For a between-subjects study, that's usually one per condition (e.g. one for each explanation type).", "Each configuration can use our built-in interface (customize the parameters) or your own (drop a URL).", "Assign each to a group with \"Used by\" — pick an IV level (e.g. \"XAI Type = Importance\") or \"All participants\"."],
  },
  {
    id: "procedure",
    navTitle: "Procedure",
    section: "Section 4",
    kind: "procedure",
    prompt: "What happens in the session, step by step?",
    subtitle: "This is the ordered sequence a participant goes through from arrival to departure. It matters because it's how your measures actually get collected and how you control for confounds (e.g. training before the real task, randomising order). Most HCI/XAI studies share a common backbone — consent → demographics → training/practice → main task (the trials) → post-task questionnaire → debrief — so you can start from that and adapt. Use \"Start from a typical structure\" below if you'd like a scaffold.",
    hints: ["Each step is one thing the participant does; keep them in the order they'll happen.", "Add details per step (what they see, how long, any instructions).", "Attach a consent form or questionnaire to the step where participants complete it."],
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
  {
    id: "results",
    navTitle: "Results & Report",
    section: "Final",
    kind: "results",
  },
];

// Cognitive parameters for a given cognitive model (CoAX / CoXAM / …).
export function cognitiveParamsFor(agent: string): CognitiveParam[] {
  const f = IV_CATALOG.find((x) => x.kind === "cognitive");
  return (f?.cognitiveByAgent && f.cognitiveByAgent[agent]) || [];
}

export function cogParamType(p: CognitiveParam): CogParamType {
  return p.type ?? "float";
}

// Backend parameter name — explicit `key`, else a snake_case slug of the label.
export function cogParamKey(p: CognitiveParam): string {
  return p.key ?? p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function cogParamRange(p: CognitiveParam): { min: number; max: number } | null {
  if (typeof p.min !== "number" || typeof p.max !== "number" || p.min >= p.max) return null;
  return { min: p.min, max: p.max };
}

// null when the value is fine. "error" blocks (the backend would reject it);
// "warn" is advisory — a soft-bounded parameter outside its supported window.
export function cogParamIssue(p: CognitiveParam, raw: string): { level: "error" | "warn"; message: string } | null {
  const v = (raw || "").trim();
  if (!v) return null;
  if (cogParamType(p) === "enum") {
    return p.options && !p.options.includes(v) ? { level: "error", message: `Choose one of: ${p.options.join(", ")}.` } : null;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return { level: "error", message: "Enter a number." };
  if (cogParamType(p) === "integer" && !Number.isInteger(n)) return { level: "error", message: "Enter a whole number." };
  const r = cogParamRange(p);
  if (r && (n < r.min || n > r.max)) {
    return p.softBounds
      ? { level: "warn", message: `Outside the evidence-supported window (${r.min} to ${r.max}) — accepted, but untested.` }
      : { level: "error", message: `Value must be between ${r.min} and ${r.max}.` };
  }
  return null;
}

// The cognitive/IV agent behind a user model — "" for custom or unset models.
export function cognitiveAgentFor(userModel: string | undefined): string {
  const m = (userModel || "").trim();
  if (m === COAX_XAI_PROPERTY) return "Sim2Real";
  return (IV_AGENTS as readonly string[]).includes(m) ? m : "";
}

// The agent used to resolve IV levels: the explicit choice, else the one behind
// the chosen user model, else CoAX.
export function ivAgentFor(a: Answers): string {
  return (a.sd_iv_agent || "").trim() || cognitiveAgentFor(a.user_model) || "CoAX";
}

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
  if (page.kind === "apparatus") return parseApparatusList(a).some((e) => e.mode === "ours" || /^https?:\/\//i.test((e.url || "").trim()));
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

// ---- Answer-derived display helpers (used by chat + review) ----
export function ivSummaryLines(a: Answers): string[] {
  const ivs = parseIvs(a);
  if (!ivs.length) return [];
  return ivs.map((e, i) => {
    const allocShort = e.alloc === "Between-subjects" ? "between" : "within";
    const bal = e.alloc === "Within-subjects" && e.balancing ? `, ${e.balancing}` : "";
    return `IV ${i + 1}: ${e.label || "(factor not set)"} — ${e.levels || "(no levels)"} [${allocShort}-subjects${bal}]`;
  });
}

export function cogConfigSummary(a: Answers): string {
  let obj: Record<string, string> = {};
  try { obj = JSON.parse(a.cog_config || "{}"); } catch { obj = {}; }
  return Object.entries(obj).filter(([, v]) => String(v).trim()).map(([k, v]) => `${k}=${v}`).join(", ");
}

export function parseCogConfig(a: Answers): Record<string, string> {
  try {
    const o = JSON.parse(a.cog_config || "{}");
    return o && typeof o === "object" ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// Cognitive parameters that are varied as an IV on the Study Design page
// (parameter name → the levels being tested) — those are not fixed values.
export function manipulatedCogParams(a: Answers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of parseIvs(a)) {
    if (e.factor === "cognitive" && e.cogParam) out[e.cogParam] = e.levels || "";
  }
  return out;
}

// Every cognitive parameter of the selected user model with the value actually
// in play: the one the user set, the levels it is varied over, or the model's
// own default. This is what the design JSON exports.
export interface ResolvedCogParam {
  key: string;
  label: string;
  type: CogParamType;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  recommendedDefault?: string | number;
  modelDefault?: string | number;
  value: string | number | null; // null when varied as an IV
  levels?: string; // the levels tested, when varied as an IV
  source: "set" | "manipulated" | "model default";
  softBounds?: boolean;
  note?: string;
}

export function resolvedCogParams(a: Answers): ResolvedCogParam[] {
  const agent = cognitiveAgentFor(a.user_model);
  if (!agent) return [];
  const cfg = parseCogConfig(a);
  const manipulated = manipulatedCogParams(a);
  const coerce = (p: CognitiveParam, v: string | number | undefined): string | number | null => {
    if (v === undefined || v === null || String(v).trim() === "") return null;
    if (cogParamType(p) === "enum") return String(v);
    const n = Number(v);
    return Number.isFinite(n) ? n : String(v);
  };

  return cognitiveParamsFor(agent).map((p) => {
    const manip = manipulated[p.name];
    const set = (cfg[p.name] ?? "").trim();
    const base: ResolvedCogParam = {
      key: cogParamKey(p),
      label: p.name,
      type: cogParamType(p),
      ...(typeof p.min === "number" ? { min: p.min } : {}),
      ...(typeof p.max === "number" ? { max: p.max } : {}),
      ...(p.step !== undefined ? { step: p.step } : {}),
      ...(p.options ? { options: p.options } : {}),
      ...(p.default !== undefined ? { recommendedDefault: p.default } : {}),
      ...(p.modelDefault !== undefined ? { modelDefault: p.modelDefault } : {}),
      ...(p.softBounds ? { softBounds: true } : {}),
      ...(p.note ? { note: p.note } : {}),
      value: null,
      source: "model default",
    };
    if (manip !== undefined) return { ...base, value: null, levels: manip, source: "manipulated" };
    if (set) return { ...base, value: coerce(p, set), source: "set" };
    return { ...base, value: coerce(p, p.modelDefault), source: "model default" };
  });
}

export function cogParamsSummaryLines(a: Answers): string[] {
  return resolvedCogParams(a).map((p) => {
    if (p.source === "manipulated") return `${p.label} (${p.key}): manipulated as an IV — ${p.levels || "(no levels set)"}`;
    if (p.value === null) return `${p.label} (${p.key}): (model default)`;
    return `${p.label} (${p.key}): ${p.value}${p.source === "model default" ? " (model default)" : ""}`;
  });
}

export const DEFAULT_TRAINING_TRIALS = 10;
export const DEFAULT_TESTING_TRIALS = 20;

// Trials per participant, split into the training (feedback shown) and testing
// phases. Designs saved before the split carry a single sd_trials total; those
// are reported as all-testing so their totals stay unchanged.
export function trialSplit(a: Answers): { training: number; testing: number; total: number } {
  const num = (s: string | undefined) => {
    const n = parseInt((s ?? "").trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const training = num(a.sd_trials_training);
  const testing = num(a.sd_trials_testing);
  if (training !== null || testing !== null) {
    const tr = training ?? DEFAULT_TRAINING_TRIALS;
    const te = testing ?? DEFAULT_TESTING_TRIALS;
    return { training: tr, testing: te, total: tr + te };
  }
  const legacy = num(a.sd_trials);
  if (legacy !== null) return { training: 0, testing: legacy, total: legacy };
  return { training: DEFAULT_TRAINING_TRIALS, testing: DEFAULT_TESTING_TRIALS, total: DEFAULT_TRAINING_TRIALS + DEFAULT_TESTING_TRIALS };
}

export function participantTotals(a: Answers) {
  const ivs = parseIvs(a);
  const per = parseInt(a.sd_participants || "", 10) || 0;
  const between = betweenCells(ivs) || 1;
  const cells = totalCells(ivs);
  const totalP = per * between;
  const split = trialSplit(a);
  const trials = split.total;
  return { per, between, cells, totalP, trials, training: split.training, testing: split.testing, totalTrials: totalP * trials };
}

// ---- Apparatus configurations (saved per condition/group) ----
export interface ApparatusEntry {
  id: string;
  label: string;
  group: string;                    // "All participants" or "<IV factor> = <level>"
  mode: "ours" | "own";
  params: Record<string, string>;   // when mode === "ours" (partial; defaults filled at render)
  url: string;                      // when mode === "own"
}

// Parse a list of instance IDs from free text. Accepts comma / space / semicolon
// separated tokens; numeric ranges like "0-9", "0–9" or "0..9" expand inclusively.
// Non-numeric tokens (some datasets use string ids) are kept verbatim. De-duplicated,
// order-preserving, and capped so a huge range can't lock up the UI.
const INSTANCE_ID_CAP = 500;
export function parseInstanceIds(raw: string | undefined): string[] {
  const s = (raw || "").trim();
  if (!s) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: string) => {
    if (out.length >= INSTANCE_ID_CAP || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  for (const tokRaw of s.split(/[\s,;]+/)) {
    const tok = tokRaw.trim();
    if (!tok) continue;
    const m = tok.match(/^(-?\d+)\s*(?:-|–|\.\.)\s*(-?\d+)$/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const step = a <= b ? 1 : -1;
      for (let i = a; step > 0 ? i <= b : i >= b; i += step) {
        push(String(i));
        if (out.length >= INSTANCE_ID_CAP) break;
      }
    } else {
      push(tok);
    }
  }
  return out;
}

// The instance-id list for an apparatus config, tolerating the legacy single
// `instanceId` param (migrated transparently when `instanceIds` is unset).
export function instanceIdsOf(params: Record<string, string>): string[] {
  const list = parseInstanceIds(params.instanceIds);
  if (list.length) return list;
  const legacy = parseInstanceIds(params.instanceId);
  return legacy.length ? legacy : [];
}

// Training instances: shown FIRST in the generated survey, with feedback visible
// (sim2real → showFeedback=1; local → feedback/ground-truth widgets + showGroundTruth=1;
// the global surrogate renderer has no feedback display, so it has no training list).
export function trainingInstanceIdsOf(params: Record<string, string>): string[] {
  return parseInstanceIds(params.trainingInstanceIds);
}

// ---- Study-interface URL (the deployed XAI iframe apps) ----
// Pure helpers, kept here (not in the client component) so survey/QSF generation
// can build interface URLs without importing React modules.
//
// Two renderer namespaces:
//   /local  — CoAX renderer: per-instance attribution/importance (SHAP/LIME)
//   /global — surrogate renderer: LR weights and DT rules
// The namespace follows the explanation form: LR|DT → global, else → local.
export const STUDY_UI_ROOT = "https://lucas1213wzy.github.io/xaikit-test-ui-apparatus";

export interface StudyDataset { appId: string; label: string; localMax: number }
export const STUDY_DATASETS: StudyDataset[] = [
  { appId: "adult", label: "Adult Income", localMax: 299 },
  { appId: "mushrooms", label: "Mushroom", localMax: 3938 },
  { appId: "wine_quality", label: "Wine Quality", localMax: 121 },
  { appId: "forest_cover", label: "Forest Cover", localMax: 299 },
  // Sim2Real synthetic-AI study (XAI Property designs) — served from local/sim2real/study.html
  { appId: "adult_sim2real", label: "Adult Income (XAI Property)", localMax: 38 },
];

export const EXPLANATION_PROPERTIES = ["faithful", "sparse", "robust", "sparse_robust"];

// The property condition of a Sim2Real config. The study.html contract reuses the
// expMethod param for this (faithful|robust|sparse|sparse_robust, default robust);
// expProperty is accepted as a legacy key from earlier saved configs.
export function sim2realPropertyOf(p: Record<string, string>): string {
  if (EXPLANATION_PROPERTIES.includes(p.expMethod)) return p.expMethod;
  if (EXPLANATION_PROPERTIES.includes(p.expProperty)) return p.expProperty;
  return "robust";
}

export const EXPLANATION_FORMS: { id: string; label: string; ns: "local" | "global" }[] = [
  { id: "attribution", label: "Feature attribution", ns: "local" },
  { id: "importance", label: "Feature importance", ns: "local" },
  { id: "LR", label: "Logistic regression weights", ns: "global" },
  { id: "DT", label: "Decision tree rules", ns: "global" },
];

// Participant-screen elements. Keys map to /local widgets (sliders → simulation);
// localOnly elements are ignored by / unavailable in the global renderer.
// `required` elements are always on and cannot be deselected.
export interface InterfaceElement { key: string; label: string; sub: string; localOnly?: boolean; required?: boolean }
export const INTERFACE_ELEMENTS: InterfaceElement[] = [
  { key: "instance", label: "Data instance", sub: "Feature names and values", localOnly: true, required: true },
  { key: "meters", label: "Meter bars", sub: "Value ranges and category marks", localOnly: true },
  { key: "xai", label: "XAI visualization", sub: "Attribution, importance, or surrogate" },
  { key: "prediction", label: "AI prediction", sub: "Predicted class or outcome" },
  { key: "feedback", label: "AI feedback", sub: "Compare user and AI selections", localOnly: true },
  { key: "ground-truth", label: "Ground truth", sub: "Reveal the correct class", localOnly: true },
  { key: "tutorial", label: "Tutorial markers", sub: "Numbered visual guidance" },
  { key: "sliders", label: "Feature sliders", sub: "Participant drags one feature and re-predicts" },
];

export function formOf(p: Record<string, string>): string {
  if (p.form) return p.form;
  // legacy migration from the old single xaiType param
  const legacy = (p.xaiType || "").toLowerCase();
  if (legacy === "weights") return "LR";
  if (legacy === "importance") return "importance";
  return "attribution";
}

export function namespaceOf(p: Record<string, string>): "local" | "global" | "sim2real" {
  if ((p.appId || "") === "adult_sim2real") return "sim2real";
  const f = formOf(p);
  return f === "LR" || f === "DT" ? "global" : "local";
}

// The "natural" canvas size each interface needs to lay out fully. Embeds render
// at this size and are then scaled down to fit their container, so nothing gets
// clipped. Sizes were measured against the deployed renderers (largest variant per
// namespace, sliders included): local ≤ 1007×540, global ≤ 1135×882 — the canvas
// adds a small margin. Don't make these bigger than needed: the pages centre and
// scale up with extra width, which shrinks the final scaled-down text.
export function studyNaturalSize(mode: string, params: Record<string, string>): { w: number; h: number } {
  if (mode === "own") return { w: 1280, h: 800 };
  return namespaceOf(params) === "global" ? { w: 1280, h: 900 } : { w: 1100, h: 620 };
}

export function elementsOf(p: Record<string, string>): string[] {
  const raw = p.elements != null ? p.elements : p.widgets != null ? p.widgets : "instance,meters,xai,prediction";
  let els = raw.split(",").map((s) => s.trim()).filter(Boolean).map((k) => (k === "simulation" ? "sliders" : k));
  // Feature importance has no slider/ground-truth widgets — drop them even if a
  // saved config selected them under a different explanation form.
  if (formOf(p) === "importance") els = els.filter((k) => k !== "sliders" && k !== "ground-truth");
  // "Data instance" is always shown — it cannot be deselected (also repairs
  // older saved configs and chat-set element lists that omitted it).
  if (!els.includes("instance")) els.unshift("instance");
  return els;
}

// modelName is fixed by dataset (and, in global LR, by the dataset too) — never user-chosen.
export function modelNameFor(p: Record<string, string>): string {
  const appId = p.appId || "wine_quality";
  const ns = namespaceOf(p);
  if (ns === "sim2real") return "synthetic_ai";
  if (ns === "global") return formOf(p) === "LR" && appId === "forest_cover" ? "xgboost" : "mlp";
  return appId === "adult" || appId === "forest_cover" ? "xgboost" : "mlp";
}

// Valid instanceId range. NOTE: the two namespaces index different corpora, so
// ids must be re-checked whenever the explanation form changes namespace.
export function instanceRangeFor(p: Record<string, string>): { min: number; max: number } {
  if (namespaceOf(p) === "global") return { min: 0, max: 399 };
  const ds = STUDY_DATASETS.find((d) => d.appId === (p.appId || "wine_quality"));
  return { min: 0, max: ds ? ds.localMax : 299 };
}

// Default train/test split for a Sim2Real (XAI Property) apparatus: the first
// SIM2REAL_TRAIN_COUNT instances train, every remaining one tests (0-9 and
// 10-38 over its 0–38 corpus). Derived from the range so it stays correct if
// the corpus size changes.
export const SIM2REAL_TRAIN_COUNT = 10;

export function defaultSim2realInstanceIds(): { trainingInstanceIds: string; instanceIds: string } {
  const { min, max } = instanceRangeFor({ appId: "adult_sim2real" });
  const trainEnd = Math.min(min + SIM2REAL_TRAIN_COUNT - 1, max);
  return {
    trainingInstanceIds: `${min}-${trainEnd}`,
    instanceIds: trainEnd < max ? `${trainEnd + 1}-${max}` : "",
  };
}

// What is left for the test set once the training instances are taken: the
// configured range narrowed past any training ids at either end, how many ids
// are spoken for, and any id used in BOTH lists (which would test a participant
// on an instance they already practised).
export function testInstanceHint(p: Record<string, string>): {
  min: number;
  max: number;
  reserved: number;
  overlap: string[];
} {
  const range = instanceRangeFor(p);
  const train = new Set(trainingInstanceIdsOf(p));
  let min = range.min;
  while (min <= range.max && train.has(String(min))) min++;
  let max = range.max;
  while (max >= min && train.has(String(max))) max--;
  const overlap = instanceIdsOf(p).filter((id) => train.has(id));
  return { min, max, reserved: train.size, overlap };
}

// NOTE: expMethod is intentionally NOT defaulted here — its default depends on the
// namespace (local → SHAP, sim2real → LIME) and is resolved in buildStudyUrl / the UI.
export const STUDY_PARAM_DEFAULTS: Record<string, string> = {
  appId: "wine_quality", instanceId: "0",
  LRVariant: "dense", DTDepth: "3", DTEditor: "0",
  focusOnImportant: "0", userPrediction: "none",
  showExplanationPrediction: "1", recourseConfirm: "0",
};

export function buildStudyUrl(root: string, p: Record<string, string>): string {
  const form = formOf(p);
  const ns = namespaceOf(p);
  const els = elementsOf(p);
  const has = (k: string) => els.includes(k);
  // "XAI visualization" unchecked → xaiType=none. No elements selected at all
  // means "show everything" (the host's default when widgets is omitted).
  const xaiOn = has("xai") || els.length === 0;
  // trainingMode="1" marks a TRAINING trial: feedback is shown so participants can
  // learn from it. Set per-URL by the survey generator, never stored on the config.
  const training = p.trainingMode === "1";
  if (ns === "sim2real") {
    // Sim2Real (XAI Property) study screen. expMethod carries the PROPERTY condition
    // (not shap/lime); there is no modelName and no widgets. All flags emitted bare 1/0.
    const q2 = new URLSearchParams();
    q2.set("appId", p.appId || "adult_sim2real");
    q2.set("instanceId", p.instanceId ?? "0");
    q2.set("expMethod", sim2realPropertyOf(p));
    q2.set("showDelta", p.showDelta === "0" ? "0" : "1");
    q2.set("showPrediction", p.showPrediction === "0" ? "0" : "1");
    q2.set("showQuestion", p.showQuestion === "0" ? "0" : "1");
    // Feedback is driven ONLY by the training/test split: training trials show it,
    // test trials never do. (A legacy stored showFeedback param is deliberately
    // ignored — it used to leak feedback into test trials.)
    q2.set("showFeedback", training ? "1" : "0");
    return `${root}/local/sim2real/study.html?${q2.toString()}`;
  }
  const q = new URLSearchParams();
  q.set("appId", p.appId || "wine_quality");
  q.set("instanceId", p.instanceId ?? "0");
  q.set("modelName", modelNameFor(p));
  // Flags are always emitted as bare 1/0 — the two renderers parse them differently.
  if (ns === "local") {
    // Training trials additionally show the feedback + ground-truth widgets.
    const localEls = training ? Array.from(new Set([...els, "feedback", "ground-truth"])) : els;
    q.set("expMethod", p.expMethod === "lime" ? "lime" : "shap");
    q.set("xaiType", xaiOn ? form : "none");
    if (localEls.length) q.set("widgets", localEls.map((k) => (k === "sliders" ? "simulation" : k)).join(","));
    q.set("showPrediction", has("prediction") ? "1" : "0");
    q.set("showTutorial", has("tutorial") ? "1" : "0");
    q.set("userSimulation", has("sliders") ? "1" : "0");
    q.set("userPrediction", p.userPrediction || "none");
    q.set("showGroundTruth", training || has("ground-truth") ? "1" : "0");
    q.set("focusOnImportant", p.focusOnImportant === "1" ? "1" : "0");
  } else {
    q.set("xaiType", xaiOn ? form : "none");
    // DTDepth and LRVariant never coexist — exactly one, matching the form.
    if (xaiOn && form === "DT") {
      q.set("DTDepth", p.DTDepth === "2" ? "2" : "3");
      if (p.DTEditor === "1") q.set("DTEditor", "1");
    } else if (xaiOn && form === "LR") {
      q.set("LRVariant", p.LRVariant === "sparse" ? "sparse" : "dense");
    }
    q.set("showPrediction", has("prediction") ? "1" : "0");
    if (has("tutorial")) q.set("showTutorial", "1");
    if (p.showExplanationPrediction === "0") q.set("showExplanationPrediction", "0");
    if (has("sliders")) {
      q.set("counterfactualSimulation", "1");
      if (p.recourseConfirm === "1") q.set("recourseConfirm", "1");
    }
  }
  return `${root}/${ns}/iframe.html?${q.toString()}`;
}

let __apCounter = 0;
export function normalizeApparatusEntry(x: any): ApparatusEntry {
  const mode = x?.mode === "own" ? "own" : "ours";
  const params = (x && typeof x.params === "object" && !Array.isArray(x.params))
    ? Object.fromEntries(Object.entries(x.params).map(([k, v]) => [k, String(v)]))
    : {};
  return {
    id: String(x?.id || `ap_${Date.now().toString(36)}_${__apCounter++}`),
    label: String(x?.label || ""),
    group: String(x?.group || "All participants"),
    mode,
    params,
    url: String(x?.url || ""),
  };
}
export function normalizeApparatusList(arr: any): ApparatusEntry[] {
  return Array.isArray(arr) ? arr.map(normalizeApparatusEntry) : [];
}
// The dataset an "ours" apparatus runs on is decided by the design, not by a
// picker on the Apparatus page: XAI-Property designs always use the Sim2Real
// screen; a "Dataset = X" segment in the entry's group (a Dataset IV level)
// wins next; otherwise the Study Design page's dataset applies. Falls back to
// whatever the entry already stored (older saves / assistant-written configs).
export function apparatusAppIdFor(a: Answers, e: ApparatusEntry): string {
  if (hasXaiPropertyIv(a)) return "adult_sim2real";
  const seg = (e.group || "").split("·").map((s) => s.trim())
    .find((s) => /dataset/i.test(s.slice(0, Math.max(0, s.indexOf("=")))));
  const level = seg ? seg.slice(seg.indexOf("=") + 1).trim() : "";
  const label = level || (a.ds_dataset || "").trim();
  const ds = label
    ? STUDY_DATASETS.find((d) => d.label === label || d.appId === label || slugId(d.label) === slugId(label))
    : undefined;
  return ds?.appId || e.params.appId || "wine_quality";
}
export function parseApparatusList(a: Answers): ApparatusEntry[] {
  try {
    const list = normalizeApparatusList(JSON.parse(a.apparatus_list || "[]"));
    // Derived on every read so all consumers (URL builder, previews, QSF and
    // JSON exports, the run-experiment request) agree on the dataset.
    return list.map((e) => (e.mode === "ours" ? { ...e, params: { ...e.params, appId: apparatusAppIdFor(a, e) } } : e));
  } catch { return []; }
}

// ---- Replaying a simulated trial on the study interface ----

// One simulated result row, reduced to what picking an interface URL needs.
export interface TrialUrlSpec {
  instanceId: string;
  phase: string; // "training" | "testing"
  condition: string; // condition_name / withinCondition
  shownXaiType: string; // the condition's explanation type (never "none")
  datasetId: string; // dataId
  explanationType?: string; // explanation_type: "dt" / "lr" / "none"
  xaiType?: string; // the condition's assigned type, as a fallback
  testedWithXai?: boolean | null; // tested_w_xai — testing rows only
  xaiProperty?: string; // Sim2Real: faithful / sparse / robust / sparse_robust
}

// The apparatus config a trial was run under: the one whose group matches the
// trial's actual condition/dataset, else the "All participants" entry, else
// the only one.
//
// A group can name more than one between-subjects factor —
// participantGroups() joins one "Factor = Level" segment per between-subjects
// IV with " · " (e.g. "Dataset = wine_quality · XAI Type = Decision Tree") —
// so every segment has to match, not just the group string as a whole; the
// old single-"=" split only ever worked for a one-factor group and silently
// fell through to the first/"All participants" entry otherwise. `condition`
// (built off condition_name/xai_type/withinCondition — see trialViewOf) never
// encodes dataset, so a "Dataset = …" segment is checked against `datasetId`
// instead, and everything else against `condition`.
export function apparatusForTrial(entries: ApparatusEntry[], t: { condition: string; datasetId?: string }): ApparatusEntry | undefined {
  if (entries.length <= 1) return entries[0];
  const wantCondition = slugId(t.condition);
  const wantDataset = slugId(t.datasetId || "");
  let best: { e: ApparatusEntry; score: number } | null = null;
  for (const e of entries) {
    const g = (e.group || "").trim();
    if (!g || g === "All participants") continue;
    const segments = g.split("·").map((seg) => seg.trim()).filter(Boolean);
    if (!segments.length) continue;
    let matched = 0;
    for (const seg of segments) {
      const eq = seg.indexOf("=");
      const factor = eq >= 0 ? seg.slice(0, eq).trim() : "";
      const level = eq >= 0 ? seg.slice(eq + 1).trim() : seg;
      const want = /dataset/i.test(factor) ? wantDataset : wantCondition;
      if (want && slugId(level) === want) matched++;
    }
    // Every segment of the group must match — a partial match (e.g. right
    // dataset, wrong XAI type) is the wrong config, not a close-enough one.
    if (matched === segments.length && (!best || matched > best.score)) best = { e, score: matched };
  }
  if (best) return best.e;
  return entries.find((e) => !e.group || e.group === "All participants") ?? entries[0];
}

/**
 * Did this trial actually show an explanation?
 *
 * `tested_w_xai` is the authoritative flag but only exists on TESTING rows —
 * training trials always show the explanation, so it is null there.
 * `explanation_type` backs it up: "none" when no explanation was rendered,
 * "dt"/"lr" otherwise, on both phases.
 *
 * `shown_xai_type` is NOT usable for this: it names the condition's explanation
 * type and stays "decision_tree"/"logistic_regression" even on a without-XAI
 * trial.
 */
export function trialShowedXai(t: { testedWithXai?: boolean | null; explanationType?: string; shownXaiType?: string }): boolean {
  if (typeof t.testedWithXai === "boolean") return t.testedWithXai;
  const e = (t.explanationType || "").trim().toLowerCase();
  if (e) return e !== "none";
  // CoAX rows carry no explanation_type, and their "None" condition shows up as
  // shown_xai_type "none" — the only signal left, so it is trusted last.
  const s = (t.shownXaiType || "").trim().toLowerCase();
  if (s) return s !== "none";
  return true;
}

// A result row names its explanation in the runner's vocabulary
// (shown_xai_type "decision_tree", explanation_type "dt"); the interface needs
// an EXPLANATION_FORMS id. "" when the row says nothing recognisable, in which
// case the apparatus config's own form stands.
const ROW_FORM_IDS: Record<string, string> = {
  decision_tree: "DT", dt: "DT", tree: "DT",
  logistic_regression: "LR", lr: "LR", weights: "LR", logreg: "LR",
  attribution: "attribution", attributions: "attribution", local: "attribution",
  importance: "importance", feature_importance: "importance",
};

export function trialFormId(t: { shownXaiType?: string; explanationType?: string; xaiType?: string }): string {
  // explanation_type first — it is what was actually rendered. On a without-XAI
  // trial it reads "none", which maps to nothing and falls through to the
  // condition's type, so the right renderer is still chosen with XAI hidden.
  for (const raw of [t.explanationType, t.shownXaiType, t.xaiType]) {
    const v = (raw || "").trim().toLowerCase();
    if (v && ROW_FORM_IDS[v]) return ROW_FORM_IDS[v];
  }
  return "";
}

/**
 * The study-interface URL that replays one simulated trial.
 *
 * Everything the user configured on the Apparatus page (form, method, widgets,
 * LR/DT settings) is kept; only what the row dictates is overridden — the
 * instance, whether it was a training trial, and whether XAI was shown. That is
 * why this starts from the apparatus entry instead of rebuilding params from
 * result columns.
 */
export function trialStudyUrl(root: string, entry: ApparatusEntry | undefined, t: TrialUrlSpec): string {
  const base: Record<string, string> = { ...STUDY_PARAM_DEFAULTS, ...(entry?.params ?? {}) };
  // A Sim2Real row names the property it showed, and that screen only exists
  // under adult_sim2real — its dataId says "adult", which would otherwise point
  // at the local renderer.
  const property = EXPLANATION_PROPERTIES.includes((t.xaiProperty || "").trim()) ? (t.xaiProperty as string).trim() : "";
  if (property && !entry?.params?.appId) base.appId = "adult_sim2real";
  else if (t.datasetId && !entry?.params?.appId) base.appId = t.datasetId;
  const p: Record<string, string> = {
    ...base,
    instanceId: t.instanceId,
    trainingMode: t.phase === "training" ? "1" : "0",
  };
  // The row decides which explanation was actually shown, not the apparatus
  // config: a design that varies XAI Type runs several forms through one
  // config, so trusting the config would render LR weights for a DT trial.
  // namespaceOf() follows the form, so this also picks the right renderer.
  const rowForm = trialFormId(t);
  if (rowForm) p.form = rowForm;
  // Sim2Real reuses expMethod to carry the property condition, and it changes
  // per trial — the apparatus config would pin every trial to one property.
  if (property) p.expMethod = property;
  // The element list drives what the existing builder emits, so the two things a
  // trial dictates are expressed here rather than by changing buildStudyUrl:
  //   - a without-XAI trial drops "xai" so the explanation is hidden;
  //   - a TEST trial drops "prediction", because revealing the AI's answer is
  //     feedback and belongs to training only. An empty element list means
  //     "show everything", so it is seeded from the defaults before filtering.
  const training = t.phase === "training";
  const showXai = trialShowedXai(t);
  if (!showXai || !training) {
    const els = elementsOf(base).filter((k) => (showXai || k !== "xai") && (training || k !== "prediction"));
    p.elements = els.length ? els.join(",") : "instance";
  }
  return buildStudyUrl(root, p);
}

// ---- Participant groups (the actual between-subjects cells) ----
export function slugId(s: string): string {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
export function ivLevelList(e: IvEntry): string[] {
  const lv = (e.levels || "").trim();
  if (!lv) return [];
  if (lv.includes(" vs ")) return lv.split(" vs ").map((s) => s.trim()).filter(Boolean);   // binary
  if (lv.includes("|")) return lv.split("|").map((s) => s.trim()).filter(Boolean);          // categorical "A | B"
  return [lv]; // range / cognitive / single value
}
export function betweenIvs(a: Answers): IvEntry[] {
  return parseIvs(a).filter((e) => e.alloc === "Between-subjects" && ivLevelList(e).length > 0);
}
export function withinIvs(a: Answers): IvEntry[] {
  return parseIvs(a).filter((e) => e.alloc !== "Between-subjects" && ivLevelList(e).length > 0);
}
export interface ParticipantGroup { key: string; label: string; between: { factor: string; level: string }[]; }
// Cartesian product of the between-subjects IV levels = one group per cell.
export function participantGroups(a: Answers): ParticipantGroup[] {
  const betw = betweenIvs(a);
  if (!betw.length) return [{ key: "all", label: "All participants", between: [] }];
  let combos: { factor: string; level: string }[][] = [[]];
  for (const iv of betw) {
    const name = iv.label || "IV";
    const next: { factor: string; level: string }[][] = [];
    for (const c of combos) for (const lvl of ivLevelList(iv)) next.push([...c, { factor: name, level: lvl }]);
    combos = next;
  }
  return combos.map((between) => {
    const label = between.map((b) => `${b.factor} = ${b.level}`).join(" · ");
    return { key: label, label, between };
  });
}
// Within-subjects IVs — every participant (in every group) goes through all their levels.
export function withinCoverage(a: Answers): { factor: string; levels: string[] }[] {
  return withinIvs(a).map((iv) => ({ factor: iv.label || "IV", levels: ivLevelList(iv) }));
}
// Options for assigning an apparatus to a group.
export function ivGroupOptions(a: Answers): string[] {
  const groups = participantGroups(a);
  if (groups.length === 1 && groups[0].label === "All participants") return ["All participants"];
  return ["All participants", ...groups.map((g) => g.label)];
}

export function apparatusSummaryLines(a: Answers): string[] {
  return parseApparatusList(a).map((e) => {
    const who = e.group || "All participants";
    let what: string;
    if (e.mode === "own") {
      what = e.url.trim() ? e.url.trim() : "(no URL)";
    } else {
      const p = { ...STUDY_PARAM_DEFAULTS, ...e.params };
      const ds = STUDY_DATASETS.find((d) => d.appId === (p.appId || "wine_quality"))?.label ?? p.appId;
      const desc = namespaceOf(p) === "sim2real"
        ? `XAI Property: ${sim2realPropertyOf(p)}`
        : EXPLANATION_FORMS.find((f) => f.id === formOf(p))?.label ?? formOf(p);
      what = `our interface (${desc}, ${ds})`;
    }
    const label = e.label ? `${e.label}: ` : "";
    return `${label}${who} → ${what}`;
  });
}
