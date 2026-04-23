/**
 * Maps stored chat messages (with optional ImageKit attachments) to OpenRouter / OpenAI-format messages.
 */

export type ChatAttachment = {
  url: string;
  name: string;
  mimeType?: string;
};

export type StoredChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
};

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export function toOpenRouterMessage(m: StoredChatMessage): {
  role: "user" | "assistant";
  content: string | ContentPart[];
} {
  if (m.role === "assistant") {
    return { role: "assistant", content: m.content };
  }

  const text = m.content ?? "";
  const att = m.attachments;
  if (!att?.length) {
    return { role: "user", content: text };
  }

  const parts: ContentPart[] = [];
  if (text.trim()) {
    parts.push({ type: "text", text: text });
  }
  for (const a of att) {
    const mime = a.mimeType?.toLowerCase() ?? "";
    if (mime.startsWith("image/")) {
      parts.push({ type: "image_url", image_url: { url: a.url } });
    } else {
      parts.push({
        type: "text",
        text: `\n[Attached file: ${a.name}]\n${a.url}`,
      });
    }
  }

  if (parts.length === 0) {
    return { role: "user", content: "" };
  }
  if (parts.length === 1 && parts[0].type === "text") {
    return { role: "user", content: parts[0].text };
  }
  return { role: "user", content: parts };
}

export function toOpenRouterMessages(messages: StoredChatMessage[]) {
  return messages.map(toOpenRouterMessage);
}
