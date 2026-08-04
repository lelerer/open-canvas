// Survey generation.
//
// Turns the wizard's Apparatus configurations into a structured survey model,
// then serialises it two ways:
//   • buildSurveyJson(a) — a clean, human-readable JSON of the survey.
//   • buildQsf(a)        — a Qualtrics Survey Format (.qsf) file that imports
//                          directly into Qualtrics (Projects → Create → Import
//                          a QSF file).
//
// Mapping, in brief (the procedure page is intentionally NOT used here):
//   welcome & consent → always the first block (welcome text + a consent question).
//   apparatus config  → one survey block. Each instance ID in that config becomes
//                       a trial: the interface embedded in an <iframe> (the config's
//                       URL with that instanceId) followed by a prediction and a
//                       confidence question.
//   >1 apparatus      → all their blocks are wrapped in a block randomiser so each
//                       participant is shown exactly one apparatus at random.

import {
  Answers, parseApparatusList, ApparatusEntry, instanceIdsOf,
  STUDY_UI_ROOT, STUDY_PARAM_DEFAULTS, buildStudyUrl, studyNaturalSize,
} from "./questions";

/* ----------------------------- Survey model ----------------------------- */

export type SQType = "DB" | "TE" | "MC"; // Descriptive text | Text entry | Multiple choice

export interface SQuestion {
  qid: string;        // Qualtrics question id, e.g. "QID3"
  tag: string;        // data export tag, e.g. "Q3"
  type: SQType;
  selector: string;   // Qualtrics selector (TB / SL / SAVR …)
  subSelector?: string;
  text: string;       // question text (may contain HTML, e.g. the <iframe>)
  choices?: string[]; // for MC
  meta?: Record<string, string>; // extra info kept in the JSON export (instanceId, group, url…)
}

export interface SBlock {
  id: string;         // "BL_2"
  name: string;
  questions: SQuestion[];
}

export type SFlowEl =
  | { kind: "block"; blockId: string }
  | { kind: "randomizer"; subset: number; blockIds: string[] };

export interface Survey {
  name: string;
  blocks: SBlock[];
  flow: SFlowEl[];
}

/* ----------------------------- Small helpers ----------------------------- */

