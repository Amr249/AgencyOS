/**
 * OpenRouter chat messages from the client encode non-image attachments as plain text:
 * `[Attached file: name.pdf]\n<url>`. Models cannot fetch arbitrary URLs, so we download
 * allowed PDFs (ImageKit only) and append extracted text before calling the model.
 */

import pdfParse from "pdf-parse";

import type { OpenRouterChatMessage } from "@/lib/ai-chat/extract-user-text";

const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 80_000;

function isAllowedPdfFetchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "ik.imagekit.io" || host.endsWith(".imagekit.io")) return true;
    const ep = process.env.IMAGEKIT_URL_ENDPOINT?.trim();
    if (ep) {
      try {
        if (host === new URL(ep).hostname.toLowerCase()) return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function extractTextFromPdfUrl(url: string): Promise<string | null> {
  if (!isAllowedPdfFetchUrl(url)) return null;

  const res = await fetch(url, {
    redirect: "follow",
    headers: { Accept: "application/pdf,*/*" },
  });
  if (!res.ok) return null;

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PDF_BYTES) {
    return `[PDF is too large to extract here (${Math.round(buf.length / (1024 * 1024))} MB; max ${MAX_PDF_BYTES / (1024 * 1024)} MB).]`;
  }

  try {
    const data = await pdfParse(buf);
    const raw = (data.text ?? "").replace(/\u0000/g, "").trim();
    if (!raw) return "[No selectable text found in this PDF (it may be scanned images only).]";
    if (raw.length > MAX_EXTRACTED_CHARS) {
      return `${raw.slice(0, MAX_EXTRACTED_CHARS)}\n\n… [PDF text truncated at ${MAX_EXTRACTED_CHARS} characters]`;
    }
    return raw;
  } catch (e) {
    console.error("enrich-messages-with-pdf-text: pdf-parse failed", e);
    return "[Could not parse this PDF.]";
  }
}

async function enrichUserTextSegment(text: string): Promise<string> {
  if (!text.includes("[Attached file:") || !/\.pdf\b/i.test(text)) return text;

  const matches = [
    ...text.matchAll(/\[Attached file:\s*([^\]]+\.(?:pdf|PDF))\]\s*\n?(https?:\/\/[^\s\n]+)/gi),
  ];
  if (matches.length === 0) return text;

  let result = text;
  const processedUrls = new Set<string>();

  for (const m of matches) {
    const full = m[0];
    const filename = m[1] ?? "document.pdf";
    const url = m[2];
    if (!url || processedUrls.has(url)) continue;
    processedUrls.add(url);

    const extracted = await extractTextFromPdfUrl(url);
    if (extracted === null) continue;

    const block = `${full}\n\n--- Extracted text from ${filename} ---\n${extracted}\n--- End PDF ---`;
    result = result.replace(full, block);
  }

  return result;
}

async function enrichUserContent(content: unknown): Promise<unknown> {
  if (typeof content === "string") {
    return enrichUserTextSegment(content);
  }
  if (!Array.isArray(content)) return content;

  const out = await Promise.all(
    content.map(async (part) => {
      if (part && typeof part === "object" && "type" in part) {
        const o = part as { type?: string; text?: string };
        if (o.type === "text" && typeof o.text === "string") {
          return { ...part, text: await enrichUserTextSegment(o.text) };
        }
      }
      return part;
    })
  );
  return out;
}

/** Returns a shallow-cloned message list with PDF attachment placeholders expanded to extracted text. */
export async function enrichMessagesWithPdfText(
  messages: OpenRouterChatMessage[]
): Promise<OpenRouterChatMessage[]> {
  const out: OpenRouterChatMessage[] = [];
  for (const m of messages) {
    if (m.role !== "user") {
      out.push({ ...m });
      continue;
    }
    out.push({
      ...m,
      content: await enrichUserContent(m.content),
    });
  }
  return out;
}
