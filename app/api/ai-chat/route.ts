import { NextRequest } from "next/server";
import { assertAdminSession } from "@/lib/auth-helpers";
import { AI_CHAT_SYSTEM_PROMPT } from "@/lib/ai-chat/ai-system-prompt";
import { buildBusinessContext } from "@/lib/ai-chat/business-retrieval";
import { getLastUserText, type OpenRouterChatMessage } from "@/lib/ai-chat/extract-user-text";
import { extendMessagesWithOpenRouterToolRound } from "@/lib/ai-chat/openrouter-agent-loop";
import { enrichMessagesWithPdfText } from "@/lib/ai-chat/enrich-messages-with-pdf-text";

export const runtime = "nodejs";

const ALLOWED_MODELS = new Set([
  "qwen/qwen3.6-plus",
  "deepseek/deepseek-v3.2",
  "moonshotai/kimi-k2.6",
  "inclusionai/ling-2.6-1t:free",
  "tencent/hy3-preview:free",
]);

export async function POST(req: NextRequest) {
  const auth = await assertAdminSession();
  if (!auth.ok) {
    return Response.json(
      { error: auth.error === "unauthorized" ? "Unauthorized" : "Forbidden" },
      { status: auth.error === "unauthorized" ? 401 : 403 }
    );
  }

  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: { messages?: unknown; model?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, model: modelRaw } = body;
  if (!Array.isArray(messages)) {
    return Response.json({ error: "messages array required" }, { status: 400 });
  }

  const model =
    typeof modelRaw === "string" && modelRaw.length > 0
      ? modelRaw
      : "qwen/qwen3.6-plus";

  if (!ALLOWED_MODELS.has(model)) {
    return Response.json({ error: "Model not allowed" }, { status: 400 });
  }

  const referer =
    req.headers.get("origin") ??
    req.headers.get("referer") ??
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "";

  const rawMessages = messages as OpenRouterChatMessage[];
  let messagesWithPdfText = rawMessages;
  try {
    messagesWithPdfText = await enrichMessagesWithPdfText(rawMessages);
  } catch (e) {
    console.error("ai-chat pdf enrichment", e);
  }

  const lastUser = getLastUserText(messagesWithPdfText);
  let businessContext = "";
  try {
    businessContext = await buildBusinessContext(lastUser);
  } catch (e) {
    console.error("ai-chat business retrieval", e);
  }

  const systemAndContext: OpenRouterChatMessage[] = [
    { role: "system", content: AI_CHAT_SYSTEM_PROMPT },
    ...(businessContext
      ? [
          {
            role: "user" as const,
            content:
              "## Business context (database snapshot for this turn)\n\n" +
              businessContext +
              "\n\n---\n\nWhen answering questions about the agency's data, rely on this section. If something is not listed here, say you do not have it.",
          },
        ]
      : []),
  ];

  let messagesForModel: unknown[] = [...systemAndContext, ...messagesWithPdfText];

  if (process.env.AI_CHAT_OPENROUTER_TOOLS === "true") {
    try {
      const extended = await extendMessagesWithOpenRouterToolRound({
        apiKey: key,
        referer,
        model,
        messages: messagesForModel as OpenRouterChatMessage[],
      });
      if (extended?.length) messagesForModel = extended;
    } catch (e) {
      console.warn("ai-chat openrouter tool round", e);
    }
  }

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(referer ? { "HTTP-Referer": referer } : {}),
      "X-Title": "AgencyOS",
    },
    body: JSON.stringify({
      model,
      messages: messagesForModel,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return Response.json(
      { error: text || "OpenRouter request failed" },
      { status: upstream.status >= 400 ? upstream.status : 502 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
