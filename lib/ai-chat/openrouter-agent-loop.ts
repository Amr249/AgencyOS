/**
 * Optional OpenRouter tool-calling round (non-stream) before the final streamed completion.
 * Enable with AI_CHAT_OPENROUTER_TOOLS=true. Uses the same whitelisted executors as structured retrieval.
 */

import {
  AI_CHAT_OPENROUTER_TOOL_DEFINITIONS,
  executeAiChatTool,
  type WhitelistedToolName,
} from "@/lib/ai-chat/retrieval-tools";

type ORMessage = { role: string; content?: unknown; tool_calls?: unknown; tool_call_id?: string; name?: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function parseToolCalls(choice: unknown): Array<{ id: string; name: string; arguments: string }> {
  if (!isRecord(choice)) return [];
  const msg = choice.message;
  if (!isRecord(msg)) return [];
  const raw = msg.tool_calls;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ id: string; name: string; arguments: string }> = [];
  for (const tc of raw) {
    if (!isRecord(tc)) continue;
    const id = typeof tc.id === "string" ? tc.id : "";
    const fn = tc.function;
    if (!isRecord(fn)) continue;
    const name = typeof fn.name === "string" ? fn.name : "";
    const args = typeof fn.arguments === "string" ? fn.arguments : "{}";
    if (id && name) out.push({ id, name, arguments: args });
  }
  return out;
}

const ALLOWED_NAMES = new Set<string>([
  "list_projects",
  "list_clients",
  "recent_invoices",
  "mostaql_latest_runs",
]);

/**
 * If the model requests tools, append assistant + tool messages and return the extended array.
 * Otherwise returns null (caller should stream the original messages only).
 */
export async function extendMessagesWithOpenRouterToolRound(params: {
  apiKey: string;
  referer: string;
  model: string;
  messages: ORMessage[];
}): Promise<ORMessage[] | null> {
  const { apiKey, referer, model, messages } = params;

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(referer ? { "HTTP-Referer": referer } : {}),
      "X-Title": "AgencyOS",
    },
    body: JSON.stringify({
      model,
      messages,
      tools: AI_CHAT_OPENROUTER_TOOL_DEFINITIONS,
      tool_choice: "auto",
      stream: false,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    console.warn("openrouter tool round failed", upstream.status, text.slice(0, 500));
    return null;
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return null;
  }

  if (!isRecord(data)) return null;
  const choices = data.choices;
  if (!Array.isArray(choices) || !choices[0]) return null;
  const toolCalls = parseToolCalls(choices[0]);
  if (!toolCalls.length) return null;

  const assistantMsg = isRecord(choices[0]) && isRecord(choices[0].message) ? choices[0].message : null;
  const toolResults: ORMessage[] = [];

  for (const tc of toolCalls) {
    if (!ALLOWED_NAMES.has(tc.name)) continue;
    let args: unknown = {};
    try {
      args = JSON.parse(tc.arguments || "{}");
    } catch {
      args = {};
    }
    const content = await executeAiChatTool(tc.name as WhitelistedToolName, args);
    toolResults.push({
      role: "tool",
      tool_call_id: tc.id,
      content,
    });
  }

  if (!toolResults.length) return null;

  const assistantPayload: ORMessage = {
    role: "assistant",
    ...(assistantMsg?.content != null && assistantMsg.content !== ""
      ? { content: assistantMsg.content }
      : { content: null }),
    ...(Array.isArray(assistantMsg?.tool_calls) ? { tool_calls: assistantMsg.tool_calls } : {}),
  };

  return [...messages, assistantPayload, ...toolResults];
}
