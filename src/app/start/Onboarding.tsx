"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo, MicButton, Orb, Sparkle } from "@/components/ui";
import { setState, useAppState, EMPTY_PROFILE } from "@/lib/store";
import { PRESET_TRANSITIONS, confirmLine, customTransition } from "@/lib/transitions";
import type { Profile, Transition } from "@/lib/types";
import { useVoice } from "@/lib/voice";

type Step = "auth" | "name" | "age" | "location" | "transition" | "confirm" | "timeline" | "phone";
const ORDER: Step[] = ["auth", "name", "age", "location", "transition", "timeline", "confirm", "phone"];
const GENDERS = ["Woman", "Man", "Non-binary", "Prefer to self-describe", "Prefer not to say"];
const TIMELINES = ["4 weeks", "3 months", "6 months"];

const WORDNUM: Record<string, number> = { eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70 };
const ONES: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };

function parseAge(text: string): number | null {
  const d = text.match(/\d{1,3}/);
  if (d) return Number(d[0]);
  const words = text.toLowerCase().split(/[\s-]+/);
  let n = 0;
  for (const w of words) n += WORDNUM[w] ?? ONES[w] ?? 0;
  return n || null;
}

function parseName(text: string) {
  return text
    .replace(/^(hi|hey|hello)[,!.\s]*/i, "")
    .replace(/^(my name is|my name's|i'm|i am|call me|it's|it is)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function matchTransition(text: string): Transition | null {
  const t = text.toLowerCase();
  if (/promot|raise|workload/.test(t)) return PRESET_TRANSITIONS[0];
  if (/couch|running|\brun\b|runner/.test(t)) return PRESET_TRANSITIONS[1];
  if (/break.?up|boyfriend/.test(t)) return PRESET_TRANSITIONS[2];
  if (/first kid|baby|pregnan/.test(t)) return PRESET_TRANSITIONS[3];
  if (/wedding|engaged/.test(t)) return PRESET_TRANSITIONS[4];
  if (/sad summer|fun fall|winter/.test(t)) return PRESET_TRANSITIONS[5];
  return null;
}

export default function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const app = useAppState();
  const preset = PRESET_TRANSITIONS.find((t) => t.id === params.get("t")) ?? null;
  const [p, setP] = useState<Profile>(() => ({ ...EMPTY_PROFILE, transition: preset }));
  const [step, setStep] = useState<Step>("auth");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [code, setCode] = useState({ sent: "", entered: "" });
  const [selfDescribe, setSelfDescribe] = useState(false);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    if (params.get("login") && app.onboarded) router.replace("/home");
  }, [params, app.onboarded, router]);

  const prompts: Record<Step, string> = {
    auth: "Hi, I'm Peaches! Let's set some goals. First, how do you want to sign up?",
    name: "What should I call you?",
    age: `Nice to meet you${p.name ? `, ${p.name}` : ""}! How old are you? And how do you identify? That part's optional.`,
    location: "Where are you based? A city or neighborhood is perfect.",
    transition: preset ? `I see you picked ${preset.from} to ${preset.to}. Keep it, or choose another?` : "What transition are you going through?",
    confirm: p.transition ? confirmLine(p.transition, p.timeline) : "",
    timeline: "When do you want to get there?",
    phone: "Last one! What number should I text reminders to?",
  };

  const go = useCallback(
    (next: Step) => {
      setText("");
      setError("");
      setStep(next);
    },
    [],
  );

  const next = (from: Step = step) => go(ORDER[ORDER.indexOf(from) + 1]);

  const answer = (raw: string) => {
    const v = raw.trim();
    setError("");
    switch (step) {
      case "auth":
        return next();
      case "name": {
        const name = parseName(v);
        if (!name) return setError("What should I call you?");
        setP((x) => ({ ...x, name }));
        return next();
      }
      case "age": {
        const age = parseAge(v);
        if (!age || age > 120) return setError("Just the number is fine, like 29.");
        if (age < 18) return setError("Next Steps is for adults 18+. I hope we meet again in a few years! 🍑");
        const g = GENDERS.find((x) => v.toLowerCase().includes(x.toLowerCase().split(" ")[0]));
        setP((x) => ({ ...x, age, gender: g && !g.startsWith("Prefer") ? g : x.gender }));
        return next();
      }
      case "location":
        if (!v) return setError("A city or neighborhood works.");
        setP((x) => ({ ...x, location: v }));
        return next();
      case "transition": {
        if (!v) return;
        const t = matchTransition(v) ?? customTransition(v);
        setP((x) => ({ ...x, transition: t }));
        // Free-text goes through a confirm step; presets skip it.
        return go("timeline");
      }
      case "timeline": {
        const tl = TIMELINES.find((x) => v.toLowerCase().includes(x.split(" ")[0])) ?? (v || "4 weeks");
        setP((x) => ({ ...x, timeline: tl }));
        return go(p.transition?.id === "custom" ? "confirm" : "phone");
      }
      case "confirm":
        if (/^(no|nope|edit|change)/i.test(v)) return go("transition");
        return go("phone");
      case "phone":
        return;
    }
  };

  const voice = useVoice(answer);

  // Peaches speaks each prompt (after the first user gesture on the auth step).
  const spoken = useRef<Step | null>(null);
  useEffect(() => {
    if (step === "auth" || spoken.current === step) return;
    spoken.current = step;
    voice.speak(prompts[step], app.voiceEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const finish = (verified: boolean) => {
    const profile = { ...p, phoneVerified: verified, smsOptIn: verified && p.smsOptIn };
    setState({ profile, onboarded: true, planStartedAt: new Date().toISOString(), chat: [], lastEvents: [] });
    if (typeof window !== "undefined") console.info(`onboarding completed in ${Math.round((Date.now() - startedAt) / 1000)}s`);
    router.push("/trial");
  };

  const answered = ([
    { step: "name", label: "Name", value: p.name },
    { step: "age", label: "Age", value: p.age ? `${p.age}${p.gender ? ` · ${p.gender}` : ""}` : "" },
    { step: "location", label: "Location", value: p.location },
    { step: "transition", label: "Transition", value: p.transition ? `${p.transition.from} → ${p.transition.to}` : "" },
    { step: "timeline", label: "Timeline", value: ORDER.indexOf(step) > ORDER.indexOf("timeline") ? p.timeline : "" },
  ] as { step: Step; label: string; value: string }[]).filter((a) => a.value && ORDER.indexOf(a.step) < ORDER.indexOf(step));

  const progress = Math.round((ORDER.indexOf(step) / (ORDER.length - 1)) * 100);
  const showFreeText = !["auth", "confirm", "phone"].includes(step);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-2">
        <Logo />
        <span className="text-sm font-semibold text-ink-soft">{progress}%</span>
      </header>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/40" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-blue to-sky-400 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {answered.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Your answers">
          {answered.map((a) => (
            <li key={a.step}>
              <button className="chip text-sm" onClick={() => go(a.step)} aria-label={`Edit ${a.label}`}>
                <span className="text-ink-soft">{a.label}:</span> {a.value} <span aria-hidden>✎</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-6 flex items-start gap-4" aria-live="polite">
        <Orb size={64} state={voice.state} />
        <div className="pill rim-peach flex-1 px-5 py-4 text-lg font-semibold">{prompts[step]}</div>
      </section>

      <section className="mt-6 flex flex-1 flex-col gap-4">
        {step === "auth" && (
          <div className="flex flex-col gap-3">
            {["Sign in with Apple", "Continue with Google", "Email me a magic link"].map((label, i) => (
              <button
                key={label}
                className={i === 0 ? "btn-primary" : "btn-ghost"}
                onClick={() => {
                  voice.speak(prompts.name, app.voiceEnabled);
                  spoken.current = "name";
                  next();
                }}
              >
                {label}
              </button>
            ))}
            <p className="text-center text-xs text-ink-soft">Demo build: sign-in is simulated. 18+ only.</p>
          </div>
        )}

        {step === "age" && (
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3">
              <span className="w-12 font-semibold">Age</span>
              <select
                className="field"
                value={p.age ?? ""}
                onChange={(e) => {
                  const age = Number(e.target.value);
                  setP((x) => ({ ...x, age }));
                  setError(age < 18 ? "Next Steps is for adults 18+. I hope we meet again in a few years! 🍑" : "");
                }}
              >
                <option value="" disabled>
                  Select
                </option>
                {Array.from({ length: 83 }, (_, i) => i + 13).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="mb-2 text-sm font-semibold text-ink-soft">Gender (optional)</legend>
              {GENDERS.map((g) => (
                <button
                  key={g}
                  className="chip"
                  aria-pressed={p.gender === g || (g === "Prefer to self-describe" && selfDescribe)}
                  onClick={() => {
                    setSelfDescribe(g === "Prefer to self-describe");
                    setP((x) => ({ ...x, gender: g === "Prefer to self-describe" ? "" : g }));
                  }}
                >
                  {g}
                </button>
              ))}
            </fieldset>
            {selfDescribe && <input className="field" placeholder="How do you describe yourself?" onChange={(e) => setP((x) => ({ ...x, gender: e.target.value }))} />}
            <button className="btn-primary" disabled={!p.age || p.age < 18} onClick={() => next()}>
              Continue
            </button>
          </div>
        )}

        {step === "location" && (
          <div className="flex flex-wrap gap-2">
            {["Williamsburg, Brooklyn", "Manhattan", "Queens"].map((l) => (
              <button key={l} className="chip" onClick={() => answer(l)}>
                {l}
              </button>
            ))}
            <button
              className="chip"
              onClick={() =>
                navigator.geolocation?.getCurrentPosition(
                  () => answer("Williamsburg, Brooklyn"), // reverse geocoding lands in Alpha
                  () => setError("No problem, just type or say your neighborhood."),
                )
              }
            >
              📍 Use my location
            </button>
          </div>
        )}

        {step === "transition" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {PRESET_TRANSITIONS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => {
                  setP((x) => ({ ...x, transition: t }));
                  go("timeline");
                }}
                aria-pressed={p.transition?.id === t.id}
                className={`pill ${["rim-blue", "rim-peach", "rim-pink", "rim-mint", "rim-butter", "rim-peach"][i]} min-h-14 px-4 py-3 text-left`}
              >
                <span className="block text-sm text-ink-soft">{t.from} →</span>
                <span className="font-bold">{t.to}</span>
              </button>
            ))}
            <p className="text-sm font-semibold text-ink-soft sm:col-span-2">Something else? Say it or type it below, like “from new in town to a real friend group”.</p>
          </div>
        )}

        {step === "confirm" && (
          <div className="flex gap-3">
            <button className="btn-primary flex-1" onClick={() => answer("yes")}>
              Sounds right
            </button>
            <button className="btn-ghost flex-1" onClick={() => answer("edit")}>
              Edit
            </button>
          </div>
        )}

        {step === "timeline" && (
          <div className="flex flex-wrap gap-2">
            {TIMELINES.map((tl) => (
              <button key={tl} className="chip" onClick={() => answer(tl)}>
                {tl}
              </button>
            ))}
            <label className="chip">
              📅
              <input type="date" className="bg-transparent outline-none" aria-label="Specific date" onChange={(e) => e.target.value && answer(new Date(e.target.value + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))} />
            </label>
          </div>
        )}

        {step === "phone" && (
          <div className="flex flex-col gap-3">
            <input
              className="field"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 555-0123"
              value={p.phone}
              onChange={(e) => setP((x) => ({ ...x, phone: e.target.value }))}
            />
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-blue-600" checked={p.smsOptIn} onChange={(e) => setP((x) => ({ ...x, smsOptIn: e.target.checked }))} />
              <span>
                Yes, text me reminders for my plan from Next Steps.IO. Msg &amp; data rates may apply. Up to 1 message a day plus event reminders. Reply STOP to unsubscribe.
              </span>
            </label>
            {!code.sent ? (
              <button
                className="btn-primary"
                disabled={p.phone.replace(/\D/g, "").length < 10 || !p.smsOptIn}
                onClick={() => setCode({ sent: String(Math.floor(100000 + Math.random() * 900000)), entered: "" })}
              >
                Send my code
              </button>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  Demo mode: no SMS is sent. Your code is <strong className="text-ink">{code.sent}</strong>.
                </p>
                <input className="field tracking-[0.4em]" inputMode="numeric" maxLength={6} placeholder="123456" value={code.entered} onChange={(e) => setCode((c) => ({ ...c, entered: e.target.value.replace(/\D/g, "") }))} />
                <button className="btn-primary" disabled={code.entered !== code.sent} onClick={() => finish(true)}>
                  <Sparkle /> Build my plan
                </button>
              </>
            )}
            <button className="text-sm font-semibold text-ink-soft underline" onClick={() => finish(false)}>
              Skip texts for now
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="pill rim-pink px-4 py-3 text-sm font-semibold">
            {error}
          </p>
        )}
      </section>

      {showFreeText && (
        <form
          className="sticky bottom-0 mt-6 flex items-center gap-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            answer(text);
          }}
        >
          <input className="field flex-1" value={voice.interim || text} onChange={(e) => setText(e.target.value)} placeholder={voice.state === "listening" ? "Listening…" : "Type or tap the mic"} aria-label="Your answer" />
          <MicButton state={voice.state} disabled={!voice.supported.stt} onPress={() => (voice.state === "listening" ? voice.stopListening() : voice.listen())} />
        </form>
      )}
    </main>
  );
}
