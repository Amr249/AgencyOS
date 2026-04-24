"use client";

import * as React from "react";
import {
  createSpeechRecognition,
  recognitionLangFromLocale,
  speechRecognitionSupported,
} from "@/lib/ai-chat/browser-voice";

type Options = {
  locale: string;
  /** Text in the composer when recognition starts (prepended to dictated text). */
  getPrefix: () => string;
  setComposerText: (value: string) => void;
  onRecognitionError?: (message: string) => void;
};

/**
 * Toggle microphone: streams transcript into the composer (prefix + dictated text).
 * Uses Web Speech API; Chrome/Edge/Safari vary in quality and Arabic support.
 */
export function useAiChatVoiceInput({
  locale,
  getPrefix,
  setComposerText,
  onRecognitionError,
}: Options) {
  const [listening, setListening] = React.useState(false);
  const supported = React.useMemo(() => speechRecognitionSupported(), []);
  const recRef = React.useRef<SpeechRecognition | null>(null);
  const prefixRef = React.useRef("");
  const getPrefixRef = React.useRef(getPrefix);
  const setComposerTextRef = React.useRef(setComposerText);
  const onErrRef = React.useRef(onRecognitionError);

  React.useEffect(() => {
    getPrefixRef.current = getPrefix;
  }, [getPrefix]);
  React.useEffect(() => {
    setComposerTextRef.current = setComposerText;
  }, [setComposerText]);
  React.useEffect(() => {
    onErrRef.current = onRecognitionError;
  }, [onRecognitionError]);

  const stop = React.useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const start = React.useCallback(() => {
    const rec = createSpeechRecognition();
    if (!rec) {
      onErrRef.current?.("Speech recognition is not supported in this browser.");
      return;
    }

    prefixRef.current = getPrefixRef.current();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = recognitionLangFromLocale(locale);

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let piece = "";
      for (let i = 0; i < event.results.length; i++) {
        piece += event.results[i]![0]!.transcript;
      }
      const prefix = prefixRef.current;
      const join =
        prefix && piece
          ? `${prefix.endsWith(" ") || piece.startsWith(" ") ? "" : " "}${piece}`
          : piece;
      setComposerTextRef.current(`${prefix}${join}`);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      const msg =
        event.error === "not-allowed"
          ? "Microphone permission denied."
          : `Speech recognition error: ${event.error}`;
      onErrRef.current?.(msg);
    };

    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (e) {
      onErrRef.current?.(e instanceof Error ? e.message : "Could not start microphone.");
    }
  }, [locale]);

  const toggle = React.useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  React.useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* */
      }
      recRef.current = null;
    };
  }, []);

  return { listening, supported, toggle, stop };
}