function plain(html: string): string {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function firstLine(s: string): string {
  return (s || "").split("\n").map((l) => l.trim()).find(Boolean) || "";
}
function isCommonGroup(g: string): boolean {
  const t = (g || "").trim().toLowerCase();
  return t === "" || t === "all participants" || t === "all";
}

// The interface URL for a given apparatus configuration + instance id.
export function studyUrlForInstance(e: ApparatusEntry, id: string): string {
  if (e.mode === "own") {
    const u = (e.url || "").trim();
    if (!u) return "";
    if (!id) return u;
    const sep = u.includes("?") ? "&" : "?";
    return `${u}${sep}instanceId=${encodeURIComponent(id)}`;
  }
  const p = { ...STUDY_PARAM_DEFAULTS, ...e.params, instanceId: id };
  return buildStudyUrl(STUDY_UI_ROOT, p);
}

/* ----------------------------- Build the survey ----------------------------- */

const CONFIDENCE_CHOICES = [
  "1 — Not at all confident",
  "2 — Slightly confident",
  "3 — Moderately confident",
  "4 — Very confident",
  "5 — Extremely confident",
];

export function buildSurvey(a: Answers): Survey {
  // Generated from the Apparatus configurations only — the procedure page is not used.
  const apparatus = parseApparatusList(a).filter((e) =>
    e.mode === "own" ? /^https?:\/\//i.test((e.url || "").trim()) : true
  );
  const name = firstLine(a.rq) ? `XAI Study — ${firstLine(a.rq).slice(0, 60)}` : "XAI Study";

  // id / tag counters
  let qc = 0;
  const nextQ = (): { qid: string; tag: string } => {
    qc += 1;
    return { qid: `QID${qc}`, tag: `Q${qc}` };
  };
  let bc = 1; // blocks start at BL_2
  const nextB = () => `BL_${(bc += 1)}`;

  const blocks: SBlock[] = [];
  const flow: SFlowEl[] = [];

  const mkBlock = (nm: string, questions: SQuestion[]): SBlock => {
    const b: SBlock = { id: nextB(), name: nm, questions };
    blocks.push(b);
    return b;
  };
  const db = (text: string, meta?: Record<string, string>): SQuestion => ({ ...nextQ(), type: "DB", selector: "TB", text, meta });
  const te = (text: string, meta?: Record<string, string>): SQuestion => ({ ...nextQ(), type: "TE", selector: "SL", text, meta });
  const mc = (text: string, choices: string[], meta?: Record<string, string>): SQuestion => ({ ...nextQ(), type: "MC", selector: "SAVR", subSelector: "TX", text, choices, meta });

  // ---- One block per apparatus configuration; one trial per instance ID ----
  function apparatusBlock(e: ApparatusEntry): SBlock {
    const trialIds = instanceIdsOf({ ...STUDY_PARAM_DEFAULTS, ...e.params });
    const ids = trialIds.length ? trialIds : ["0"];
    const label = e.label?.trim() || (isCommonGroup(e.group) ? "Apparatus" : e.group);
    const questions: SQuestion[] = [];
    const nat = studyNaturalSize(e.mode, { ...STUDY_PARAM_DEFAULTS, ...e.params });
    ids.forEach((id, i) => {
      const url = studyUrlForInstance(e, id);
      // The embed renders at the interface's natural size and is scaled to fit the
      // question column by the per-question JS (IFRAME_FIT_JS) so nothing is clipped.
      const iframe = url
        ? `<div style="width:100%;overflow:hidden;"><iframe src="${esc(url)}" data-natural-width="${nat.w}" data-natural-height="${nat.h}" style="width:100%;height:700px;border:1px solid #ccc;" allow="fullscreen"></iframe></div>`
        : `<em>(no interface URL configured)</em>`;
      questions.push(
        db(
          `<div><strong>Trial ${i + 1} of ${ids.length}</strong> — instance ${esc(id)}</div>` +
            `<p>Study the interface below, then answer the questions that follow.</p>` +
            iframe,
          { instanceId: id, apparatus: e.label || label, url }
        )
      );
      questions.push(
        te(`Based on the interface above, what do you predict the AI's output is for this item?`, { instanceId: id, kind: "prediction" })
      );
      questions.push(
        mc(`How confident are you in your prediction?`, CONFIDENCE_CHOICES, { instanceId: id, kind: "confidence" })
      );
    });
    return mkBlock(`Apparatus — ${label}`, questions);
  }

  // ---- Welcome & consent (always the first block) ----
  const welcome = mkBlock("Welcome & consent", [
    db(
      `<h2>Welcome</h2>` +
        `<p>Thank you for taking part in this study. In this session you will look at an AI system's predictions and explanations, and answer a few short questions about them.</p>` +
        `<p>Your participation is voluntary and your responses are kept anonymous. You may stop at any time without penalty.</p>`
    ),
    mc(
      `<strong>Consent.</strong> I have read the information above and I agree to take part in this study.`,
      ["I agree to take part", "I do not agree"],
      { kind: "consent" }
    ),
  ]);
  flow.push({ kind: "block", blockId: welcome.id });

  // ---- Apparatus trials ----
  const appBlocks = apparatus.map((e) => apparatusBlock(e));
  if (appBlocks.length > 1) {
    // More than one apparatus → show exactly one at random.
    flow.push({ kind: "randomizer", subset: 1, blockIds: appBlocks.map((b) => b.id) });
  } else if (appBlocks.length === 1) {
    flow.push({ kind: "block", blockId: appBlocks[0].id });
  }

  return { name, blocks, flow };
}

/* ----------------------------- JSON export ----------------------------- */

export function buildSurveyJson(a: Answers): string {
  const s = buildSurvey(a);
  const obj = {
    format: "xaikit-survey/1",
    name: s.name,
    generatedFrom: "apparatus",
    blocks: s.blocks.map((b) => ({
      id: b.id,
      name: b.name,
      questions: b.questions.map((q) => ({
        id: q.qid,
        exportTag: q.tag,
        type: q.type,
        text: q.text,
        ...(q.choices ? { choices: q.choices } : {}),
        ...(q.meta ? { meta: q.meta } : {}),
      })),
    })),
    flow: s.flow,
  };
  return JSON.stringify(obj, null, 2);
}

/* ----------------------------- QSF export ----------------------------- */

function rid(prefix: string): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 15; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return prefix + s;
}
function timestamp(): string {
  // "YYYY-MM-DD HH:MM:SS" in local time (format Qualtrics expects).
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Qualtrics per-question JS: scale any natural-size iframe down to the question
// column width so the full interface is visible (the embedded pages are wider
// than the survey column and do not scroll internally).
const IFRAME_FIT_JS = `Qualtrics.SurveyEngine.addOnload(function() {
  var qc = this.getQuestionContainer();
  var frames = qc.querySelectorAll('iframe[data-natural-width]');
  for (var i = 0; i < frames.length; i++) {
    (function(f) {
      var nw = parseInt(f.getAttribute('data-natural-width'), 10) || 1280;
      var nh = parseInt(f.getAttribute('data-natural-height'), 10) || 900;
      var wrap = f.parentElement;
      function fit() {
        var w = wrap.clientWidth || qc.clientWidth || nw;
        var s = Math.min(1, w / nw);
        f.style.width = nw + 'px';
        f.style.height = nh + 'px';
        f.style.transform = 'scale(' + s + ')';
        f.style.webkitTransform = 'scale(' + s + ')';
        f.style.transformOrigin = '0 0';
        f.style.webkitTransformOrigin = '0 0';
        wrap.style.height = Math.ceil(nh * s) + 'px';
        wrap.style.overflow = 'hidden';
      }
      fit();
      window.addEventListener('resize', fit);
    })(frames[i]);
  }
});`;

function questionPayload(q: SQuestion): any {
  const base: any = {
    QuestionID: q.qid,
    DataExportTag: q.tag,
    QuestionType: q.type,
    Selector: q.selector,
    Configuration: { QuestionDescriptionOption: "UseText" },
    QuestionDescription: plain(q.text).slice(0, 100) || q.tag,
    QuestionText: q.text,
    QuestionText_Unsafe: q.text,
    DataVisibility: { Private: false, Hidden: false },
    Language: [],
  };
  if (q.type === "DB") {
    return {
      ...base,
      Selector: "TB",
      ChoiceOrder: [],
      Validation: { Settings: { Type: "None" } },
      NextChoiceId: 1,
      NextAnswerId: 1,
      ...(/<iframe[^>]*data-natural-width/.test(q.text) ? { QuestionJS: IFRAME_FIT_JS } : {}),
    };
  }
  if (q.type === "TE") {
    return {
      ...base,
      Selector: q.selector || "SL",
      Validation: { Settings: { ForceResponse: "OFF", Type: "None" } },
      SearchSource: { AllowFreeResponse: "false" },
      NextChoiceId: 4,
      NextAnswerId: 1,
    };
  }
  // MC
  const choices: Record<string, { Display: string }> = {};
  const order: string[] = [];
  (q.choices || []).forEach((c, i) => {
    const k = String(i + 1);
    choices[k] = { Display: c };
    order.push(k);
  });
  return {
    ...base,
    SubSelector: q.subSelector || "TX",
    Choices: choices,
    ChoiceOrder: order,
    Validation: { Settings: { ForceResponse: "OFF", Type: "None" } },
    NextChoiceId: (q.choices || []).length + 1,
    NextAnswerId: 1,
  };
}

function surveyOptions(title: string): any {
  return {
    BackButton: "true",
    SaveAndContinue: "true",
    SurveyProtection: "PublicSurvey",
    BallotBoxStuffingPrevention: "false",
    NoIndex: "Yes",
    SecureResponseFiles: "true",
    SurveyExpiration: "None",
    SurveyTermination: "DefaultMessage",
    Header: "",
    Footer: "",
    ProgressBarDisplay: "None",
    PartialData: "+1 week",
    ValidationMessage: "",
    PreviousButton: " ← ",
    NextButton: " → ",
    SurveyTitle: title,
    SkinLibrary: "qualtrics",
    SkinType: "MQ",
    NewScoring: 1,
  };
}

export function buildQsf(a: Answers): string {
  const survey = buildSurvey(a);
  const SID = rid("SV_");
  const UID = rid("UR_");
  const RSID = rid("RS_");
  const now = timestamp();
  const allQuestions = survey.blocks.flatMap((b) => b.questions);

  const elements: any[] = [];

  // Blocks
  const blockPayload: any[] = survey.blocks.map((b) => ({
    Type: "Standard",
    SubType: "",
    Description: b.name,
    ID: b.id,
    BlockElements: b.questions.flatMap((q, i) => {
      const els: any[] = [{ Type: "Question", QuestionID: q.qid }];
      // Paginate: page break after each confidence question (end of a trial unit).
      if (q.meta?.kind === "confidence" && i < b.questions.length - 1) els.push({ Type: "Page Break" });
      return els;
    }),
  }));
  blockPayload.push({ Type: "Trash", SubType: "", Description: "Trash / Unused Questions", ID: "BL_Trash", BlockElements: [] });
  elements.push({ SurveyID: SID, Element: "BL", PrimaryAttribute: "Survey Blocks", SecondaryAttribute: null, TertiaryAttribute: null, Payload: blockPayload });

  // Flow
  let flowNum = 1; // FL_1 is the root
  const fid = () => `FL_${(flowNum += 1)}`;
  const flowArr: any[] = survey.flow.map((el) => {
    if (el.kind === "block") return { Type: "Block", ID: el.blockId, FlowID: fid() };
    return {
      Type: "BlockRandomizer",
      FlowID: fid(),
      SubSet: el.subset,
      EvenPresentation: true,
      Flow: el.blockIds.map((bId) => ({ Type: "Block", ID: bId, FlowID: fid() })),
    };
  });
  elements.push({
    SurveyID: SID,
    Element: "FL",
    PrimaryAttribute: "Survey Flow",
    SecondaryAttribute: null,
    TertiaryAttribute: null,
    Payload: { Type: "Root", FlowID: "FL_1", Flow: flowArr, Properties: { Count: flowNum } },
  });

  // Survey options
  elements.push({ SurveyID: SID, Element: "SO", PrimaryAttribute: "Survey Options", SecondaryAttribute: null, TertiaryAttribute: null, Payload: surveyOptions(survey.name) });

  // Question count
  elements.push({ SurveyID: SID, Element: "QC", PrimaryAttribute: "Survey Question Count", SecondaryAttribute: String(allQuestions.length), TertiaryAttribute: null, Payload: null });

  // Questions
  for (const q of allQuestions) {
    elements.push({
      SurveyID: SID,
      Element: "SQ",
      PrimaryAttribute: q.qid,
      SecondaryAttribute: plain(q.text).slice(0, 100) || q.tag,
      TertiaryAttribute: null,
      Payload: questionPayload(q),
    });
  }

  const qsf = {
    SurveyEntry: {
      SurveyID: SID,
      SurveyName: survey.name,
      SurveyDescription: null,
      SurveyOwnerID: UID,
      SurveyBrandID: "xaikit",
      DivisionID: null,
      SurveyLanguage: "EN",
      SurveyActiveResponseSet: RSID,
      SurveyStatus: "Inactive",
      SurveyStartDate: "0000-00-00 00:00:00",
      SurveyExpirationDate: "0000-00-00 00:00:00",
      SurveyCreationDate: now,
      CreatorID: UID,
      LastModified: now,
      LastAccessed: "0000-00-00 00:00:00",
      LastActivated: "0000-00-00 00:00:00",
      Deleted: null,
    },
    SurveyElements: elements,
  };
  return JSON.stringify(qsf, null, 2);
}
