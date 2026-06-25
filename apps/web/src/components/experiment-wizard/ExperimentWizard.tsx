"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Check, Loader2, Send, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { PAGES, Answers, isPageComplete, validateParticipants } from "./questions";

const STORAGE_KEY = "experiment-interview-v1";
const ACCENT = "#359793";
const SERIF = 'Georgia, Cambria, "Times New Roman", serif';

const SECTIONS = [
  { id: "overview", title: "Overview" },
  { id: "rq", title: "Research Questions" },
  { id: "studydesign", title: "Study Design" },
  { id: "dataset", title: "Dataset & Agent" },
];

function pageById(id: string) {
  return PAGES.find((p) => p.id === id)!;
}

export function ExperimentWizard() {
  const [answers, setAnswers] = useState<Answers>({});
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

  function applyUpdates(updates: Record<string, string>) {
    setAnswers((a) => ({ ...a, ...updates }));
  }

  function scrollToSection(id: string) {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 text-neutral-900">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-7 w-7 place-items-center rounded-md text-white" style={{ backgroundColor: ACCENT }}>
            <FileText className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Experiment Designer</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 pb-4">
          {SECTIONS.map((s) => {
            const done = isPageComplete(pageById(s.id), answers);
            return (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50"
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]",
                    done ? "border-transparent text-white" : "border-neutral-300 text-neutral-400"
                  )}
                  style={done ? { backgroundColor: ACCENT } : undefined}
                >
                  {done ? <Check className="h-3 w-3" /> : ""}
                </span>
                <span className="flex-1 truncate text-neutral-700">{s.title}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Document (items) + Chat side by side */}
      <main className="flex min-w-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto bg-neutral-50">
          <DocumentView answers={answers} />
        </div>
        <div className="hidden w-[26rem] shrink-0 border-l border-neutral-200 md:flex">
          <ChatPanel context={buildChatContext(answers)} onApplyUpdates={applyUpdates} />
        </div>
      </main>
    </div>
  );
}

/* ----------------------------- Living document view ----------------------------- */

function Empty() {
  return <span className="text-neutral-300">Not provided yet</span>;
}

function Section({ id, title, done, children }: { id: string; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section id={`sec-${id}`} className="scroll-mt-4 border-t border-neutral-200 pt-6">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <span
          className={cn("grid h-4 w-4 place-items-center rounded-full text-[9px]", done ? "text-white" : "border border-neutral-300 text-neutral-300")}
          style={done ? { backgroundColor: ACCENT } : undefined}
        >
          {done ? <Check className="h-2.5 w-2.5" /> : ""}
        </span>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  const v = (value || "").trim();
  return (
    <div className="grid grid-cols-[170px_1fr] gap-3 py-1.5 text-[15px]">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900">{v ? v : <Empty />}</span>
    </div>
  );
}

function DocumentView({ answers }: { answers: Answers }) {
  const a = answers;
  const has = (k: string) => (a[k] || "").trim().length > 0;
  const check = validateParticipants(a);
  const checkColor =
    check?.level === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : check?.level === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-sky-200 bg-sky-50 text-sky-800";
  const ivText = [a.sd_iv, a.sd_iv_agent ? `(${a.sd_iv_agent})` : ""].filter(Boolean).join(" ");

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10" style={{ fontFamily: SERIF }}>
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Experiment Design</h1>
        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
          Draft
        </span>
      </div>
      <p className="mb-6 text-sm text-neutral-400" style={{ fontFamily: "ui-sans-serif, system-ui" }}>
        Tell the assistant on the right about your study — this document fills in as you chat.
      </p>

      <div className="space-y-6">
        <Section id="overview" title="Overview" done={isPageComplete(pageById("overview"), a)}>
          {has("overview") ? <p className="leading-7 text-[15px] text-neutral-800">{a.overview}</p> : <Empty />}
        </Section>

        <Section id="rq" title="Research Questions" done={isPageComplete(pageById("rq"), a)}>
          {has("rq") ? <p className="whitespace-pre-wrap leading-7 text-[15px] text-neutral-800">{a.rq}</p> : <Empty />}
        </Section>

        <Section id="studydesign" title="Study Design, Variables & Participants" done={isPageComplete(pageById("studydesign"), a)}>
          <Row label="Dependent variable(s)" value={a.sd_dv} />
          <Row label="Independent variable" value={ivText} />
          <Row label="IV levels / range" value={a.sd_iv_levels} />
          <Row label="Control variables" value={a.sd_cv} />
          <Row label="Design type" value={a.sd_design} />
          <Row label="Counterbalancing" value={a.sd_balancing} />
          <Row label="Conditions / cells" value={a.sd_conditions} />
          <Row label="Participants (N)" value={a.sd_participants} />
          {check ? (
            <div className={cn("mt-3 rounded-lg border px-3 py-2 text-sm", checkColor)} style={{ fontFamily: "ui-sans-serif, system-ui" }}>
              {check.message}
            </div>
          ) : null}
        </Section>

        <Section id="dataset" title="Dataset & Agent" done={isPageComplete(pageById("dataset"), a)}>
          <Row label="Agent under evaluation" value={a.ds_agent} />
          <Row label="Dataset / trial config" value={a.ds_dataset} />
        </Section>
      </div>
    </div>
  );
}

