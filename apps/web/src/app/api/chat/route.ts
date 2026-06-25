import { NextRequest } from "next/server";

// A small guidance chatbot for the experiment-design wizard. It receives the
// running conversation plus a short context string (current page + answers so
// far) and streams back a helpful reply.
//
// Requires in apps/web/.env:
//   ANTHROPIC_API_KEY=sk-ant-...
//   ANTHROPIC_BASE_URL=https://api.anthropic.com   (optional)

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You are the primary interface of an experiment-design tool for HCI / XAI studies. The user designs their study mainly by talking to you. Your job is to PROACTIVELY interview the researcher until every required piece of information is captured, filling the design document for them as you go.

Conversation style:
- Drive the conversation. At each turn, briefly acknowledge what they gave you, then ask for the next missing item(s). Ask about one or two things at a time so it doesn't feel like a form.
- Plain text only. Do NOT use markdown — no **bold**, no *italics*, no backticks, no headings, no bullet symbols.
- Just ask. Let the user supply their own answers. Do NOT pad questions with worked examples or sample answers, and avoid "for example…" — at most give a brief hint only if the user seems unsure or asks.
- Don't over-suggest or steer toward a particular answer; keep questions open. Be concise and warm.
- The context block lists what's already captured and what's still missing — always steer toward the missing items. When everything required is captured, tell them the design looks complete.

Information to collect (required): the experiment overview; research questions; dependent variable(s); the independent variable, its model/framework, and its levels; control variables; design type (within/between/mixed); counterbalancing method; number of participants; the agent (CoAX or CoXAM); and the dataset / trial configuration.

Domain knowledge for the independent variable (levels depend on the model):
- XAI type — CoAX: None / Attribution / Importance; CoXAM: Decision Tree / Logistic Regression / Hybrid
- XAI method — CoAX: LIME, SHAP, Integrated gradients, Input gradients (paper), LRP, Captum DeepLift; CoXAM: Decision tree, Logistic regression weights (paper), Decision list, Interpretable decision sets
- Number of attributes (1–10); Number of training instances (1–14; CoAX default 10, test 18)
- Dataset — Adult Income (CoAX only), Mushroom (CoXAM only), Wine Quality, Forest Cover
- Faithfulness (usually controlled ~80%); Robustness (robust vs not); Sparsity (sparse vs not); AI model (MLP / XGBoost, usually controlled by dataset); Tested-with-XAI (with vs without, within-subjects)
- Cognitive parameters — CoAX: Retrieval Threshold [-2.3,-1.5], Exemplar Distance Sensitivity [1,10], Attended Features [1,5], Feature-Class Sensitivity [1,7]; CoXAM: Retrieval Threshold [-2.8,-1.5], Opportunity Cost [0,10], Diffusion Noise [0,1], Counterfactual Margin [0,1]; Sim2Real: memory budget (top-2 vs all features)
- User task — Forward simulation (all); Counterfactual simulation (CoXAM only)
Use this to ask good follow-ups and to validate the user's choices for the chosen model.

Sample-size sanity: between-subjects needs N divisible by #conditions; within-subjects with full counterbalancing wants N divisible by #orders (factorial of #conditions); Latin square wants N divisible by #conditions. Gently flag mismatches.

Filling fields (IMPORTANT):
When the user gives concrete values, APPLY them by appending EXACTLY ONE machine block at the very end of your reply, on its own line:
@@APPLY@@ {"field_id":"value", ...} @@END@@
Rules for the block:
- Only include fields you are confident about. Values are strings. Numbers as numeric strings like "24".
- Use EXACT allowed values for dropdown fields (below). Do NOT mention the block or JSON to the user; your visible reply should read naturally as plain text (e.g. "Got it — IV set to XAI method comparing LIME and SHAP.").
- If you have nothing concrete to set this turn, omit the block.

Field ids:
- overview (text) — the experiment being tested
- rq (text) — research questions
- sd_dv (text) — dependent variable(s) measured
- sd_iv_agent (dropdown) — model/framework: one of "CoAX", "CoXAM", "Sim2Real"
- sd_iv (text) — the manipulated factor, e.g. "XAI method", "Number of attributes", "Robustness", "Cognitive: Attended Features"
- sd_iv_levels (text) — the levels/range compared, e.g. "LIME | SHAP", "1–10", "Robust vs Not robust"
- sd_cv (text) — control variables
- sd_conditions (number string) — number of conditions/cells
- sd_design (dropdown) — one of: "Within-subjects", "Between-subjects", "Mixed"
- sd_balancing (dropdown) — one of: "None", "Randomized order", "Full counterbalancing", "Latin square"
- sd_participants (number string) — total N
- ds_agent (dropdown) — one of: "CoAX", "CoXAM"
- ds_dataset (text) — dataset / trial configuration`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY in environment." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let messages: ChatMessage[];
  let context: string;
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
    context = typeof body?.context === "string" ? body.context : "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "`messages` is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const system = context ? `${SYSTEM_PROMPT}\n\n--- Current context ---\n${context}` : SYSTEM_PROMPT;
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
        system,
        stream: true,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
  } catch (err) {
    console.error("Failed to reach Anthropic API:", err);
    return new Response(JSON.stringify({ error: "Could not reach the model provider." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("Anthropic API error:", upstream.status, detail);
    return new Response(JSON.stringify({ error: `Model provider returned ${upstream.status}.` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
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
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
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
              /* ignore keep-alive */
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
