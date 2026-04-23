import { NextRequest } from "next/server";
import { assertAdminSession } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const ALLOWED_MODELS = new Set([
  "qwen/qwen3.6-plus",
  "deepseek/deepseek-v3.2",
  "moonshotai/kimi-k2.6",
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
      messages,
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
