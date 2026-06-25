// Wizard page model. Most pages ask one open question (kind "text"); two pages
// are custom forms (kind "studydesign", "dataset"). The collected answers are
// turned into the final templated document by the LLM.

export type Answers = Record<string, string>;

export type PageKind = "text" | "studydesign" | "dataset";

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
  agents?: string[]; // available only for these models (default: all)
  levels?: string[]; // categorical, same across models
  levelsByAgent?: Record<string, string[]>;
  range?: { min: number; max: number };
  binary?: [string, string];
  cognitiveByAgent?: Record<string, CognitiveParam[]>;
  note?: string;
}

export const IV_CATALOG: IvFactor[] = [
  {
    id: "xai_type",
    label: "XAI type",
    kind: "categorical",
    agents: ["CoAX", "CoXAM"],
    levelsByAgent: {
      CoAX: ["None", "Attribution", "Importance"],
      CoXAM: ["Decision Tree", "Logistic Regression", "Hybrid"],
    },
  },
  {
    id: "xai_method",
    label: "XAI method",
    kind: "categorical",
    agents: ["CoAX", "CoXAM"],
    levelsByAgent: {
      CoAX: ["LIME", "SHAP", "Integrated gradients", "Input gradients (paper)", "Layer-wise Relevance Propagation", "Captum DeepLift"],
      CoXAM: ["Decision tree", "Logistic regression weights (paper)", "Decision list", "Interpretable decision sets"],
    },
  },
  { id: "num_attributes", label: "Number of attributes", kind: "range", range: { min: 1, max: 10 } },
  { id: "num_training", label: "Number of training instances", kind: "range", range: { min: 1, max: 14 }, note: "CoAX default 10; test set 18." },
  {
    id: "dataset",
    label: "Dataset",
    kind: "categorical",
    levelsByAgent: {
      CoAX: ["Adult Income (CoAX only)", "Wine Quality", "Forest Cover"],
      CoXAM: ["Mushroom (CoXAM only)", "Wine Quality", "Forest Cover"],
      Sim2Real: ["Wine Quality", "Forest Cover"],
    },
    note: "Untested: Breast Cancer, Heart Disease, King County House, Pima Diabetes, Cardiotocography.",
  },
  { id: "faithfulness", label: "Faithfulness (XAI fidelity)", kind: "range", range: { min: 0, max: 100 }, note: "Usually controlled at 80%." },
  { id: "robustness", label: "Robustness", kind: "binary", binary: ["Robust", "Not robust"] },
  { id: "sparsity", label: "Sparsity", kind: "binary", binary: ["Sparse", "Not sparse"] },
  { id: "ai_model", label: "AI model", kind: "categorical", levels: ["MLP", "XGBoost"], note: "Usually controlled by dataset." },
  { id: "tested_xai", label: "Tested with XAI", kind: "binary", binary: ["With XAI", "Without XAI"], note: "Trial-level randomized, within-subjects." },
  {
    id: "cognitive",
    label: "Cognitive parameters",
    kind: "cognitive",
    cognitiveByAgent: {
      CoAX: [
        { name: "Retrieval Threshold", min: -2.3, max: -1.5, note: "Memory capacity; higher = harder retrieval / more forgetting." },
        { name: "Exemplar Distance Sensitivity", min: 1, max: 10, note: "How strongly distance affects similarity." },
        { name: "Attended Features", min: 1, max: 5, note: "Attention span — features attended when comparing exemplars." },
        { name: "Feature-Class Sensitivity", min: 1, max: 7, note: "How strongly attribution maps to classes." },
      ],
      CoXAM: [
        { name: "Retrieval Threshold", min: -2.8, max: -1.5, note: "How easily info is retrieved from memory." },
        { name: "Opportunity Cost", min: 0, max: 10, note: "Accuracy–time tradeoff (computational rationality / RL)." },
        { name: "Diffusion Noise", min: 0, max: 1, note: "Stochasticity during forward simulation." },
        { name: "Counterfactual Margin", min: 0, max: 1, note: "Margin when evaluating counterfactual changes." },
      ],
      Sim2Real: [
        { name: "Memory / cognitive budget", min: 0, max: 0, note: "Top-2 features vs all features (≈ CoAX Attended Features)." },
      ],
    },
  },
  {
    id: "user_task",
    label: "User task",
    kind: "categorical",
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

export const PAGES: Page[] = [
  {
    id: "overview",
    navTitle: "Overview",
    section: "Getting started",
    kind: "text",
    prompt: "What experiment do you want to test on?",
    placeholder: "e.g. I want to compare two XAI explanation styles and see how each affects users' trust calibration…",
    required: true,
  },
  {
    id: "rq",
    navTitle: "Research Questions",
    section: "Section 1",
    kind: "text",
    prompt: "What are your research questions?",
    hints: ["List them as RQ1, RQ2, RQ3…", "Each should be clear and testable."],
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
    id: "dataset",
    navTitle: "Dataset & Agent",
    section: "Section 3",
    kind: "dataset",
    required: true,
  },
];

// ---- Completeness ----
export function isPageComplete(page: Page, a: Answers): boolean {
  const has = (k: string) => (a[k] || "").trim().length > 0;
  if (page.kind === "text") return has(page.id);
  if (page.kind === "studydesign") {
    return has("sd_dv") && has("sd_iv") && has("sd_iv_levels") && has("sd_cv") && has("sd_balancing") && has("sd_participants");
  }
  if (page.kind === "dataset") return has("ds_agent");
  return true;
}

// ---- Participant-vs-design sanity check ----
export function validateParticipants(
  a: Answers
): { level: "ok" | "warn" | "info"; message: string } | null {
  const design = a.sd_design;
  const balancing = a.sd_balancing;
  const conditions = parseInt(a.sd_conditions || "", 10);
  const n = parseInt(a.sd_participants || "", 10);
  if (!design || !a.sd_participants) return null;
  if (!Number.isFinite(n) || n <= 0) return { level: "warn", message: "Enter the total number of participants as a number." };

  const c = Number.isFinite(conditions) && conditions > 1 ? conditions : null;

  if (design === "Between-subjects") {
    if (!c) return { level: "info", message: `Between-subjects: each participant sees one condition. Add the number of conditions to check group sizes.` };
    if (n < c) return { level: "warn", message: `Between-subjects with ${c} conditions needs at least ${c} participants (one per group) — ${n} is too few.` };
    if (n % c !== 0) return { level: "warn", message: `${n} participants don't divide evenly into ${c} conditions → unequal groups. Nearest even split: ${Math.floor(n / c) * c} or ${Math.ceil(n / c) * c}.` };
    return { level: "ok", message: `Between-subjects: ${n} ÷ ${c} = ${n / c} participants per condition. ✓` };
  }

  if (design === "Within-subjects") {
    if (!c) return { level: "info", message: `Within-subjects: everyone sees all conditions. Add the number of conditions to check counterbalancing.` };
    if (balancing === "Full counterbalancing") {
      const orders = factorial(c);
      if (n % orders !== 0)
        return { level: "warn", message: `Full counterbalancing of ${c} conditions = ${orders} orders. For balance, N should be a multiple of ${orders} (you have ${n}). Nearest: ${Math.floor(n / orders) * orders || orders} or ${Math.ceil(n / orders) * orders}.` };
      return { level: "ok", message: `Within-subjects, full counterbalancing: ${n} ÷ ${orders} orders = ${n / orders} per order. ✓` };
    }
    if (balancing === "Latin square") {
      if (n % c !== 0)
        return { level: "warn", message: `A Latin square for ${c} conditions has ${c} sequences. For balance, N should be a multiple of ${c} (you have ${n}).` };
      return { level: "ok", message: `Within-subjects, Latin square: ${n} ÷ ${c} sequences = ${n / c} per sequence. ✓` };
    }
    return { level: "info", message: `Within-subjects with ${c} conditions and "${balancing || "no"}" balancing — order effects may confound results; consider Latin square or full counterbalancing.` };
  }

  // Mixed
  if (!c) return { level: "info", message: `Mixed design: add the number of conditions/cells to check participant allocation.` };
  if (n % c !== 0) return { level: "info", message: `Mixed design with ${c} cells: ${n} participants won't split evenly across the between-subjects factor.` };
  return { level: "ok", message: `Mixed design: ${n} participants across ${c} cells. ✓` };
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
