"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo, Orb, Sparkle } from "@/components/ui";
import { PRICES, purchase, supportsApplePay } from "@/lib/purchases";
import { useAppState } from "@/lib/store";

const RAILS = [
  { title: "Live events this month", rim: "rim-peach", items: ["Hosted group run + brunch", "Goal-setting workshop", "Pace-group clinic"] },
  { title: "Podcasts for your goal", rim: "rim-mint", items: ["From couch to 10K", "Motivation in 10 minutes", "Stories of second chapters"] },
  { title: "New programs", rim: "rim-pink", items: ["Weeks 5–12: Build to 10K", "Confidence at work", "Healthy habits for winter"] },
];

export default function Pro() {
  const s = useAppState();
  const router = useRouter();
  const [annual, setAnnual] = useState(true);
  const [busy, setBusy] = useState(false);
  const savings = Math.round((1 - PRICES.pro.annual / (PRICES.pro.monthly * 12)) * 100);
  const isPro = s.entitlement === "pro";

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between py-2">
        <Logo />
        <Link href="/home" className="btn-ghost text-sm">
          Back to plan
        </Link>
      </header>

      <section className="flex flex-col items-center gap-4 text-center">
        <Orb size={96} />
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Keep the momentum going.</h1>
        <p className="max-w-lg text-ink-soft">
          {s.profile.name ? `${s.profile.name}, look` : "Look"} at your wins: {s.rewards.points} Peach Points, a {s.rewards.streakDays}-day streak,{" "}
          {s.rewards.badges.length} badge{s.rewards.badges.length === 1 ? "" : "s"} and {s.rewards.runsCompleted} event{s.rewards.runsCompleted === 1 ? "" : "s"} attended.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {RAILS.map((r) => (
          <section key={r.title} className={`pill ${r.rim} p-5`}>
            <h2 className="mb-3 font-extrabold">{r.title}</h2>
            <ul className="space-y-2">
              {r.items.map((i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span>{i}</span>
                  <span aria-label="Locked" className="text-sm">🔒</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-soft">Sample lineup, content partners TBD.</p>
          </section>
        ))}
      </div>

      <section className="pill rim-blue mx-auto flex w-full max-w-md flex-col items-center gap-4 p-6 text-center">
        <div role="radiogroup" aria-label="Billing period" className="flex w-full gap-2">
          <button role="radio" aria-checked={!annual} className="chip flex-1 justify-center" onClick={() => setAnnual(false)}>
            ${PRICES.pro.monthly}/mo
          </button>
          <button role="radio" aria-checked={annual} className="chip flex-1 justify-center" onClick={() => setAnnual(true)}>
            ${PRICES.pro.annual}/yr · save {savings}%
          </button>
        </div>
        <ul className="text-left text-sm">
          <li>✓ Unlimited enhanced Peaches voice</li>
          <li>✓ Up to 3 active goals</li>
          <li>✓ Live events, podcasts, programs past week 4</li>
        </ul>
        <button
          className="btn-primary w-full text-lg"
          disabled={busy || isPro}
          onClick={async () => {
            setBusy(true);
            await purchase("pro");
            router.push("/home");
          }}
        >
          {isPro ? "You're Pro 🎉" : supportsApplePay() ? " Pay · Go Pro" : <><Sparkle /> Go Pro</>}
        </button>
        <p className="text-xs text-ink-soft">Demo build: checkout is simulated. Prices are placeholders.</p>
      </section>
    </main>
  );
}
