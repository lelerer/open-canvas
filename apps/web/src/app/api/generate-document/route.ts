import { NextRequest } from "next/server";

// Receives the interview transcript (questions + the researcher's answers) and asks
// the model to compile a complete experiment-design document following a fixed
// template. The result is streamed back as plain text (markdown).
//
// Requires in apps/web/.env:
//   ANTHROPIC_API_KEY=sk-ant-...
//   ANTHROPIC_BASE_URL=https://api.anthropic.com   (optional, point at your own proxy)

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

const TEMPLATE = `# <A concise, descriptive title for the study>

# 1. Research Questions
*   RQ1: [specify]
*   RQ2: [specify]

# 2. Variables
## 2.1 Dependent Variables (DVs) — what you measure
| DV# | Name | Scale | Measurement Description |
| --- | --- | --- | --- |
| DV1 | [specify] | [specify] | [specify] |
## 2.2 Independent Variables (IVs) — what you manipulate
| IV# | Name | #lvls | Levels | Description |
| --- | --- | --- | --- | --- |
| IV1 | [specify] | [specify] | [specify] | [specify] |
## 2.3a Control Variables (CVs) — held constant
| CV# | Name | #lvls | Level | Description / Rationale |
| --- | --- | --- | --- | --- |
| CV1 | [specify] | [specify] | [specify] | [specify] |
## 2.3b Random Variables (RVs) — not controlled, may vary
| RV# | Name | #lvls | Levels | Description / Rationale |
| --- | --- | --- | --- | --- |
| RV1 | [specify] | [specify] | [specify] | [specify] |

# 3. Study Design
## 3.1 Design Type
[within-subject / between-subject / mixed; for mixed, state the factorial design]
## 3.2 Counterbalancing & Ordering
[full / Latin square / none, with justification, plus trial/block ordering]

# 4. Participants
[target N and per-group N, recruitment, inclusion/exclusion, consent, compensation]

# 5. Apparatus & Materials
[hardware, software, stimulus materials, questionnaires, test materials]

# 6. Procedure
1.  [numbered, step-by-step session flow with durations, ending with a total estimate]

# 7. Dataset & Agent
## 7.1 Trial Configuration
[practice / baseline / main blocks, trials per block, training strategy, analysed trials per participant]
## 7.2 Agent
[the AI model/agent that learns from the training data and produces the predictions participants evaluate]`;

const SYSTEM_PROMPT = `You are an expert HCI and experimental-methodology assistant. A researcher has answered an interview about a planned user study. Turn their answers into a complete, rigorous experiment-design document.

Produce the document following EXACTLY this template — same section order, same headers, same markdown tables:

${TEMPLATE}

Rules:
- Keep the template's structure, headers, and tables exactly. Fill the DV/IV/CV/RV tables by extracting the relevant items from the answers (one row each). Add rows as needed.
- Polish the researcher's notes into clear, precise academic English (ACM/CHI register).
- Do NOT invent concrete specifics the researcher did not give (participant N, durations, number of levels, level names, scales, etc.). Where something is missing, simply leave it out or phrase the section around what is known — write naturally and do NOT insert placeholder text such as "[to specify]", "[specify]", "TBD", "N/A", or empty bracketed prompts. If a whole table row or sub-section has no information, omit that row/sub-section rather than emitting a blank or placeholder one.
- Briefly sanity-check internal consistency. If the design type, variables, and counterbalancing conflict (e.g. a within-subject design with no counterbalancing, or an IV whose #lvls does not match its listed levels), add a concise inline note on its own line starting with "> ⚠ Note:".
- The bracketed placeholders shown in the template above (e.g. "[specify]", "[within-subject / ...]") are illustrative of structure ONLY. Never copy them into your output — replace each with real content from the answers, or omit it.
- The first H1 must be a concise, descriptive title for the study, derived from the researcher's overview/answers — e.g. "# Comparing LIME and SHAP Explanations on User Trust Calibration". NEVER output the literal prompt "What experiment do you want to conduct?" as the title.
- Output ONLY the final markdown document. No preamble, no closing remarks, no code fences.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing ANTHROPIC_API_KEY in environment." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let transcript: string;
  try {
    const body = await req.json();
    transcript = body?.transcript;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return new Response(JSON.stringify({ error: "`transcript` is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        stream: true,
        messages: [
          {
            role: "user",
            content:
              "Here is my interview transcript. Compile it into the final document, following the rules.\n\n" +
              transcript,
          },
        ],
      }),
    });
  } catch (err) {
    console.error("Failed to reach Anthropic API:", err);
    return new Response(
      JSON.stringify({ error: "Could not reach the model provider." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("Anthropic API error:", upstream.status, detail);
    return new Response(
      JSON.stringify({ error: `Model provider returned ${upstream.status}.` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const eventLines = buffer.split("\n");
          buffer = eventLines.pop() ?? "";
          for (const line of eventLines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice("data:".length).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const event = JSON.parse(data);
              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta" &&
                typeof event.delta.text === "string"
              ) {
                controller.enqueue(encoder.encode(event.delta.text));
              }
            } catch {
              // ignore ping / keep-alive
            }
          }
        }
      } catch (err) {
        console.error("Stream error:", err);
        controller.error(err);
        return;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}