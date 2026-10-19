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

// One shared speech channel for the whole app: lines play strictly one at a time.
let ctx: AudioContext | undefined;
let analyser: AnalyserNode | null = null;
let current: HTMLAudioElement | null = null;
let browserSpeaking = false;
let token = 0;
let busy = false;
type Item = { text: string; onState: (s: VoiceState | ((p: VoiceState) => VoiceState)) => void; onDone?: () => void };
let queue: Item[] = [];
const buf = new Uint8Array(512);

/** Stops whatever Peaches is saying and drops anything queued. */
export function cancelSpeech() {
  token++;
  queue = [];
  busy = false;
  browserSpeaking = false;
  if (current) {
    current.onended = current.onerror = current.onplaying = null;
    current.pause();
    current = null;
  }
  analyser = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function isSpeaking() {
  return busy;
}

/** 0..1 loudness of whatever Peaches is saying right now. */
export function speechLevel(): number {
  if (analyser && current && !current.paused) {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < analyser.fftSize; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / analyser.fftSize) * 4);
  }
  if (browserSpeaking) return 0.35 + 0.3 * Math.sin(performance.now() / 90);
  return 0;
}

function playNext() {
  if (busy || !queue.length) return;
  const item = queue.shift()!;
  const mine = ++token;
  busy = true;
  let finished = false;
  const done = () => {
    if (finished || mine !== token) return;
    finished = true;
    busy = false;
    browserSpeaking = false;
    current = null;
    analyser = null;
    item.onState((s) => (s === "speaking" ? "idle" : s));
    item.onDone?.();
    playNext();
  };
  let fellBack = false;
  const fallback = () => {
    if (fellBack || mine !== token) return;
    fellBack = true;
    if (current) {
      current.onended = current.onerror = current.onplaying = null;
      current.pause();
      current = null;
    }
    if (!("speechSynthesis" in window)) return done();
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(item.text);
    const voices = synth.getVoices();
    const pick =
      voices.find((v) => /samantha|ava|allison|google us english|jenny|aria/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("en"));
    if (pick) u.voice = pick;
    u.rate = 1.04;
    u.pitch = 1.08;
    u.onstart = () => {
      if (mine !== token) return;
      browserSpeaking = true;
      item.onState("speaking");
    };
    u.onend = u.onerror = done;
    synth.speak(u);
  };
  // Natural voice first (ElevenLabs via /api/tts), browser voice if it fails.
  const audio = new Audio(`/api/tts?text=${encodeURIComponent(item.text)}`);
  current = audio;
  try {
    ctx ??= new AudioContext();
    const src = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser).connect(ctx.destination);
    void ctx.resume();
  } catch {
    analyser = null;
  }
  audio.onplaying = () => mine === token && item.onState("speaking");
  audio.onended = done;
  audio.onerror = fallback;
  audio.play().catch(fallback);
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
  // Leaving a screen silences Peaches so lines never bleed across pages.
  useEffect(() => () => cancelSpeech(), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection must run client-side
    setSupported({ stt: !!getRecognition(), tts: typeof window !== "undefined" && "speechSynthesis" in window });
  }, []);

  const stopSpeaking = useCallback(() => {
    cancelSpeech();
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

  /** Interrupts by default; pass { queue: true } to play after the current line. */
  const speak = useCallback((text: string, enabled = true, opts: { queue?: boolean; onDone?: () => void } = {}) => {
    if (!enabled || typeof window === "undefined" || !text.trim()) return opts.onDone?.();
    if (!opts.queue) cancelSpeech();
    queue.push({ text, onState: setState, onDone: opts.onDone });
    playNext();
  }, []);

  return { supported, state, setState, interim, listen, stopListening, speak, stopSpeaking };
}
