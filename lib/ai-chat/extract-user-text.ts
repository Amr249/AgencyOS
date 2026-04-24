/**
 * Last user turn text from OpenRouter-style messages (for retrieval).
 */

export type OpenRouterChatMessage = {
  role: string;
  content: unknown;
};

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const p of content) {
    if (p && typeof p === "object" && "type" in p) {
      const o = p as { type?: string; text?: string };
      if (o.type === "text" && typeof o.text === "string") parts.push(o.text);
    }
  }
  return parts.join("\n");
}

export function getLastUserText(messages: OpenRouterChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    const text = textFromContent(m.content).trim();
    if (text) return text;
  }
  return "";
}
