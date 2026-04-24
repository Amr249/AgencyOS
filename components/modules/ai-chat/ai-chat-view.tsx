"use client";

import * as React from "react";
import {
  ArrowUp,
  Brain,
  FileText,
  Globe,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  PhoneCall,
  Search,
  Volume2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { AssistantMarkdown } from "@/components/modules/ai-chat/assistant-markdown";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SiriOrb } from "@/components/ui/siri-orb";
import { ModelBrandIcon } from "@/components/modules/ai-chat/model-brand-icon";
import {
  type ChatAttachment,
  type StoredChatMessage,
  toOpenRouterMessages,
} from "@/lib/ai-chat/openrouter-messages";
import {
  speakText,
  speakTextAsync,
  speechRecognitionSupported,
  stopSpeaking,
  synthesisLangFromLocale,
} from "@/lib/ai-chat/browser-voice";
import { waitForUtterance } from "@/lib/ai-chat/wait-for-utterance";
import { useAiChatVoiceInput } from "@/hooks/use-ai-chat-voice-input";

export type { ChatAttachment } from "@/lib/ai-chat/openrouter-messages";

const STORAGE_KEY = "agencyos.ai-chat.v1";

function isImageAttachment(a: Pick<ChatAttachment, "mimeType" | "name">): boolean {
  const mime = a.mimeType?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(a.name);
}

function isPdfAttachment(a: Pick<ChatAttachment, "mimeType" | "name">): boolean {
  const mime = a.mimeType?.toLowerCase() ?? "";
  if (mime.includes("pdf")) return true;
  return /\.pdf$/i.test(a.name);
}

type AttachmentPreviewState =
  | { kind: "image"; url: string; name: string }
  | { kind: "pdf"; url: string; name: string }
  | { kind: "file"; url: string; name: string };

function previewKindForAttachment(a: ChatAttachment): AttachmentPreviewState["kind"] {
  if (isImageAttachment(a)) return "image";
  if (isPdfAttachment(a)) return "pdf";
  return "file";
}

export type ChatMessage = StoredChatMessage;

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
  model: string;
};

type ModelRow = {
  id: string;
  label: string;
  /** Path under `/public` (shared model picker icon: `public/model-icon.png`). */
  iconSrc: string;
};

export const OPENROUTER_MODELS: ModelRow[] = [
  {
    id: "inclusionai/ling-2.6-1t:free",
    label: "Ling 2.6 1T (free)",
    iconSrc: "/model-icon.png",
  },
  {
    id: "tencent/hy3-preview:free",
    label: "Tencent HY3 Preview (free)",
    iconSrc: "/model-icon.png",
  },
];

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    /* quota */
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function sessionGroup(ts: number): "today" | "yesterday" | "week" | "older" {
  const now = new Date();
  const t0 = startOfDay(now);
  const y = new Date(t0 - 86400000);
  const weekAgo = t0 - 7 * 86400000;
  if (ts >= t0) return "today";
  if (ts >= y.getTime()) return "yesterday";
  if (ts >= weekAgo) return "week";
  return "older";
}

async function consumeOpenAIStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onDelta: (t: string) => void
) {
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const piece = json.choices?.[0]?.delta?.content;
        if (piece) onDelta(piece);
      } catch {
        /* incomplete json line */
      }
    }
  }
}

