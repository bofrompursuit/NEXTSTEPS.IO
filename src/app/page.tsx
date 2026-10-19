"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo, Orb, Sparkle } from "@/components/ui";
import { PRESET_TRANSITIONS } from "@/lib/transitions";
import { useAppState, useHydrated } from "@/lib/store";
import { useVoice } from "@/lib/voice";

const RIMS = ["rim-blue", "rim-peach", "rim-pink", "rim-mint", "rim-butter", "rim-peach"];

export default function Landing() {
  const s = useAppState();
  const hydrated = useHydrated();
  const voice = useVoice(() => {});
  const [said, setSaid] = useState(false);
  const returning = hydrated && s.onboarded;

  const hello = () => {
    // Browsers block autoplay audio, so the hello plays on first tap.
    voice.speak(
      returning
        ? `Welcome back${s.profile.name ? `, ${s.profile.name}` : ""}! Ready for your next step?`
        : "Hi, I'm Peaches! Tell me where you are and where you want to be, and we'll take the first step together.",
    );
    setSaid(true);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-2">
        <Logo />
        <Link href={returning ? "/home" : "/start?login=1"} className="btn-ghost text-sm">
          Log in
        </Link>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-7 py-8 text-center lg:flex-row lg:gap-16 lg:text-left">
        <div className="flex flex-col items-center gap-3">
          <Orb size={168} state={voice.state} onClick={hello} label="Say hello to Peaches" />
          <p className="text-sm font-semibold text-ink-soft">{said ? "That's Peaches 🍑" : "Tap Peaches to say hi"}</p>
        </div>

        <div className="flex w-full max-w-xl flex-col items-center gap-6 lg:items-start">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Your next chapter starts with <span className="bg-gradient-to-r from-blue to-sky-400 bg-clip-text text-transparent">one step.</span>
          </h1>
          <p className="text-lg text-ink-soft">
            Tell Peaches where you are and where you want to be. She builds a 4-week plan, then finds the run club, books it, texts the
            reminder and cheers you on.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href={returning ? "/home" : "/start"} className="btn-primary text-lg">
              <Sparkle /> {returning ? "Pick up where you left off" : "Start with Peaches"}
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Sample transitions" className="relative -mx-4 overflow-hidden py-4">
        <div className="marquee flex w-max gap-4 px-4">
          {[...PRESET_TRANSITIONS, ...PRESET_TRANSITIONS].map((t, i) => (
            <Link
              key={`${t.id}-${i}`}
              href={`/start?t=${t.id}`}
              className={`pill ${RIMS[i % RIMS.length]} flex min-h-14 items-center gap-3 px-5 py-3 text-sm`}
              tabIndex={i >= PRESET_TRANSITIONS.length ? -1 : 0}
              aria-hidden={i >= PRESET_TRANSITIONS.length}
            >
              <span className="text-ink-soft">{t.from}</span>
              <span aria-hidden className="text-blue">→</span>
              <span className="font-bold">{t.to}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
