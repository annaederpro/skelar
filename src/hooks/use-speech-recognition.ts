"use client";

import { useCallback, useRef, useState } from "react";

interface UseSpeechRecognitionOptions {
  lang?: string;
  /** Called with each finalized chunk of speech. */
  onResult: (transcript: string) => void;
  /** Called with the current in-progress (not yet final) phrase — enables live transcription. */
  onInterim?: (interim: string) => void;
  /** Called once recognition fully stops (after release / error / browser timeout). */
  onEnd?: () => void;
}

export function useSpeechRecognition({
  lang = "uk-UA",
  onResult,
  onInterim,
  onEnd,
}: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Keep latest callbacks without re-creating the recognition session mid-recording.
  const callbacksRef = useRef({ onResult, onInterim, onEnd });
  callbacksRef.current = { onResult, onInterim, onEnd };

  const isSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  const start = useCallback(() => {
    if (recognitionRef.current) return;

    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          callbacksRef.current.onResult(result[0].transcript);
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) {
        callbacksRef.current.onInterim?.(interim);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      callbacksRef.current.onEnd?.();
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [lang]);

  const stop = useCallback(() => {
    // onend fires asynchronously after stop() and handles cleanup + the onEnd callback.
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isSupported, isListening, start, stop };
}
