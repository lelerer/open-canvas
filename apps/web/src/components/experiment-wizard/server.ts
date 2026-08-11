// Client for the XAIKit study server (FastAPI, default http://localhost:8000).
//
// Nothing here runs on its own: every function is called explicitly, and the
// only entry point the UI uses is runStudy(), driven by the Run experiment
// button. Request bodies follow the server's OpenAPI schema; responses are
// untyped dicts server-side, so the shapes below are read defensively.

export interface ApiConfig {
  baseUrl: string;
  token?: string; // XAIKIT_API_TOKEN, when the server sets one
}

export const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_XAIKIT_API_URL || "https://xaikit-test-api.onrender.com";

export const API_BASE_KEY = "xaikit-api-base";
export const API_TOKEN_KEY = "xaikit-api-token";

export type JobState = "pending" | "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface Job {
  job_id: string;
  state: JobState;
  elapsed?: number;
  log?: string;
  result?: unknown;
  error?: string;
  [k: string]: unknown;
}

export interface CreatedStudy {
  study_id: string;
  design?: unknown;
  validation?: unknown;
  [k: string]: unknown;
}

// One trial/step row of a simulation run.
export type ResultRow = Record<string, unknown>;

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly detail?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

function headers(cfg: ApiConfig, json: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (cfg.token?.trim()) h["Authorization"] = `Bearer ${cfg.token.trim()}`;
  return h;
}

export function apiUrl(cfg: ApiConfig, path: string, query?: Record<string, string | number | undefined>): string {
  const base = (cfg.baseUrl || DEFAULT_API_BASE).replace(/\/+$/, "");
  const qs = Object.entries(query || {})
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `${base}${path}${qs ? `?${qs}` : ""}`;
}

async function request<T>(
  cfg: ApiConfig,
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const { query, body, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(apiUrl(cfg, path, query), {
      ...rest,
      body,
      headers: { ...headers(cfg, body !== undefined), ...(rest.headers as Record<string, string> | undefined) },
    });
  } catch (e) {
    // fetch only rejects on network-level failure — server down, wrong port, or
    // a CORS rejection. The browser's message is deliberately opaque.
    throw new ApiError(
      `Could not reach the study server at ${cfg.baseUrl || DEFAULT_API_BASE}. Is it running, and does XAIKIT_ALLOWED_ORIGINS include this page's origin?`,
      undefined,
      e
    );
  }
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }
  if (!res.ok) throw new ApiError(describeError(res.status, parsed), res.status, parsed);
  return parsed as T;
}

// FastAPI puts a string in `detail` for HTTPException and an array of
// {loc, msg, type} for 422 validation failures.
function describeError(status: number, parsed: unknown): string {
  const d = (parsed as { detail?: unknown } | undefined)?.detail;
  if (typeof d === "string") return `${status}: ${d}`;
  if (Array.isArray(d)) {
    const parts = d
      .map((e) => {
        const loc = Array.isArray((e as { loc?: unknown[] }).loc) ? (e as { loc: unknown[] }).loc.slice(1).join(".") : "";
        const msg = (e as { msg?: string }).msg || "invalid";
        return loc ? `${loc}: ${msg}` : msg;
      })
      .slice(0, 5);
    return `${status}: ${parts.join("; ")}`;
  }
  if (status === 401 || status === 403) return `${status}: rejected. The server has XAIKIT_API_TOKEN set — add the token in Server settings.`;
  return `${status}: ${typeof parsed === "string" && parsed ? parsed.slice(0, 200) : "request failed"}`;
}

/* ------------------------------- endpoints ------------------------------- */

export async function health(cfg: ApiConfig): Promise<{ status: string; studies?: number }> {
  return request(cfg, "/api/health");
}

export async function createStudy(cfg: ApiConfig, design: unknown, projectName?: string): Promise<CreatedStudy> {
  return request(cfg, "/api/studies", {
    method: "POST",
    body: JSON.stringify({ design, ...(projectName ? { project_name: projectName } : {}) }),
  });
}

export async function deleteStudy(cfg: ApiConfig, studyId: string): Promise<void> {
  await request(cfg, `/api/studies/${encodeURIComponent(studyId)}`, { method: "DELETE" });
}

export type StageName = "dataset" | "trials" | "explanations" | "simulate";

