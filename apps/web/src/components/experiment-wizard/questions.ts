// The interview script. Each page asks ONE open question; the LLM turns the
// collected answers into the final templated document.

export type Answers = Record<string, string>;

export interface Question {
  id: string;
  navTitle: string; // short label in the sidebar
  section: string; // eyebrow above the question
  prompt: string; // the question itself (shown big)
  hints?: string[]; // optional guiding points
  placeholder?: string;
}

export const QUESTIONS: Question[] = [
  {
    id: "overview",
    navTitle: "Overview",
    section: "Getting started",
    prompt: "In a sentence or two, what experiment do you want to run?",
    placeholder: "e.g. I want to compare two XAI explanation styles and see how each affects users' trust calibration…",
  },
  {
    id: "rq",
    navTitle: "Research Questions",
    section: "Section 1",
    prompt: "What research questions are you trying to answer?",
    hints: ["List them as RQ1, RQ2, RQ3…", "Each should be clear and testable."],
    placeholder: "RQ1: …\nRQ2: …",
  },
  {
    id: "variables",
    navTitle: "Variables",
    section: "Section 2",
    prompt: "What are your variables?",
    hints: [
      "Dependent variables (what you measure) — name, scale, how it's measured.",
      "Independent variables (what you manipulate) — name and its levels.",
      "Control variables (held constant) and why.",
      "Random variables (not controlled, may vary).",
    ],
    placeholder: "Measure: … (e.g. trust calibration, 7-point Likert)\nManipulate: … (e.g. explanation type: saliency vs counterfactual)\nHold constant: …\nLeave random: …",
  },
  {
    id: "design",
    navTitle: "Study Design",
    section: "Section 3",
    prompt: "How is the study designed?",
    hints: [
      "Within-subject, between-subject, or mixed? If mixed, give the factorial design, e.g. 3 (X, between) × 2 (Y, within).",
      "How will you counterbalance / order trials and blocks (full / Latin square / none)? Justify if none.",
    ],
    placeholder: "Design: …\nCounterbalancing: …",
  },
  {
    id: "participants",
    navTitle: "Participants",
    section: "Section 4",
    prompt: "Who are your participants?",
    hints: [
      "Target N (total) and per-group N.",
      "Recruitment, inclusion/exclusion criteria.",
      "Consent and compensation.",
    ],
    placeholder: "…",
  },
  {
    id: "apparatus",
    navTitle: "Apparatus & Materials",
    section: "Section 5",
    prompt: "What apparatus and materials will you use?",
    hints: ["Hardware and software.", "Stimulus / explanation materials, questionnaires, test materials."],
    placeholder: "Hardware: …\nSoftware: …\nMaterials: …",
  },
  {
    id: "procedure",
    navTitle: "Procedure",
    section: "Section 6",
    prompt: "Walk me through one session, step by step.",
    hints: ["From arrival to debrief.", "Add rough durations and a total estimate."],
    placeholder: "1. …\n2. …\nTotal: ~ … min",
  },
  {
    id: "dataset",
    navTitle: "Dataset & Agent",
    section: "Section 7",
    prompt: "How are trials configured, and what agent do participants evaluate?",
    hints: [
      "Practice / baseline / main blocks, trials per block, training strategy, analysed trials per participant.",
      "The AI model/agent that learns from training data and produces the predictions participants judge.",
    ],
    placeholder: "Trials: …\nAgent: …",
  },
];

export function buildTranscript(answers: Answers): string {
  return QUESTIONS.map((q, i) => {
    const a = (answers[q.id] || "").trim() || "(no answer given)";
    return `Q${i + 1} — ${q.navTitle}\n${q.prompt}\nAnswer: ${a}`;
  }).join("\n\n");
}
