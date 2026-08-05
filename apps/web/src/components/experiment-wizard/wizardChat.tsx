"use client";

import React, { useState, useRef, useEffect } from "react";
import { Wand2, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT } from "./wizardUi";
import {
  Page, Answers, PAGES,
  parseIvs, parseVars, varsSummary, parseDvs, dvSummary, dvDisplayName,
  parseProcSteps, procStepsSummary,
  normalizeIvSpecs, normalizeDvSpecs, normalizeVarSpecs, normalizeProcSpecs,
  totalCells, mlProxyNames, cogConfigSummary, IvEntry,
  parseApparatusList, normalizeApparatusEntry,
} from "./questions";

export const GLOBAL_OPENING =
  "Hi! I'm your XAI experiment-design assistant. We'll build this together across the sections on the left — start wherever you like, even with a rough idea. What research direction or question do you have in mind?";

export const ALL_FILLABLE = [
  "rq",
  "sd_dv", "sd_ivs", "sd_iv_agent", "sd_cv", "sd_rv",
  "ds_dataset", "sd_participants", "sd_trials",
  "apparatus_list",
  "proc_steps",
  "user_model",
  "ml_proxies",
  "cog_config",
];

export const APPLY_KEYS = new Set(ALL_FILLABLE);
// Keys whose APPLY value is a JSON array/object rather than a plain string.

export const STRUCTURED_APPLY = new Set(["sd_ivs", "sd_dv", "sd_cv", "sd_rv", "proc_steps", "ml_proxies", "cog_config", "apparatus_list"]);

export const OP_TARGETS = new Set(["sd_dv", "sd_ivs", "sd_cv", "sd_rv", "proc_steps", "apparatus_list"]);

export const OP_KINDS = new Set(["add", "update", "remove", "replace", "set"]);

export interface ApplyOp { target: string; op: string; index?: number; match?: string; value?: any; }

export interface ApplyPayload { updates: Record<string, string>; ops: ApplyOp[]; }

export function parseUpdates(text: string, allowed: Set<string>): { clean: string; payload: ApplyPayload | null } {
  const m = text.match(/@@APPLY@@([\s\S]*?)@@END@@/);
  const clean = text.replace(/@@APPLY@@[\s\S]*?@@END@@/g, "").trim();
  if (!m) return { clean, payload: null };
  try {
    const raw = JSON.parse(m[1].trim());
    const updates: Record<string, string> = {};
    for (const [k, val] of Object.entries(raw)) {
      if (k === "ops") continue;
      if (APPLY_KEYS.has(k) && allowed.has(k) && val != null) updates[k] = STRUCTURED_APPLY.has(k) ? JSON.stringify(val) : String(val);
    }
    const ops: ApplyOp[] = Array.isArray(raw.ops)
      ? raw.ops.filter((o: any) => o && OP_TARGETS.has(o.target) && allowed.has(o.target) && OP_KINDS.has(o.op))
      : [];
    const hasAny = Object.keys(updates).length || ops.length;
    return { clean, payload: hasAny ? { updates, ops } : null };
  } catch {
    return { clean, payload: null };
  }
}

export function ivAgentOf(a: Answers): string {
  return a.sd_iv_agent || (a.user_model === "CoXAM" ? "CoXAM" : a.user_model === "Sim2Real" ? "Sim2Real" : "CoAX");
}

export interface OpTargetCfg {
  parse: (a: Answers) => any[];
  write: (a: Answers, list: any[]) => Answers;
  match: (item: any, q: string) => boolean;
  build: (spec: any, a: Answers) => any | null;
  merge?: (existing: any, patch: any) => any; // custom update merge (default: shallow spread)
}

