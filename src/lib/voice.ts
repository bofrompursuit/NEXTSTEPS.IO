"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Free voice tier: Web Speech API for STT, SpeechSynthesis for TTS.
   Browsers without support fall back to tap and text. */

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";

export function useVoice(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState({ stt: false, tts: false });
  const [state, setState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const recRef = useRef<SR | null>(null);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection must run client-side
    setSupported({ stt: !!getRecognition(), tts: typeof window !== "undefined" && "speechSynthesis" in window });
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setState((s) => (s === "speaking" ? "idle" : s));
  }, []);

  const listen = useCallback(() => {
    stopSpeaking(); // barge-in
    const rec = getRecognition();
    if (!rec) return false;
    recRef.current?.abort();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = text;
      }
      setInterim(text);
    };
    rec.onerror = () => setState("idle");
    rec.onend = () => {
      setInterim("");
      setState((s) => (s === "listening" ? "idle" : s));
      if (finalText.trim()) onFinalRef.current(finalText.trim());
    };
    setState("listening");
    rec.start();
    return true;
  }, [stopSpeaking]);

  const stopListening = useCallback(() => recRef.current?.stop(), []);

  const speak = useCallback((text: string, enabled = true) => {
    if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const pick =
      voices.find((v) => /samantha|ava|allison|google us english|jenny|aria/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith("en"));
    if (pick) u.voice = pick;
    u.rate = 1.04;
    u.pitch = 1.08;
    u.onstart = () => setState("speaking");
    u.onend = () => setState((s) => (s === "speaking" ? "idle" : s));
    u.onerror = () => setState("idle");
    synth.speak(u);
  }, []);

  return { supported, state, setState, interim, listen, stopListening, speak, stopSpeaking };
}
