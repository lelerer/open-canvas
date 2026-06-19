"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Copy,
  Download,
  Check,
  Loader2,
  RotateCcw,
  ArrowLeft,
  FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "@blocknote/core/fonts/inter.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { QUESTIONS, Answers, buildTranscript } from "./questions";

const STORAGE_KEY = "experiment-interview-v1";
const ACCENT = "#359793";
const CANVAS_STEP = QUESTIONS.length; // last step index

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

  const onCanvas = step === CANVAS_STEP;
  const q = QUESTIONS[step];

  function setAnswer(id: string, v: string) {
    setAnswers((a) => ({ ...a, [id]: v }));
  }

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-7 w-7 place-items-center rounded-md text-white" style={{ backgroundColor: ACCENT }}>
            <FileText className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Experiment Designer</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 pb-4">
          {QUESTIONS.map((item, i) => {
            const active = i === step;
            const done = (answers[item.id] || "").trim().length > 0;
            return (
              <button
                key={item.id}
                onClick={() => setStep(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  active ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs",
                    active || done ? "border-transparent text-white" : "border-neutral-300 text-neutral-400"
                  )}
                  style={active || done ? { backgroundColor: ACCENT } : undefined}
                >
                  {done && !active ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn("truncate", active ? "text-neutral-900" : "text-neutral-600")}>{item.navTitle}</span>
              </button>
            );
          })}
          <div className="my-2 border-t border-neutral-100" />
          <button
            onClick={() => setStep(CANVAS_STEP)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              onCanvas ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"
            )}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className={cn("truncate", onCanvas ? "text-neutral-900" : "text-neutral-600")}>Document</span>
          </button>
        </nav>
      </aside>

      {/* Right column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-3 lg:hidden">
          <span className="text-sm font-semibold">Experiment Designer</span>
          <span className="text-xs text-neutral-500">{Math.min(step + 1, CANVAS_STEP)} / {CANVAS_STEP}</span>
        </header>
        <div className="h-1 w-full bg-neutral-200 lg:hidden">
          <div className="h-full transition-all" style={{ width: `${((step + 1) / (CANVAS_STEP + 1)) * 100}%`, backgroundColor: ACCENT }} />
        </div>

        {onCanvas ? (
          <DocumentCanvas answers={answers} onBack={() => setStep(CANVAS_STEP - 1)} />
        ) : (
          <>
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-2xl px-6 py-12">
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
                  {q.section} · Question {step + 1} of {CANVAS_STEP}
                </p>
                <h1 className="mt-3 text-2xl font-semibold leading-snug tracking-tight">{q.prompt}</h1>
                {q.hints && q.hints.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {q.hints.map((h, i) => (
                      <li key={i} className="flex gap-2 text-sm text-neutral-500">
                        <span style={{ color: ACCENT }}>•</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Textarea
                  autoFocus
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder ?? "Type your answer…"}
                  className="mt-6 min-h-[200px] resize-y bg-white text-[15px] leading-relaxed"
                />
                <p className="mt-2 text-xs text-neutral-400">Answer in your own words — the AI will organise it into the template later.</p>
              </div>
            </main>

            <footer className="border-t border-neutral-200 bg-white">
              <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3">
                <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                {step < CANVAS_STEP - 1 ? (
                  <AccentButton onClick={() => setStep((s) => s + 1)}>
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </AccentButton>
                ) : (
                  <AccentButton onClick={() => setStep(CANVAS_STEP)}>
                    <Sparkles className="mr-1.5 h-4 w-4" /> Generate document
                  </AccentButton>
                )}
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function AccentButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: ACCENT }}
    >
      {children}
    </button>
  );
}

/* ---------- Document canvas: auto-generate, live preview, then editable ---------- */

const MD_COMPONENTS: any = {
  h1: ({ children }: any) => <h1 className="mb-5 mt-0 text-2xl font-semibold tracking-tight">{children}</h1>,
  h2: ({ children }: any) => <h2 className="mb-3 mt-8 border-b border-neutral-200 pb-1.5 text-lg font-semibold">{children}</h2>,
  h3: ({ children }: any) => <h3 className="mb-2 mt-6 text-base font-semibold">{children}</h3>,
  p: ({ children }: any) => <p className="my-3 leading-7 text-[15px] text-neutral-800">{children}</p>,
  ul: ({ children }: any) => <ul className="my-3 list-disc space-y-1 pl-6 text-[15px] text-neutral-800">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-3 list-decimal space-y-1 pl-6 text-[15px] text-neutral-800">{children}</ol>,
  li: ({ children }: any) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }: any) => <blockquote className="my-3 rounded-r-md border-l-4 border-amber-400 bg-amber-50 px-4 py-2 text-sm text-amber-900">{children}</blockquote>,
  table: ({ children }: any) => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse font-sans text-sm">{children}</table></div>,
  th: ({ children }: any) => <th className="border border-neutral-300 bg-neutral-50 px-3 py-2 text-left font-medium">{children}</th>,
  td: ({ children }: any) => <td className="border border-neutral-200 px-3 py-2 align-top">{children}</td>,
  code: ({ children }: any) => <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[13px]">{children}</code>,
  hr: () => <hr className="my-6 border-neutral-200" />,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
};

function DocumentCanvas({ answers, onBack }: { answers: Answers; onBack: () => void }) {
  const editor = useCreateBlockNote({});
  const [md, setMd] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false); // editor populated -> show editable canvas
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  async function loadIntoEditor(markdown: string) {
    try {
      const blocks = await editor.tryParseMarkdownToBlocks(markdown);
      editor.replaceBlocks(editor.document, blocks);
      setReady(true);
    } catch (e) {
      console.error("Failed to load markdown into editor:", e);
    }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setReady(false);
    setMd("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: buildTranscript(answers) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMd(acc);
      }
      await loadIntoEditor(acc); // streaming done -> make it editable
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    generate();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function currentMarkdown(): Promise<string> {
    if (ready) {
      try {
        return await editor.blocksToMarkdownLossy(editor.document);
      } catch {
        return md;
      }
    }
    return md;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(await currentMarkdown());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  async function download() {
    const text = await currentMarkdown();
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "experiment-design.md"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-2.5">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to questions
        </Button>
        <div className="flex items-center gap-2">
          {ready ? <span className="mr-1 hidden text-xs text-neutral-400 sm:inline">Editable — click to edit</span> : null}
          <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />}
            {loading ? "Generating" : "Regenerate"}
          </Button>
          <Button variant="outline" size="sm" onClick={copy} disabled={!md.trim()}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={download} disabled={!md.trim()}>
            <Download className="mr-1 h-4 w-4" /> .md
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-y-auto bg-neutral-100 px-4 py-8">
        <div className="mx-auto w-full max-w-3xl rounded-xl border border-neutral-200 bg-white shadow-sm">
          {error ? (
            <div className="m-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {ready ? (
            // Editable rich-text canvas (BlockNote)
            <div className="py-6">
              <BlockNoteView editor={editor} theme="light" />
            </div>
          ) : !md && loading ? (
            <div className="flex items-center gap-2 px-10 py-10 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Compiling your experiment design…
            </div>
          ) : (
            // Live preview while streaming
            <article className="px-10 py-10" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                {md}
              </ReactMarkdown>
              {loading ? <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-neutral-400 align-middle" /> : null}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