export function AiChatView() {
  const t = useTranslations("aiChat");
  const locale = useLocale();

  const [sessions, setSessions] = React.useState<ChatSession[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [input, setInput] = React.useState("");
  const [model, setModel] = React.useState(OPENROUTER_MODELS[0].id);
  const [streaming, setStreaming] = React.useState(false);
  const [pendingAttachments, setPendingAttachments] = React.useState<ChatAttachment[]>([]);
  const [attachmentPreview, setAttachmentPreview] =
    React.useState<AttachmentPreviewState | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const inputRef = React.useRef(input);
  inputRef.current = input;

  const {
    listening: voiceListening,
    supported: voiceSupported,
    toggle: toggleVoice,
    stop: stopVoiceInput,
  } = useAiChatVoiceInput({
      locale,
      getPrefix: () => inputRef.current,
      setComposerText: setInput,
      onRecognitionError: (msg) => {
        const lower = msg.toLowerCase();
        if (lower.includes("permission") || lower.includes("not-allowed")) {
          toast.error(t("voiceMicDenied"));
        } else {
          toast.error(msg);
        }
      },
    });

  const [ttsMessageIndex, setTtsMessageIndex] = React.useState<number | null>(null);
  const ttsLang = React.useMemo(() => synthesisLangFromLocale(locale), [locale]);

  const [callMode, setCallMode] = React.useState(false);
  const [callListening, setCallListening] = React.useState(false);
  const [callTranscript, setCallTranscript] = React.useState("");
  const callModeRef = React.useRef(false);
  const streamingRef = React.useRef(false);
  const callAbortRef = React.useRef<AbortController | null>(null);
  const callLoopRunningRef = React.useRef(false);
  const sendMessageRef = React.useRef<
    ((text?: string, opts?: { fromVoiceCall?: boolean }) => Promise<string | null>) | null
  >(null);

  React.useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  const allowedModelIds = React.useMemo(
    () => new Set(OPENROUTER_MODELS.map((m) => m.id)),
    []
  );

  React.useEffect(() => {
    const list = loadSessions();
    const normalized = list.map((s) => ({
      ...s,
      model: allowedModelIds.has(s.model) ? s.model : OPENROUTER_MODELS[0].id,
      messages: (s.messages ?? []).map((msg) => {
        const base = msg as ChatMessage;
        return {
          role: base.role,
          content: typeof base.content === "string" ? base.content : "",
          ...(base.role === "user" && base.attachments?.length
            ? { attachments: base.attachments }
            : {}),
        };
      }),
    }));
    setSessions(normalized);
    if (normalized.length > 0)
      setActiveId(normalized.sort((a, b) => b.updatedAt - a.updatedAt)[0].id);
    setHydrated(true);
  }, [allowedModelIds]);

  React.useEffect(() => {
    if (!hydrated) return;
    saveSessions(sessions);
  }, [sessions, hydrated]);

  const active = sessions.find((s) => s.id === activeId) ?? null;

  React.useEffect(() => {
    if (!active?.messages.length) return;
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages]);

  function stopCallModeInternal() {
    callModeRef.current = false;
    setCallMode(false);
    callAbortRef.current?.abort();
    callLoopRunningRef.current = false;
    setCallListening(false);
    setCallTranscript("");
  }

  function newChat() {
    stopCallModeInternal();
    stopVoiceInput();
    stopSpeaking();
    setTtsMessageIndex(null);
    const id = crypto.randomUUID();
    const session: ChatSession = {
      id,
      title: t("newChatTitle"),
      updatedAt: Date.now(),
      messages: [],
      model,
    };
    setSessions((prev) => [session, ...prev]);
    setActiveId(id);
    setInput("");
    setPendingAttachments([]);
  }

  function selectSession(id: string) {
    stopCallModeInternal();
    stopVoiceInput();
    stopSpeaking();
    setTtsMessageIndex(null);
    setActiveId(id);
    const s = sessions.find((x) => x.id === id);
    if (s) setModel(allowedModelIds.has(s.model) ? s.model : OPENROUTER_MODELS[0].id);
    setPendingAttachments([]);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("scope", "ai-chat");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          name?: string;
          mimeType?: string | null;
          error?: string;
        };
        const uploadedUrl = data.url;
        if (!res.ok || !uploadedUrl) {
          throw new Error(typeof data.error === "string" ? data.error : t("uploadFailed"));
        }
        setPendingAttachments((prev) => [
          ...prev,
          {
            url: uploadedUrl,
            name: data.name ?? file.name,
            mimeType: data.mimeType ?? file.type ?? undefined,
          },
        ]);
      }
      toast.success(t("uploadSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function openAttachmentPreview(a: ChatAttachment) {
    setAttachmentPreview({
      kind: previewKindForAttachment(a),
      url: a.url,
      name: a.name,
    });
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, query]);

  const grouped = React.useMemo(() => {
    const buckets: Record<"today" | "yesterday" | "week" | "older", ChatSession[]> = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };
    const sorted = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
    for (const s of sorted) {
      buckets[sessionGroup(s.updatedAt)].push(s);
    }
    return buckets;
  }, [filtered]);

  async function sendMessage(
    override?: string,
    opts?: { fromVoiceCall?: boolean }
  ): Promise<string | null> {
    const fromVoice = opts?.fromVoiceCall === true;
    const text = (override ?? input).trim();
    const attachments = fromVoice ? [] : [...pendingAttachments];
    if ((!text && !attachments.length) || streaming) return null;

    const sessionId = activeId ?? crypto.randomUUID();
    const prevSession = sessions.find((s) => s.id === sessionId);
    const baseMessages = prevSession?.messages ?? [];
    const title =
      baseMessages.length === 0
        ? text.trim()
          ? text.slice(0, 48) + (text.length > 48 ? "…" : "")
          : attachments[0]
            ? (attachments[0].name || "File").slice(0, 48)
            : t("newChatTitle")
        : (prevSession?.title ?? t("newChatTitle"));

    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      ...(attachments.length ? { attachments } : {}),
    };
    const apiMessages = toOpenRouterMessages([...baseMessages, userMsg]);

    const nextSession: ChatSession = {
      id: sessionId,
      title,
      updatedAt: Date.now(),
      messages: [...baseMessages, userMsg, { role: "assistant", content: "" }],
      model,
    };

    setSessions((list) => {
      const rest = list.filter((s) => s.id !== sessionId);
      return [nextSession, ...rest];
    });
    setActiveId(sessionId);
    if (!fromVoice) {
      setInput("");
      setPendingAttachments([]);
    }
    stopSpeaking();
    setTtsMessageIndex(null);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          model,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : t("sendError"));
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error(t("sendError"));

      let acc = "";
      await consumeOpenAIStream(reader, (piece) => {
        acc += piece;
        setSessions((list) =>
          list.map((s) => {
            if (s.id !== sessionId) return s;
            const msgs = [...s.messages];
            const lastI = msgs.length - 1;
            if (lastI >= 0 && msgs[lastI].role === "assistant") {
              msgs[lastI] = { role: "assistant", content: acc };
            }
            return { ...s, messages: msgs, updatedAt: Date.now(), model };
          })
        );
      });
      return acc;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("sendError"));
      setSessions((list) =>
        list.map((s) => {
          if (s.id !== sessionId) return s;
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant" && !last.content.trim()) {
            msgs.pop();
          }
          return { ...s, messages: msgs };
        })
      );
      return null;
    } finally {
      setStreaming(false);
    }
  }

  sendMessageRef.current = sendMessage;

  async function runVoiceCallLoop() {
    if (callLoopRunningRef.current) return;
    callLoopRunningRef.current = true;
    callAbortRef.current?.abort();
    const ac = new AbortController();
    callAbortRef.current = ac;

    try {
      while (callModeRef.current) {
        while (streamingRef.current && callModeRef.current) {
          await new Promise((r) => setTimeout(r, 220));
        }
        if (!callModeRef.current) break;

        const utterance = await waitForUtterance({
          locale,
          signal: ac.signal,
          silenceMs: 1600,
          onPartial: (p) => setCallTranscript(p),
          onListeningChange: setCallListening,
        });

        if (!callModeRef.current) break;
        if (!utterance.trim()) {
          await new Promise((r) => setTimeout(r, 120));
          continue;
        }

        setCallTranscript("");
        const reply = await sendMessageRef.current?.(utterance, { fromVoiceCall: true });
        if (!callModeRef.current) break;
        if (reply?.trim()) {
          await speakTextAsync(reply, ttsLang);
          await new Promise((r) => setTimeout(r, 450));
        }
      }
    } catch (e) {
      if (callModeRef.current) {
        toast.error(e instanceof Error ? e.message : t("sendError"));
      }
    } finally {
      callLoopRunningRef.current = false;
      setCallListening(false);
      setCallTranscript("");
    }
  }

  function toggleCallMode() {
    if (callModeRef.current) {
      stopCallModeInternal();
      return;
    }
    if (!speechRecognitionSupported()) {
      toast.error(t("voiceUnsupported"));
      return;
    }
    stopVoiceInput();
    stopSpeaking();
    setTtsMessageIndex(null);
    callModeRef.current = true;
    setCallMode(true);
    void runVoiceCallLoop();
  }

  function applyQuick(kind: "summary" | "research") {
    const presets = {
      summary: t("quickSummary"),
      research: t("quickResearch"),
    };
    setInput((prev) => (prev ? `${prev}\n${presets[kind]}` : presets[kind]));
  }

  const showHero = !active?.messages.length;

  const selectedModelRow =
    OPENROUTER_MODELS.find((m) => m.id === model) ?? OPENROUTER_MODELS[0];

  return (
    <div
      className={cn(
        "flex flex-col gap-0 overflow-hidden rounded-xl border border-border bg-background",
        /* Fixed viewport height so only inner regions scroll — not the dashboard page */
        "h-[calc(100dvh-10rem)] max-h-[calc(100dvh-10rem)] min-h-0",
        "md:h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-8rem)] md:flex-row md:items-stretch"
      )}
    >
      {/* Inner chat sidebar: New chat, search, history */}
      <aside className="flex min-h-0 w-full max-h-[min(280px,42vh)] shrink-0 flex-col border-b border-border bg-muted/30 md:max-h-none md:w-[280px] md:border-e md:border-b-0">
        <div className="p-3 pb-2">
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchChatsPlaceholder")}
              className="h-10 rounded-xl bg-background ps-9"
              aria-label={t("searchChatsPlaceholder")}
            />
            <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          </div>
        </div>

        <div className="text-muted-foreground px-3 pb-1 text-xs font-semibold uppercase tracking-wide">
          {t("chatHistory")}
        </div>

        <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
          <div className="space-y-4 pb-2">
            {sessions.length === 0 ? (
              <p className="text-muted-foreground px-2 py-2 text-sm">{t("noChatsYet")}</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground px-2 py-2 text-sm">{t("noSearchResults")}</p>
            ) : (
              (["today", "yesterday", "week", "older"] as const).map((key) => {
                const list = grouped[key];
                if (list.length === 0) return null;
                return (
                  <div key={key}>
                    <p className="text-muted-foreground mb-2 px-2 text-xs font-semibold uppercase tracking-wide">
                      {t(`group.${key}`)}
                    </p>
                    <div className="space-y-0.5">
                      {list.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectSession(s.id)}
                          className={cn(
                            "hover:bg-muted/80 line-clamp-2 w-full rounded-lg px-3 py-2 text-start text-sm transition-colors",
                            activeId === s.id && "bg-muted font-medium"
                          )}
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-3">
          <Button
            type="button"
            className="h-11 w-full rounded-xl bg-foreground font-semibold text-background hover:bg-foreground/90"
            onClick={() => newChat()}
          >
            + {t("newChat")}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showHero ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
              <div className="relative flex flex-col items-center px-2">
                <div className="origin-center scale-[0.92] sm:scale-100">
                  <SiriOrb size="208px" animationDuration={22} className="drop-shadow-2xl" />
                </div>
                <p className="text-muted-foreground mt-8 max-w-md text-center text-lg font-medium tracking-tight sm:text-xl">
                  {t("heroAssist")}
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1 px-4 pt-6">
              <div className="mx-auto max-w-3xl space-y-6 pb-4">
                {active?.messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        m.role === "user"
                          ? "bg-foreground text-background"
                          : "border border-border bg-muted/40"
                      )}
                    >
                      {m.role === "assistant" && m.content.trim() ? (
                        <div className="mb-2 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                            aria-label={
                              ttsMessageIndex === i ? t("stopSpeaking") : t("readAloud")
                            }
                            onClick={() => {
                              const text = m.content.trim();
                              if (!text) return;
                              if (ttsMessageIndex === i) {
                                stopSpeaking();
                                setTtsMessageIndex(null);
                                return;
                              }
                              stopSpeaking();
                              speakText(text, ttsLang, () => setTtsMessageIndex(null));
                              setTtsMessageIndex(i);
                            }}
                          >
                            <Volume2 className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                      {m.role === "user" && m.attachments && m.attachments.length > 0 ? (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {m.attachments.map((a, j) =>
                            isImageAttachment(a) ? (
                              <button
                                key={`${a.url}-${j}`}
                                type="button"
                                onClick={() => openAttachmentPreview(a)}
                                className="ring-offset-background max-w-full rounded-lg border border-white/25 ring-white/30 transition hover:ring-white/50 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element -- ImageKit URL */}
                                <img
                                  src={a.url}
                                  alt=""
                                  className="max-h-48 max-w-full rounded-[inherit] object-contain"
                                />
                              </button>
                            ) : (
                              <button
                                key={`${a.url}-${j}`}
                                type="button"
                                onClick={() => openAttachmentPreview(a)}
                                className="bg-background/15 hover:bg-background/25 inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-start text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                              >
                                <FileText className="size-3.5 shrink-0" />
                                <span className="truncate">{a.name}</span>
                              </button>
                            )
                          )}
                        </div>
                      ) : null}
                      {m.role === "assistant" ? (
                        m.content.trim() ? (
                          <AssistantMarkdown content={m.content} />
                        ) : streaming && i === active.messages.length - 1 ? (
                          <p className="text-muted-foreground text-sm">…</p>
                        ) : null
                      ) : (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-background p-3 md:p-4">
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="bg-muted/40 rounded-2xl border border-border p-0.5 shadow-sm">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,application/pdf,text/plain,text/csv,.doc,.docx,.xlsx,.zip"
                onChange={(e) => void uploadFiles(e.target.files)}
              />
              {pendingAttachments.length > 0 ? (
                <div className="flex flex-wrap gap-2 px-2 pt-2">
                  {pendingAttachments.map((a, idx) => (
                    <div key={`${a.url}-${idx}`} className="relative inline-flex">
                      <button
                        type="button"
                        onClick={() => openAttachmentPreview(a)}
                        className={cn(
                          "border-border bg-muted/80 hover:bg-muted overflow-hidden rounded-lg border text-start transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          isImageAttachment(a)
                            ? "block"
                            : "inline-flex max-w-[220px] items-center gap-1.5 px-2 py-1.5 text-xs"
                        )}
                      >
                        {isImageAttachment(a) ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element -- pending upload preview */}
                            <img
                              src={a.url}
                              alt=""
                              className="h-14 w-14 object-cover sm:h-16 sm:w-16"
                            />
                          </>
                        ) : (
                          <>
                            <FileText className="size-3.5 shrink-0 opacity-70" />
                            <span className="truncate">{a.name}</span>
                          </>
                        )}
                      </button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute -right-1.5 -top-1.5 size-6 shrink-0 rounded-full shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingAttachments((p) => p.filter((_, j) => j !== idx));
                        }}
                        aria-label={t("removeAttachment")}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="px-2 py-1">
                {callMode ? (
                  <div className="text-muted-foreground mb-2 space-y-1 px-1 text-xs">
                    <p className="text-foreground">{t("voiceCallHint")}</p>
                    <p className="min-h-[1.25rem] whitespace-pre-wrap">
                      {streaming
                        ? t("voiceCallThinking")
                        : callListening
                          ? t("voiceCallListening")
                          : callTranscript || "\u00a0"}
                    </p>
                  </div>
                ) : null}
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("inputPlaceholder")}
                  className="max-h-[100px] min-h-[36px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 md:min-h-[40px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={streaming || uploading || voiceListening || callMode || callListening}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      aria-label={t("attachFiles")}
                      disabled={streaming || uploading || voiceListening || callMode}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Paperclip className="size-4" />
                      )}
                    </Button>
                    <Select
                      value={model}
                      onValueChange={setModel}
                      disabled={streaming || voiceListening || callMode}
                    >
                      <SelectTrigger className="h-9 w-fit max-w-[260px] rounded-full border-border bg-background text-xs md:text-sm">
                        <SelectValue placeholder={selectedModelRow.label} />
                      </SelectTrigger>
                      <SelectContent position="popper" className="max-h-[min(320px,50vh)]">
                        {OPENROUTER_MODELS.map((m) => (
                          <SelectItem key={m.id} value={m.id} textValue={m.label}>
                            <span className="flex items-center gap-2">
                              <ModelBrandIcon src={m.iconSrc} />
                              <span>{m.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={voiceListening ? "secondary" : "ghost"}
                      size="icon"
                      className={cn(
                        "rounded-full",
                        voiceListening && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      )}
                      title={voiceListening ? t("voiceStop") : t("voiceStart")}
                      aria-label={voiceListening ? t("voiceStop") : t("voiceStart")}
                      aria-pressed={voiceListening}
                      disabled={!voiceSupported || streaming || uploading || callMode}
                      onClick={() => toggleVoice()}
                    >
                      {voiceListening ? (
                        <MicOff className="size-4 text-destructive" />
                      ) : (
                        <Mic className="size-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant={callMode ? "secondary" : "ghost"}
                      size="icon"
                      className={cn(
                        "rounded-full",
                        callMode && "ring-2 ring-emerald-500/80 ring-offset-2 ring-offset-background"
                      )}
                      title={callMode ? t("voiceCallStop") : t("voiceCallStart")}
                      aria-label={callMode ? t("voiceCallStop") : t("voiceCallStart")}
                      aria-pressed={callMode}
                      disabled={
                        !speechRecognitionSupported() || streaming || uploading || voiceListening
                      }
                      onClick={() => toggleCallMode()}
                    >
                      <PhoneCall className={cn("size-4", callMode && "text-emerald-600")} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      className="size-10 rounded-full"
                      disabled={
                        streaming ||
                        uploading ||
                        voiceListening ||
                        callMode ||
                        callListening ||
                        (!input.trim() && pendingAttachments.length === 0)
                      }
                      onClick={() => void sendMessage()}
                    >
                      <ArrowUp className="size-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {showHero ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-border bg-background"
                  onClick={() => applyQuick("summary")}
                >
                  <Brain className="mr-2 size-4" />
                  {t("pillSummary")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-border bg-background"
                  onClick={() => applyQuick("research")}
                >
                  <Globe className="mr-2 size-4" />
                  {t("pillResearch")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <Dialog
        open={attachmentPreview !== null}
        onOpenChange={(open) => {
          if (!open) setAttachmentPreview(null);
        }}
      >
        <DialogContent
          showCloseButton
          className={cn(
            "gap-3 sm:max-h-[calc(100vh-4rem)]",
            attachmentPreview?.kind === "image" || attachmentPreview?.kind === "pdf"
              ? "max-h-[90dvh] w-[95vw] max-w-[95vw] overflow-hidden sm:max-w-4xl"
              : "sm:max-w-lg"
          )}
        >
          {attachmentPreview ? (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pe-8">
                  {attachmentPreview.name || t("previewTitle")}
                </DialogTitle>
              </DialogHeader>

              {attachmentPreview.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- ImageKit / remote URL
                <img
                  src={attachmentPreview.url}
                  alt=""
                  className="mx-auto max-h-[min(70vh,800px)] w-auto max-w-full rounded-md object-contain"
                />
              ) : null}

              {attachmentPreview.kind === "pdf" ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs">{t("previewPdfHint")}</p>
                  <iframe
                    src={attachmentPreview.url}
                    title={attachmentPreview.name}
                    className="bg-muted h-[min(70vh,720px)] w-full rounded-md border"
                  />
                </div>
              ) : null}

              {attachmentPreview.kind === "file" ? (
                <p className="text-muted-foreground text-sm">{t("previewFileHint")}</p>
              ) : null}

              <DialogFooter>
                <Button variant="outline" asChild>
                  <a
                    href={attachmentPreview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("previewOpenTab")}
                  </a>
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
