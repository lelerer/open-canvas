import { NextRequest } from "next/server";

// Takes the CURRENT document (markdown, including any manual edits the user made
// in the canvas) plus a natural-language instruction, and returns a revised
// version of the whole document, streamed back as plain text.
//
// Requires in apps/web/.env:
//   ANTHROPIC_API_KEY=sk-ant-...
//   ANTHROPIC_BASE_URL=https://api.anthropic.com   (optional)

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

const SYSTEM_FULL = `You revise an existing experiment-design document written in markdown.

You receive the current document and one instruction from the researcher. Apply the requested change and return the FULL revised document.

Rules:
- Change only what the instruction asks for. Keep every other section, heading, table, and wording exactly as it was.
- Preserve the overall structure and markdown formatting (headings, tables, lists).
- Do not invent specific data the researcher hasn't provided; if the instruction asks to add something with no basis, write it in general terms rather than fabricating concrete numbers.
- Output ONLY the full revised markdown document. No preamble, no commentary, no code fences.`;

const SYSTEM_SNIPPET = `You rewrite a SINGLE highlighted passage of an experiment-design document.

You are given the full document for context, a highlighted passage, and an instruction. Rewrite ONLY that passage.

Rules:
- Return ONLY the rewritten passage — the exact text meant to replace the highlighted passage. Nothing else.
- Do NOT return the rest of the document, surrounding sections, or any heading that wasn't part of the passage. No preamble, no quotes, no code fences.
- Match the markdown style of the passage (a table row stays a table row, a bullet stays a bullet, plain prose stays plain prose).
- Keep roughly the same scope as the original unless the instruction says otherwise. Do not invent specific data the researcher hasn't provided.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing ANTHROPIC_API_KEY in environment." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let document: string;
  let instruction: string;
  let selection: string | undefined;
  try {
    const body = await req.json();
    document = body?.document;
    instruction = body?.instruction;
    selection = typeof body?.selection === "string" ? body.selection : undefined;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!document || typeof document !== "string" || !document.trim()) {
    return new Response(JSON.stringify({ error: "`document` is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
    return new Response(JSON.stringify({ error: "`instruction` is required." }), {
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
        system: selection && selection.trim() ? SYSTEM_SNIPPET : SYSTEM_FULL,
        stream: true,
        messages: [
          {
            role: "user",
            content:
              selection && selection.trim()
                ? "Full document (context only — do NOT return it):\n\n" +
                  document +
                  '\n\n---\n\nHighlighted passage to rewrite:\n"""\n' +
                  selection.trim() +
                  '\n"""\n\n---\n\nInstruction:\n' +
                  instruction
                : "Current document:\n\n" +
                  document +
                  "\n\n---\n\nRequested change:\n" +
                  instruction,
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