// Anything the design export already answers can be omitted, so the stage
// bodies are empty by default and the server reads the design.
export async function startStage(
  cfg: ApiConfig,
  studyId: string,
  stage: StageName,
  body: Record<string, unknown> = {}
): Promise<Job> {
  return request(cfg, `/api/studies/${encodeURIComponent(studyId)}/${stage}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getJob(cfg: ApiConfig, id: string, logTail = 200): Promise<Job> {
  return request(cfg, `/api/jobs/${encodeURIComponent(id)}`, { query: { log_tail: logTail } });
}

export function jobIdOf(job: Job): string {
  const id = job?.job_id ?? (job as { id?: string })?.id;
  if (!id) throw new ApiError("The server accepted the stage but returned no job id.", undefined, job);
  return String(id);
}

export function isTerminal(state: JobState | string | undefined): boolean {
  return state === "succeeded" || state === "failed" || state === "cancelled";
}

// Poll until the job leaves a running state. Resolves with the final job even
// when it failed — the caller decides how to report it.
export async function waitForJob(
  cfg: ApiConfig,
  id: string,
  opts: { intervalMs?: number; onTick?: (job: Job) => void; signal?: AbortSignal } = {}
): Promise<Job> {
  const interval = opts.intervalMs ?? 1500;
  for (;;) {
    if (opts.signal?.aborted) throw new ApiError("Run cancelled.");
    const job = await getJob(cfg, id);
    opts.onTick?.(job);
    if (isTerminal(job.state)) return job;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, interval);
      opts.signal?.addEventListener("abort", () => { clearTimeout(t); reject(new ApiError("Run cancelled.")); }, { once: true });
    });
  }
}

export interface ResultsPage {
  rows?: ResultRow[];
  results?: ResultRow[];
  total?: number;
  [k: string]: unknown;
}

export async function getResults(
  cfg: ApiConfig,
  studyId: string,
  q: { phase?: string; participant_id?: number; limit?: number; offset?: number } = {}
): Promise<ResultsPage> {
  return request(cfg, `/api/studies/${encodeURIComponent(studyId)}/results`, { query: q });
}

/**
 * Every result row — no cap.
 *
 * A run is participants × trials (60 × 30 = 1800 rows for a modest design), and
 * any limit silently drops later participants out of the trial viewer. Pages
 * until the server's `total` is reached; a short or empty page also ends it, so
 * this terminates even if `total` is missing.
 */
export async function getAllResults(
  cfg: ApiConfig,
  studyId: string,
  opts: { pageSize?: number } = {}
): Promise<{ rows: ResultRow[]; total: number }> {
  const pageSize = opts.pageSize ?? 2000;
  const out: ResultRow[] = [];
  let total = 0;
  for (let offset = 0; ; offset += pageSize) {
    const page = await getResults(cfg, studyId, { limit: pageSize, offset });
    const rows = rowsOf(page);
    if (typeof page.total === "number") total = page.total;
    out.push(...rows);
    if (rows.length < pageSize) break; // short/empty page = last page
    if (total && out.length >= total) break;
  }
  return { rows: out, total: total || out.length };
}

// The server returns the rows under one of a few plausible keys; find the array.
export function rowsOf(page: ResultsPage | undefined): ResultRow[] {
  if (!page) return [];
  if (Array.isArray(page)) return page as unknown as ResultRow[];
  for (const k of ["rows", "results", "data", "records"]) {
    const v = (page as Record<string, unknown>)[k];
    if (Array.isArray(v)) return v as ResultRow[];
  }
  return [];
}

export function resultsCsvUrl(cfg: ApiConfig, studyId: string, q: { phase?: string; participant_id?: number } = {}): string {
  return apiUrl(cfg, `/api/studies/${encodeURIComponent(studyId)}/results.csv`, q);
}

// The CSV endpoint needs the bearer header when the server is tokened, so it is
// fetched rather than linked, then handed to the browser as a blob.
export async function downloadResultsCsv(cfg: ApiConfig, studyId: string, filename = "results.csv"): Promise<void> {
  let res: Response;
  try {
    res = await fetch(resultsCsvUrl(cfg, studyId), { headers: headers(cfg, false) });
  } catch (e) {
    throw new ApiError(`Could not reach the study server at ${cfg.baseUrl || DEFAULT_API_BASE}.`, undefined, e);
  }
  if (!res.ok) throw new ApiError(`${res.status}: could not download the results CSV.`, res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function runAnalysis(
  cfg: ApiConfig,
  studyId: string,
  body: { ivs?: string[]; dvs?: string[] } = {}
): Promise<unknown> {
  return request(cfg, `/api/studies/${encodeURIComponent(studyId)}/analysis`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Pairwise post-hoc comparisons between crossed conditions, with the chosen
// multiple-comparison correction. `dv` is required; condition columns default
// to every IV the design declares.
export async function runPostHoc(
  cfg: ApiConfig,
  studyId: string,
  body: { dv: string; condition_cols?: string[]; correction?: string | null; phase?: string }
): Promise<unknown> {
  return request(cfg, `/api/studies/${encodeURIComponent(studyId)}/posthoc`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* ----------------------------- DV columns -------------------------------- */

// Columns that identify or describe a trial rather than measure an outcome.
const NON_DV_COLUMNS = new Set([
  "participantid", "trialid", "block", "trialwithinblock", "withincondition", "xai_type",
  "dataid", "instanceid", "phase", "phasetrialid", "shown_xai_type", "tested_w_xai",
  "step", "condition_name", "explanation_type", "selected_strategy",
  "ai_prediction", "agent_prediction",
]);

// The measurable columns actually present in a run's results. These are the
// names /analysis and /posthoc accept — the design's DV labels are prose and
// the DV catalog's ids are neither, so only the data can answer this.
export function dvColumnsOf(rows: ResultRow[]): string[] {
  if (!rows.length) return [];
  const seen: string[] = [];
  for (const r of rows.slice(0, 50)) for (const k of Object.keys(r)) if (!seen.includes(k)) seen.push(k);
  return seen.filter(
    (c) => !NON_DV_COLUMNS.has(c.toLowerCase()) && rows.some((r) => typeof r[c] === "number" || typeof r[c] === "boolean")
  );
}

/**
 * Map a design's DV label onto the results column it refers to —
 * "Counterfactual-Simulation Accuracy" -> "counterfactual_accuracy" — by
 * scoring shared words. Returns "" when nothing matches well enough, so the
 * caller can fall back rather than send a name the server will reject.
 */
export function matchDvColumn(displayName: string, columns: string[]): string {
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const want = new Set(words(displayName));
  if (!want.size) return "";
  let best = "";
  let bestScore = 0;
  for (const c of columns) {
    const have = words(c);
    if (!have.length) continue;
    const hits = have.filter((w) => want.has(w)).length;
    const score = hits / have.length;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  // Demand a strong overlap: a generic word in common ("accuracy") would
  // otherwise match "Forward-Simulation Accuracy" to counterfactual_accuracy.
  // No match is safe — the caller falls back and the dropdown stays available.
  return bestScore >= 0.75 ? best : "";
}

/* ------------------------- statistics as tables --------------------------- */

export interface SimpleTable {
  label: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

const isFlatObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

// Reading order for a statistics table: what was compared, which test, then the
// effect (means and their differences) and the p-values, then everything else.
const COLUMN_RANKS: [RegExp, number][] = [
  [/^(dv|iv|factor|variable|measure)([_ -](label|name))?$/i, 0],
  // …and their pretty twins: condition_a_label, group_b_name, …
  [/^(condition|conditions|group|level|pair|contrast|comparison|cond)([_ -]?[ab12])?([_ -](label|name))?$/i, 0],
  [/^(a|b|left|right)$/i, 0],
  [/^phase$/i, 0],
  [/^(test|test_name|method|statistic_name|correction|alternative|tail)$/i, 1],
  // 2: the difference itself, then 3: the means/effect sizes it came from.
  [/(mean|median)?[_ -]?(diff|difference|delta)/i, 2],
  [/^(effect|effect_size|cohen|hedges|eta[_-]?sq|omega[_-]?sq)/i, 2],
  [/^(mean|median|md|ci[_-]?(low|high|lower|upper))/i, 3],
  [/(^p$|^p[_-]?(value|val|adj|adjusted|corr|corrected|holm|raw|bonf)|significant|reject|alpha)/i, 4],
];

/**
 * Drop a raw column when a readable twin exists — "condition_a" next to
 * "condition_a_label" is the same information twice, and the label is the one
 * worth the width.
 */
export function dropRedundantColumns(columns: string[]): string[] {
  const present = new Set(columns);
  return columns.filter((c) => !present.has(`${c}_label`) && !present.has(`${c}_name`));
}

export function orderStatColumns(columns: string[]): string[] {
  const rank = (c: string) => {
    for (const [re, r] of COLUMN_RANKS) if (re.test(c)) return r;
    return 5;
  };
  // Stable within a rank, so the server's own ordering is otherwise kept.
  return columns
    .map((c, i) => ({ c, r: rank(c), i }))
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map((x) => x.c);
}

/**
 * Find every array-of-records in a response and turn it into a table.
 *
 * The analysis and post-hoc payloads are untyped server-side, so nothing here
 * assumes particular column names: whatever keys the records carry become the
 * columns, in first-seen order. That way the table follows the server rather
 * than a guess about its schema.
 */
// Raw per-row dumps that ride along with the statistics — useful to the server,
// far too long to render as a table.
const SKIP_TABLE_KEYS = new Set(["participant_level_data", "participant_data", "raw_data", "raw"]);

// When a requested DV isn't one the cognitive model can produce, the server
// coerces the analysis to `forward_accuracy` and marks the entry with these —
// metadata about the analysis, not a statistic, so it's kept out of the table
// and surfaced instead as a banner (see dvCoercionWarnings below).
const DV_COERCION_KEYS = new Set(["coerced", "warning", "coercion_warning"]);

const prettyKey = (k: string) => k.replace(/_/g, " ");
const joinLabel = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ");

export function tablesFrom(data: unknown, label = "", depth = 0): SimpleTable[] {
  if (depth > 4 || data === null || data === undefined) return [];

  if (Array.isArray(data)) {
    const records = data.filter(isFlatObject);
    if (!records.length || records.length !== data.length) return [];
    const columns: string[] = [];
    for (const r of records) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
    const scalar = columns.filter((c) => !DV_COERCION_KEYS.has(c) && records.every((r) => !isFlatObject(r[c]) && !Array.isArray(r[c])));

    const out: SimpleTable[] = [];
    if (scalar.length) {
      out.push({ label, columns: orderStatColumns(dropRedundantColumns(scalar)), rows: records });
    }
    // Records can carry their own nested payloads — an /analysis entry holds
    // `descriptives` and `inferential.table` — so recurse rather than dropping
    // them, naming each by the IV/DV it belongs to.
    for (const c of columns.filter((k) => !scalar.includes(k))) {
      if (SKIP_TABLE_KEYS.has(c)) continue;
      for (const r of records) {
        const owner = [r.iv_label ?? r.iv, r.dv_label ?? r.dv].filter(Boolean).join(" × ");
        // For a nested object, let its own keys name the table; for an array the
        // key is the name.
        const childLabel = Array.isArray(r[c]) ? joinLabel(owner, prettyKey(c)) : owner;
        out.push(...tablesFrom(r[c], childLabel, depth + 1));
      }
    }
    return out;
  }

  if (isFlatObject(data)) {
    const out: SimpleTable[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (SKIP_TABLE_KEYS.has(k)) continue;
      out.push(...tablesFrom(v, joinLabel(label, prettyKey(k)), depth + 1));
    }
    return out;
  }
  return [];
}

export interface DvCoercionNotice {
  dv?: string;
  message: string;
}

/**
 * Walk an /analysis response for entries the server marked `coerced: true`
 * (a requested DV the cognitive model can't produce, substituted with one it
 * can — currently always `forward_accuracy`) and surface the warning text
 * that rides along with it. Independent of tablesFrom: DV_COERCION_KEYS keeps
 * these two fields out of the rendered stat tables, this is what puts them in
 * front of the user instead.
 */
export function dvCoercionWarnings(data: unknown, depth = 0): DvCoercionNotice[] {
  if (!data || depth > 4) return [];
  const out: DvCoercionNotice[] = [];
  if (Array.isArray(data)) {
    for (const v of data) out.push(...dvCoercionWarnings(v, depth + 1));
  } else if (isFlatObject(data)) {
    if (data.coerced === true) {
      const rawMsg = data.warning ?? data.coercion_warning;
      const message = typeof rawMsg === "string" && rawMsg.trim()
        ? rawMsg
        : "A dependent variable in this analysis isn't one the cognitive model can produce, so the server substituted a measure it can — the table above reports that substitute, not the DV as named.";
      const dv = typeof data.dv === "string" ? data.dv : typeof data.dv_label === "string" ? data.dv_label : undefined;
      out.push({ dv, message });
    }
    for (const v of Object.values(data)) out.push(...dvCoercionWarnings(v, depth + 1));
  }
  // De-dupe: the same coerced entry is often reachable via more than one path
  // (e.g. nested under both `analyses` and a per-IV breakdown).
  const seen = new Set<string>();
  return out.filter((n) => {
    const key = `${n.dv ?? ""}::${n.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Compact cell text: keep p-values readable, round long floats, avoid "[object Object]".
export function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    if (Math.abs(v) < 0.0001 && v !== 0) return v.toExponential(1);
    return String(Math.round(v * 10000) / 10000);
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/* --------------------------------- plots --------------------------------- */

// The plot endpoints return the participant-level aggregate the plot helpers
// drew (mean / std / sem / count per cell); include_png also renders the figure
// server-side and returns it base64-encoded.
export interface PlotResponse {
  png?: string;
  aggregate?: unknown;
  [k: string]: unknown;
}

export async function plotGrid(
  cfg: ApiConfig,
  studyId: string,
  body: { ivs?: string[]; dvs?: string[]; phase?: string; errorbar?: string; title?: string; include_png?: boolean } = {}
): Promise<PlotResponse> {
  return request(cfg, `/api/studies/${encodeURIComponent(studyId)}/plots/grid`, {
    method: "POST",
    body: JSON.stringify({ include_png: true, ...body }),
  });
}

export async function plotInteraction(
  cfg: ApiConfig,
  studyId: string,
  body: { x_iv: string; hue_iv: string; dv: string; phase?: string; errorbar?: string; title?: string; include_png?: boolean }
): Promise<PlotResponse> {
  return request(cfg, `/api/studies/${encodeURIComponent(studyId)}/plots/interaction`, {
    method: "POST",
    body: JSON.stringify({ include_png: true, ...body }),
  });
}

const PNG_KEYS = ["png", "png_base64", "image", "image_png", "figure", "figures", "pngs", "images", "plots"];

/**
 * Every base64 PNG in a plot response, as data: URIs ready for <img src>.
 *
 * Returns a list rather than one image so a response that grows to several
 * figures — `{figures: [...]}` or `{plots: [{png: …}]}` — renders without
 * further changes here.
 */
export function pngDataUris(plot: unknown, depth = 0): string[] {
  if (!plot || depth > 3) return [];
  const out: string[] = [];
  const asUri = (v: string) => (v.startsWith("data:") ? v : `data:image/png;base64,${v}`);
  const visit = (v: unknown) => {
    if (typeof v === "string" && v.length > 100) out.push(asUri(v));
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") out.push(...pngDataUris(v, depth + 1));
  };
  for (const k of PNG_KEYS) visit((plot as Record<string, unknown>)[k]);
  return out;
}

export function pngDataUri(plot: PlotResponse | undefined): string | null {
  return pngDataUris(plot)[0] ?? null;
}

/* ------------------------------ trial view ------------------------------- */

// One trial as the trial-by-trial renderer needs it. The explanation preview is
// not here yet: the server has no endpoint that returns the explanation a trial
// was actually simulated with (/explanations writes them to disk, nothing reads
// them back), so the preview stays empty until that endpoint exists.
export interface TrialPrediction {
  prediction: string;
  confidence: number | null;
}

export interface TrialView {
  instanceId: string;
  trialId: string;
  phase: string;
  step: string;
  participantId: string;
  condition: string;
  datasetId: string; // dataId — the corpus the instance belongs to
  xaiType: string; // the condition's assigned XAI type
  shownXaiType: string; // the condition's explanation type (never "none")
  explanationType: string; // "dt" / "lr" / "none" — what was actually rendered
  testedWithXai: boolean | null; // tested_w_xai; null on training rows (always with XAI)
  xaiProperty: string; // Sim2Real only: faithful / sparse / robust / sparse_robust
  // Sim2Real asks "does it increase?", so 0/1 are Lower/Higher rather than classes.
  answerKind: "class" | "direction";
  simulation: TrialPrediction | null;
  human: TrialPrediction | null;
  ai: TrialPrediction | null;
  actual: string; // dataset ground truth — absent in forward-simulation designs
  probCorrect: number | null;
  matchesAi: boolean | null;
  predTime: number | null;
}

// Result rows are untyped server-side, so every field is looked up across the
// plausible spellings and simply reported missing when none of them hit.
function pick(row: ResultRow, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]));
  for (const k of keys) {
    const hit = lower.get(k.toLowerCase());
    if (hit && row[hit] !== undefined && row[hit] !== null && row[hit] !== "") return row[hit];
  }
  return undefined;
}