export const OP_CFG: Record<string, OpTargetCfg> = {
  sd_dv: {
    parse: (a) => parseDvs(a.sd_dv),
    write: (a, list) => ({ ...a, sd_dv: JSON.stringify(normalizeDvSpecs(list)) }),
    match: (it, q) => dvDisplayName(it).toLowerCase().includes(q),
    build: (v) => normalizeDvSpecs([v])[0] ?? null,
  },
  sd_cv: {
    parse: (a) => parseVars(a.sd_cv),
    write: (a, list) => ({ ...a, sd_cv: JSON.stringify(normalizeVarSpecs(list)) }),
    match: (it, q) => String(it.name || "").toLowerCase().includes(q),
    build: (v) => normalizeVarSpecs([v])[0] ?? null,
  },
  sd_rv: {
    parse: (a) => parseVars(a.sd_rv),
    write: (a, list) => ({ ...a, sd_rv: JSON.stringify(normalizeVarSpecs(list)) }),
    match: (it, q) => String(it.name || "").toLowerCase().includes(q),
    build: (v) => normalizeVarSpecs([v])[0] ?? null,
  },
  proc_steps: {
    parse: (a) => parseProcSteps(a.proc_steps),
    write: (a, list) => ({ ...a, proc_steps: JSON.stringify(normalizeProcSpecs(list)) }),
    match: (it, q) => String(it.title || "").toLowerCase().includes(q),
    build: (v) => normalizeProcSpecs([v])[0] ?? null,
  },
  sd_ivs: {
    parse: (a) => parseIvs(a),
    write: (a, list) => ({ ...a, sd_ivs: JSON.stringify(list), sd_conditions: String(totalCells(list as IvEntry[])) }),
    match: (it, q) => (String(it.label || "") + " " + String(it.factor || "")).toLowerCase().includes(q),
    build: (v, a) => normalizeIvSpecs([v], ivAgentOf(a))[0] ?? null,
  },
  apparatus_list: {
    parse: (a) => parseApparatusList(a),
    write: (a, list) => ({ ...a, apparatus_list: JSON.stringify(list) }),
    match: (it, q) => (String(it.label || "") + " " + String(it.group || "")).toLowerCase().includes(q),
    build: (v) => normalizeApparatusEntry(v),
    // Deep-merge params so an update like {params:{form:"DT"}} tweaks one setting
    // instead of wiping the entry's other params (instanceIds, elements, …).
    merge: (it, patch) => ({
      ...it,
      ...patch,
      params: { ...((it && it.params) || {}), ...((patch && patch.params) || {}) },
    }),
  },
};

export function applyOneOp(a: Answers, op: ApplyOp): Answers {
  const cfg = OP_CFG[op.target];
  if (!cfg) return a;
  let list = cfg.parse(a);
  const findIdx = (): number => {
    if (op.index != null && !Number.isNaN(Number(op.index))) {
      const i = Math.round(Number(op.index)) - 1; // model uses 1-based positions
      return i >= 0 && i < list.length ? i : -1;
    }
    if (op.match) { const q = String(op.match).toLowerCase(); return list.findIndex((it) => cfg.match(it, q)); }
    return -1;
  };
  if (op.op === "add") {
    const items = Array.isArray(op.value) ? op.value : [op.value];
    list = [...list, ...items.map((v) => cfg.build(v, a)).filter((x) => x != null)];
  } else if (op.op === "remove") {
    const i = findIdx(); if (i >= 0) list = list.filter((_, idx) => idx !== i);
  } else if (op.op === "update") {
    const i = findIdx();
    if (i >= 0) {
      const merged = cfg.merge ? cfg.merge(list[i], op.value || {}) : { ...list[i], ...(op.value || {}) };
      const built = cfg.build(merged, a);
      if (built) list = list.map((it, idx) => (idx === i ? built : it));
    }
  } else if (op.op === "replace" || op.op === "set") {
    const items = Array.isArray(op.value) ? op.value : [op.value];
    list = items.map((v) => cfg.build(v, a)).filter((x) => x != null);
  }
  return cfg.write(a, list);
}

export function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

