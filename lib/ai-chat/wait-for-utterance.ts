import { createSpeechRecognition, recognitionLangFromLocale } from "@/lib/ai-chat/browser-voice";

/**
 * Listens with the Web Speech API until `silenceMs` passes without new speech,
 * then stops recognition and resolves with the full transcript.
 * `signal.abort()` cancels and resolves with "".
 */
export function waitForUtterance(o: {
  locale: string;
  signal: AbortSignal;
  silenceMs?: number;
  onPartial?: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
}): Promise<string> {
  const silenceMs = o.silenceMs ?? 1600;

  return new Promise((resolve) => {
    let finished = false;
    let lastEvent: SpeechRecognitionEvent | null = null;
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let rec: SpeechRecognition | null = null;

    function flush(): string {
      if (!lastEvent) return "";
      let s = "";
      for (let i = 0; i < lastEvent.results.length; i++) {
        s += lastEvent.results[i]![0]!.transcript;
      }
      return s;
    }

    function done(text: string) {
      if (finished) return;
      finished = true;
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      o.onListeningChange?.(false);
      o.signal.removeEventListener("abort", onAbort);
      resolve(text.trim());
    }

    function onAbort() {
      try {
        rec?.abort();
      } catch {
        /* */
      }
      done("");
    }

    o.signal.addEventListener("abort", onAbort);
    if (o.signal.aborted) {
      done("");
      return;
    }

    const r = createSpeechRecognition();
    if (!r) {
      done("");
      return;
    }
    rec = r;
    const active = r;

    function bumpSilenceTimer() {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        silenceTimer = null;
        try {
          active.stop();
        } catch {
          done(flush());
        }
      }, silenceMs);
    }

    active.continuous = true;
    active.interimResults = true;
    active.lang = recognitionLangFromLocale(o.locale);

    active.onresult = (ev) => {
      lastEvent = ev;
      o.onPartial?.(flush());
      bumpSilenceTimer();
    };

    active.onerror = (ev) => {
      if (ev.error === "aborted") return;
      if (ev.error === "no-speech") {
        try {
          active.stop();
        } catch {
          done(flush());
        }
        return;
      }
      try {
        active.abort();
      } catch {
        /* */
      }
      done("");
    };

    active.onend = () => {
      if (o.signal.aborted) {
        done("");
        return;
      }
      done(flush());
    };

    o.onListeningChange?.(true);
    bumpSilenceTimer();
    try {
      active.start();
    } catch {
      done("");
    }
  });
}