function asText(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

// Confidence arrives either as a probability (0–1) or already as a percentage.
function asConfidence(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return null;
  return n <= 1 && n >= 0 ? n * 100 : n;
}

function predictionOf(row: ResultRow, predKeys: string[], confKeys: string[]): TrialPrediction | null {
  const prediction = asText(pick(row, predKeys));
  const confidence = asConfidence(pick(row, confKeys));
  if (!prediction && confidence === null) return null;
  return { prediction, confidence };
}

// Values that name no real condition — CoAX writes this even for a three-level
// design, where the manipulation actually lives in xai_type.
const PLACEHOLDER_CONDITIONS = new Set(["single_condition", "single", "default", "all", "n/a", "none_condition"]);

function asNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

// Column names below are the ones a real run emits (agent_prediction,
// ai_prediction, prob_correct, cognitive_correct_vs_ai, pred_time, instanceId,
// …); the extra spellings are fallbacks for the other participant runners,
// whose rows are shaped by their own study code.
export function trialViewOf(row: ResultRow): TrialView {
  return {
    instanceId: asText(pick(row, ["instanceId", "instance_id", "instance", "instance_index"])),
    trialId: asText(pick(row, ["trialId", "trial_id", "phaseTrialId"])),
    phase: asText(pick(row, ["phase"])),
    step: asText(pick(row, ["step", "step_name", "stage"])),
    participantId: asText(pick(row, ["participantId", "participant_id", "participant"])),
    // The runner's own condition name when it has one; otherwise the XAI type,
    // which is the actual manipulation. `withinCondition` is last because CoAX
    // fills it with the placeholder "single_condition" even when the design has
    // three conditions.
    condition: (() => {
      const named = asText(pick(row, ["condition_name"]));
      if (named) return named;
      // Sim2Real manipulates the explanation property instead of the XAI type.
      const xai = asText(pick(row, ["xai_type", "shown_xai_type", "xai_property", "exp_property"]));
      if (xai) return xai;
      const within = asText(pick(row, ["withinCondition"]));
      return PLACEHOLDER_CONDITIONS.has(within.toLowerCase()) ? "" : within;
    })(),
    datasetId: asText(pick(row, ["dataId", "dataset_id", "dataset", "appId"])),
    xaiType: asText(pick(row, ["xai_type"])),
    shownXaiType: asText(pick(row, ["shown_xai_type", "shownXaiType"])),
    explanationType: asText(pick(row, ["explanation_type", "explanationType"])),
    testedWithXai: (() => {
      // pick() skips null/""; read the key directly so false is not lost.
      const v = row.tested_w_xai ?? row.testedWithXai;
      if (typeof v === "boolean") return v;
      if (v === null || v === undefined || v === "") return null;
      return String(v).toLowerCase() === "true" || String(v) === "1";
    })(),
    // Sim2Real answers a direction (agent_response_increases) rather than a
    // class, and reports it as a probability rather than a confidence.
    simulation: predictionOf(
      row,
      ["agent_prediction", "agent_response_increases", "sim_prediction", "simulated_prediction", "cognitive_prediction", "user_prediction", "prediction"],
      ["agent_confidence", "probability_income_increases", "sim_confidence", "cognitive_confidence", "user_confidence", "confidence"]
    ),
    // Only present when the server has the human study data mounted — it is
    // excluded from the deployed image by design.
    human: predictionOf(row, ["human_prediction", "human_pred", "human_label"], ["human_confidence", "human_conf"]),
    // For Sim2Real the reference the participant is predicting IS the model's
    // own behaviour, recorded as ground_truth_increases.
    ai: predictionOf(
      row,
      ["ai_prediction", "ai_pred", "model_prediction", "ai_label", "ground_truth_increases"],
      ["ai_confidence", "ai_probability", "ai_prob", "model_confidence"]
    ),
    // Forward-simulation designs have no dataset label in the results: the task
    // is to predict the AI, so the AI prediction is the reference.
    actual: asText(pick(row, ["ground_truth", "actual", "true_label", "y_true", "target"])),
    xaiProperty: asText(pick(row, ["exp_property", "xai_property"])),
    answerKind: row.agent_response_increases !== undefined || row.ground_truth_increases !== undefined ? "direction" : "class",
    probCorrect: asConfidence(pick(row, ["prob_correct", "p_correct"])),
    matchesAi: (() => {
      const v = pick(row, ["cognitive_correct_vs_ai", "agrees_with_ai", "matches_ai", "counterfactual_correct"]);
      if (typeof v === "boolean") return v;
      if (v === undefined) return null;
      const s = String(v).toLowerCase();
      return s === "true" || s === "1";
    })(),
    predTime: asNumber(pick(row, ["pred_time", "response_time", "rt"])),
  };
}

/* ------------------------------ the pipeline ------------------------------ */

export type SimulationMode = "trial_by_trial" | "participant_by_participant" | "whole_condition" | "whole_experiment";

export interface SimulateOptions {
  mode?: SimulationMode;
  participant_id?: number;
  condition_filter?: Record<string, unknown>;
  coax_params?: Record<string, unknown>;
  coax_strategies?: Record<string, unknown>;
  coxam_eval_params?: Record<string, unknown>;
  sim2real_params?: Record<string, unknown>;
  [k: string]: unknown;
}

// Which participant runner the server will use. Mirrors
// DesignExport.resolved_framework: a Sim2Real design's cognitive model is a
// CoAX-derived attribution sum, so "CoAX" + an xai_property IV is a Sim2Real
// run, and "CoAX (XAI Property)" is the UI's own label for the same thing.
export type StudyFramework = "coax" | "coxam" | "sim2real" | "baseline";

export function frameworkFor(userModel: string, hasXaiPropertyIv: boolean): StudyFramework {
  const m = (userModel || "").trim();
  if (m === "CoAX (XAI Property)" || m === "Sim2Real") return "sim2real";
  if (m === "CoXAM") return "coxam";
  if (m === "CoAX") return (hasXaiPropertyIv ? "sim2real" : "coax");
  return "baseline";
}

/**
 * Build the /simulate body for a design. The server resolved and coerced the
 * design's cognitiveConfig when the study was created, but /simulate does not
 * read those values back — they have to be repeated here or the agent silently
 * runs on its defaults. The server accepts either its own parameter names or
 * the UI's display labels, so the config is forwarded as-is.
 *
 * CoAX is the exception: its parameters are nested per (xai_type,
 * tested_w_xai) condition, so a flat config cannot be forwarded at all.
 */
export function simulateOptionsFor(
  userModel: string,
  hasXaiPropertyIv: boolean,
  cogConfig: Record<string, string>,
  mode: SimulationMode = "whole_experiment"
): { framework: StudyFramework; options: SimulateOptions; warning?: string } {
  const framework = frameworkFor(userModel, hasXaiPropertyIv);
  const values = Object.fromEntries(Object.entries(cogConfig || {}).filter(([, v]) => String(v ?? "").trim() !== ""));
  const hasValues = Object.keys(values).length > 0;
  const options: SimulateOptions = { mode };

  if (framework === "coxam" && hasValues) options.coxam_eval_params = values;
  else if (framework === "sim2real" && hasValues) options.sim2real_params = values;
  else if (framework === "baseline") options.baseline_model_id = userModel.trim();

  const warning =
    framework === "coax" && hasValues
      ? "CoAX cognitive parameters are nested per condition on the server, so the flat values set on the User Model page can't be forwarded — this run uses the fitted CoAX defaults."
      : undefined;

  return { framework, options, warning };
}

export type StageStatus = "pending" | "running" | "succeeded" | "failed";

export interface StageProgress {
  stage: StageName | "create" | "collect";
  label: string;
  status: StageStatus;
  jobId?: string;
  elapsed?: number;
  log?: string;
  error?: string;
}

export const PIPELINE: { stage: StageName; label: string }[] = [
  { stage: "dataset", label: "Prepare dataset & train AI model" },
  { stage: "trials", label: "Generate trials" },
  { stage: "explanations", label: "Generate explanations" },
  { stage: "simulate", label: "Run virtual participants" },
];

export interface RunHandlers {
  onStages?: (stages: StageProgress[]) => void;
  onStudyId?: (studyId: string) => void;
  signal?: AbortSignal;
}

export interface RunOutcome {
  studyId: string;
  created: CreatedStudy;
  stages: StageProgress[];
  results: ResultRow[];
  analysis?: unknown;
  plot?: PlotResponse;
}

/**
 * Send the finalized design to the server, walk every stage to completion, then
 * collect what the run produced: result rows, the analysis, and the plot the
 * server rendered. Called only from the Run experiment button.
 *
 * `simulateOptions` must already carry the cognitive parameters: the server
 * does NOT read a design's cognitiveConfig at simulate time, so the values have
 * to be repeated on the /simulate request body.
 */
export async function runStudy(
  cfg: ApiConfig,
  design: unknown,
  simulateOptions: SimulateOptions,
  handlers: RunHandlers = {},
  stageBodies: Partial<Record<StageName, Record<string, unknown>>> = {}
): Promise<RunOutcome> {
  const stages: StageProgress[] = [
    { stage: "create", label: "Send design & validate", status: "pending" },
    ...PIPELINE.map((s) => ({ ...s, status: "pending" as StageStatus })),
    { stage: "collect", label: "Collect results, analysis & plots", status: "pending" },
  ];
  const emit = () => handlers.onStages?.(stages.map((s) => ({ ...s })));
  const at = (name: StageProgress["stage"]) => stages.find((s) => s.stage === name)!;
  const fail = (s: StageProgress, e: unknown): never => {
    s.status = "failed";
    s.error = e instanceof Error ? e.message : String(e);
    emit();
    throw e;
  };

  // 1. the design itself
  const create = at("create");
  create.status = "running";
  emit();
  let created: CreatedStudy;
  try {
    created = await createStudy(cfg, design);
  } catch (e) {
    return fail(create, e);
  }
  const studyId = String(created?.study_id ?? "");
  if (!studyId) return fail(create, new ApiError("The server created the study but returned no study_id.", undefined, created));
  create.status = "succeeded";
  emit();
  handlers.onStudyId?.(studyId);

  // 2. every stage in order — each is a background job on the server
  for (const { stage } of PIPELINE) {
    if (handlers.signal?.aborted) throw new ApiError("Run cancelled.");
    const s = at(stage);
    s.status = "running";
    emit();
    try {
      const body = stage === "simulate"
        ? { ...(stageBodies.simulate || {}), ...(simulateOptions as Record<string, unknown>) }
        : (stageBodies[stage] || {});
      const started = await startStage(cfg, studyId, stage, body);
      const id = jobIdOf(started);
      s.jobId = id;
      emit();
      const done = await waitForJob(cfg, id, {
        signal: handlers.signal,
        onTick: (j) => {
          if (typeof j.elapsed === "number") s.elapsed = j.elapsed;
          if (typeof j.log === "string") s.log = j.log;
          emit();
        },
      });
      if (done.state !== "succeeded") {
        return fail(s, new ApiError(String(done.error || `${stage} ${done.state}`), undefined, done));
      }
      s.status = "succeeded";
      emit();
    } catch (e) {
      return fail(s, e);
    }
  }

  // 3. what the run produced. A failure here is not a failed run — the study
  //    finished and the CSV endpoint still works — so each part is best-effort.
  const collect = at("collect");
  collect.status = "running";
  emit();
  let results: ResultRow[] = [];
  let analysis: unknown;
  let plot: PlotResponse | undefined;
  const problems: string[] = [];
  try {
    results = (await getAllResults(cfg, studyId)).rows;
  } catch (e) {
    problems.push(`results: ${(e as Error).message}`);
  }
  try {
    analysis = await runAnalysis(cfg, studyId);
  } catch (e) {
    problems.push(`analysis: ${(e as Error).message}`);
  }
  try {
    plot = await plotGrid(cfg, studyId, { include_png: true });
  } catch (e) {
    problems.push(`plots: ${(e as Error).message}`);
  }
  collect.status = "succeeded";
  if (problems.length) collect.error = problems.join(" · ");
  emit();

  return { studyId, created, stages, results, analysis, plot };
}
