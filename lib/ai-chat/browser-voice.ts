/** Browser-only speech: Web Speech API (STT) + SpeechSynthesis (TTS). */

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition })
        .webkitSpeechRecognition,
  );
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

/** BCP 47 tag for recognition (best-effort from app locale). */
export function recognitionLangFromLocale(locale: string): string {
  const l = (locale ?? "en").toLowerCase();
  if (l.startsWith("ar")) return "ar-SA";
  if (l.startsWith("en")) return "en-US";
  return `${l.slice(0, 2)}-${l.slice(0, 2).toUpperCase()}`;
}

export function synthesisLangFromLocale(locale: string): string {
  return recognitionLangFromLocale(locale);
}

export function speakText(text: string, lang: string, onEnd?: () => void): void {
  if (typeof window === "undefined" || !text.trim()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.trim());
  u.lang = lang;
  u.rate = 1;
  u.pitch = 1;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
}

/** Wait until the utterance has been spoken (or skipped if empty). */
export function speakTextAsync(text: string, lang: string): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    speakText(text, lang, resolve);
  });
}