/* ----------------------------- Chat panel (right column) ----------------------------- */

const APPLY_KEYS = new Set([
  "overview",
  "rq",
  "sd_dv",
  "sd_iv_agent",
  "sd_iv",
  "sd_iv_levels",
  "sd_cv",
  "sd_conditions",
  "sd_design",
  "sd_balancing",
  "sd_participants",
  "ds_agent",
  "ds_dataset",
]);

function parseUpdates(text: string): { clean: string; updates: Record<string, string> | null } {
  const m = text.match(/@@APPLY@@([\s\S]*?)@@END@@/);
  const clean = text.replace(/@@APPLY@@[\s\S]*?@@END@@/g, "").trim();
  if (!m) return { clean, updates: null };
  try {
    const raw = JSON.parse(m[1].trim());
    const updates: Record<string, string> = {};
    for (const [k, val] of Object.entries(raw)) {
      if (APPLY_KEYS.has(k) && val != null) updates[k] = String(val);
    }
    return { clean, updates: Object.keys(updates).length ? updates : null };
  } catch {
    return { clean, updates: null };
  }
}

function missingItems(a: Answers): string[] {
  const has = (k: string) => (a[k] || "").trim().length > 0;
  const m: string[] = [];
  if (!has("overview")) m.push("experiment overview");
  if (!has("rq")) m.push("research questions");
  if (!has("sd_dv")) m.push("dependent variable(s)");
  if (!has("sd_iv") || !has("sd_iv_levels")) m.push("independent variable + its levels");
  if (!has("sd_cv")) m.push("control variables");
  if (!has("sd_design")) m.push("design type (within/between/mixed)");
  if (!has("sd_balancing")) m.push("counterbalancing method");
  if (!has("sd_participants")) m.push("number of participants");
  if (!has("ds_agent")) m.push("agent (CoAX or CoXAM)");
  if (!has("ds_dataset")) m.push("dataset / trial configuration");
  return m;
}

function buildChatContext(a: Answers): string {
  const snip = (k: string, n = 100) => {
    const v = (a[k] || "").trim();
    return v ? (v.length > n ? v.slice(0, n) + "…" : v) : "(empty)";
  };
  const captured = [
    `overview: ${snip("overview")}`,
    `research questions: ${snip("rq")}`,
    `DV: ${snip("sd_dv", 60)}`,
    `IV: ${snip("sd_iv", 50)} | model: ${snip("sd_iv_agent", 20)} | levels: ${snip("sd_iv_levels", 60)}`,
    `control vars: ${snip("sd_cv", 50)}`,
    `design: ${snip("sd_design", 30)} | balancing: ${snip("sd_balancing", 30)} | conditions: ${snip("sd_conditions", 10)} | N: ${snip("sd_participants", 10)}`,
    `agent: ${snip("ds_agent", 20)} | dataset: ${snip("ds_dataset", 60)}`,
  ].join("\n");
  const missing = missingItems(a);
  const missingLine =
    missing.length === 0
      ? "Nothing is missing — all required info is captured. Congratulate the user and confirm the design looks complete."
      : `Still missing: ${missing.join("; ")}. Ask about the next one or two of these.`;
  return `Captured so far:\n${captured}\n\n${missingLine}`;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

// The chat bubbles are plain text, so strip light markdown the model may emit
// (bold/italic/inline-code/heading markers) to avoid stray ** and * showing.
function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, "$1$2")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

function ChatPanel({ context, onApplyUpdates }: { context: string; onApplyUpdates: (u: Record<string, string>) => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hi! I'm here to help you design your experiment. Let's start simple — what experiment do you want to test, and what's the main question behind it?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

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
      const { clean, updates } = parseUpdates(acc);
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
              <div
                className={cn(
                  "max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  m.role === "user" ? "text-white" : "bg-neutral-100 text-neutral-800"
                )}
                style={m.role === "user" ? { backgroundColor: ACCENT } : undefined}
              >
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Describe your study, or answer the assistant…"
            className="max-h-40 flex-1 resize-none rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-400"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
            style={{ backgroundColor: ACCENT }}
            aria-label="Send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