export const FIELD_LABELS: Record<string, string> = {
  rq: "research question(s)",
  sd_dv: "dependent variables",
  sd_iv_agent: "model/framework",
  sd_cv: "control variables (CV)",
  sd_rv: "random variables (RV)",
  sd_participants: "number of participants",
  ds_dataset: "dataset",
  apparatus_list: "apparatus configurations (per group)",
  procedure: "experiment procedure",
  user_model: "user model",
};

// Per-page chat focus + the fields the assistant may fill while on that page.

export const PAGE_CHAT: Record<string, { focus: string; fields: string[] }> = {
  rq: {
    focus: "the research question(s)",
    fields: ["rq"],
  },
  studydesign: {
    focus: "the whole study design. You CAN set all of it: dependent variables via sd_dv (catalog measure id or a custom {measure:'custom', name, formula}), independent variables via sd_ivs (factor, levels, within/between, counterbalancing), control variables via sd_cv and random variables via sd_rv ({name, type}), the model/framework via sd_iv_agent, the dataset via ds_dataset, and participants via sd_participants and trials via sd_trials. Prefer incremental ops for the list fields (sd_dv, sd_ivs, sd_cv, sd_rv).",
    fields: ["sd_dv", "sd_ivs", "sd_cv", "sd_rv", "sd_iv_agent", "ds_dataset", "sd_participants", "sd_trials"],
  },
  apparatus: {
    focus: "the apparatus configurations. Each entry in apparatus_list is one interface setup assigned to a group of participants (by IV level, e.g. \"XAI Type = Importance\") or to \"All participants\". Use ops to add/update/remove entries. Each entry: { label, group, mode (\"ours\"|\"own\"), params for ours, or url for own }. params: { appId (adult|mushrooms|wine_quality|forest_cover|adult_sim2real — adult_sim2real is the Sim2Real study screen for XAI-Property designs; its params differ: expMethod carries the PROPERTY (faithful|sparse|robust|sparse_robust, default robust; the underlying method is always LIME), instanceIds 0-38, flags showDelta/showPrediction/showQuestion (default 1) and showFeedback (1 for training, default 0); no modelName or elements), form (attribution|importance|LR|DT — LR and DT use the global surrogate interface, the others the local one; the AI model is derived automatically), expMethod (shap|lime, local forms only), LRVariant (dense|sparse, LR only), DTDepth (2|3, DT only), DTEditor (1|0, DT only), instanceIds (comma/range list of trial instance IDs, e.g. \"0, 3, 7\" or \"0-9\" — local ranges: mushrooms 0-3938, wine_quality 0-121, adult/forest_cover 0-299; global always 0-399), elements (comma list of interface elements: instance,meters,xai,prediction,feedback,ground-truth,tutorial,sliders — instance/meters/feedback/ground-truth are local-only), focusOnImportant (1|0, local), userPrediction (none|0|1, local), showExplanationPrediction (1|0, global), recourseConfirm (1|0, global with sliders) }. When the design's IV is XAI Property, every apparatus entry must use appId adult_sim2real — one entry per property level for between-subjects designs. Ask which interface they want, which instance IDs to show, and which group each applies to.",
    fields: ["apparatus_list"],
  },
  procedure: {
    focus: "the step-by-step procedure. You CAN add, edit, reorder, and remove steps via proc_steps (each step is { title, note?, link?, attachment? }); prefer incremental ops. Help them think through the steps and how they map to the DVs.",
    fields: ["proc_steps"],
  },
  usermodel: {
    focus: "the user model and baselines. You CAN set them: user_model (the cognitive model id, e.g. \"CoAX\" or \"CoXAM\"), ml_proxies (a JSON array of comparison-baseline ids), and cog_config (a JSON object of cognitive-parameter values). Help the user choose from the list.",
    fields: ["user_model", "ml_proxies", "cog_config"],
  },
  review: {
    focus: "reviewing the overall design (there are no fields to fill on this page)",
    fields: [],
  },
};

export const ALL_CONTENT_KEYS = ["rq", "sd_iv_agent", "sd_participants", "ds_dataset", "apparatus_list", "user_model"];

export function buildChatContext(page: Page, a: Answers): string {
  const cfg = PAGE_CHAT[page.id] ?? { focus: "", fields: [] as string[] };
  const snip = (k: string, n = 120) => {
    const v = (a[k] || "").trim();
    return v ? (v.length > n ? v.slice(0, n) + "…" : v) : "(empty)";
  };

  // Whole-design awareness: a compact view of every section.
  const ivs = parseIvs(a);
  const ivLine = ivs.length ? ivs.map((e, i) => `IV${i + 1} ${e.label || "?"}=${e.levels || "?"} [${e.alloc === "Between-subjects" ? "between" : "within"}${e.balancing ? ", " + e.balancing : ""}]`).join("; ") : "(none yet)";
  const procSteps = parseProcSteps(a.proc_steps);
  const procLine = procSteps.length ? procStepsSummary(procSteps).join(" | ") : "(no steps yet)";
  const lines = ALL_CONTENT_KEYS.map((k) => `- ${FIELD_LABELS[k] ?? k}: ${snip(k)}`);
  lines.splice(1, 0, `- dependent variables: ${dvSummary(parseDvs(a.sd_dv)) || "(empty)"}`);
  lines.push(`- control variables (CV): ${varsSummary(parseVars(a.sd_cv)) || "(empty)"}`);
  lines.push(`- random variables (RV): ${varsSummary(parseVars(a.sd_rv)) || "(empty)"}`);
  lines.push(`- independent variables: ${ivLine}`);
  lines.push(`- procedure steps: ${procLine}`);
  lines.push(`- comparison baselines: ${mlProxyNames(a) || "(none)"}`);
  lines.push(`- cognitive config: ${cogConfigSummary(a) || "(defaults)"}`);
  const overview = lines.join("\n");

  const pageFields = cfg.fields.length ? cfg.fields.join(", ") : "(this page's structure is edited in the UI)";
  const idx = PAGES.findIndex((p) => p.id === page.id);
  const order = PAGES.map((p) => p.navTitle).join(" → ");
  const nextPage = idx >= 0 && idx < PAGES.length - 1 ? PAGES[idx + 1].navTitle : null;

  return [
    `Whole design so far (all sections):\n${overview}`,
    `Section order (ALWAYS follow this when moving on — do not skip or reorder): ${order}.`,
    `Current page: ${page.navTitle}.${nextPage ? ` When this page is done, the next section is "${nextPage}" — guide the user there, not any other section.` : " This is the last section."}`,
    `This page covers: ${cfg.focus}`,
    `You can fill in or MODIFY any field in the whole form via the APPLY block — not just the current page. For structured fields (sd_dv, sd_ivs, sd_cv, sd_rv, proc_steps) prefer incremental ops (add/update/remove one item).`,
    `The current page is mainly about: ${pageFields}. Prioritise helping with that, but follow the user wherever they go.`,
  ].join("\n\n");
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel({ messages, setMessages, allowedFields, context, onApplyUpdates }: { messages: ChatMsg[]; setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>; allowedFields: string[]; context: string; onApplyUpdates: (p: ApplyPayload) => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const contextRef = useRef(context);
  contextRef.current = context;
  const allowedRef = useRef(new Set(allowedFields));
  allowedRef.current = new Set(allowedFields);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-grow the input to fit its text (capped; scrolls beyond the cap).
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

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
      const { clean, payload } = parseUpdates(acc, allowedRef.current);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: clean || "Done." };
        return copy;
      });
      if (payload) onApplyUpdates(payload);
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
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Describe your study, or answer the assistant…"
            className="max-h-40 flex-1 resize-none overflow-y-auto rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
          <button onClick={send} disabled={loading || !input.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }} aria-label="Send">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
