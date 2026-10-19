"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Logo, Orb, Sparkle } from "@/components/ui";
import { planFor } from "@/lib/plans";
import { PRICES, purchase, restorePurchases, supportsApplePay } from "@/lib/purchases";
import { setState, useAppState, useHydrated } from "@/lib/store";
import { useVoice } from "@/lib/voice";

export default function Trial() {
  const router = useRouter();
  const s = useAppState();
  const hydrated = useHydrated();
  const voice = useVoice(() => {});
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [applePay, setApplePay] = useState(false);
  const plan = useMemo(() => planFor(s.profile), [s.profile]);

  useEffect(() => {
    if (hydrated && (!s.onboarded || !s.signedIn)) router.replace(s.onboarded ? "/" : "/start");
  }, [hydrated, s.onboarded, s.signedIn, router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability check
    setApplePay(supportsApplePay());
    voice.speak("Your plan is ready. Try everything free for a month.", s.voiceEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [renew] = useState(() => new Date(Date.now() + 30 * 86_400_000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
  const price = period === "monthly" ? `$${PRICES.core.monthly}/month` : `$${PRICES.core.annual}/year`;

  const start = async () => {
    setBusy(true);
    await purchase("trial");
    router.push("/home");
  };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="py-2">
        <Logo />
      </header>

      {/* Blurred preview of the user's plan behind the offer */}
      <div aria-hidden className="pointer-events-none absolute inset-x-4 top-24 grid select-none gap-4 opacity-70 blur-[6px] sm:grid-cols-2">
        {[plan.habits.map((h) => h.label), plan.socialEvents, plan.mentalHygiene, plan.mentors].map((list, i) => (
          <div key={i} className={`pill ${["rim-blue", "rim-peach", "rim-mint", "rim-pink"][i]} p-5`}>
            {list.map((x) => (
              <p key={x} className="py-1 font-semibold">
                {x}
              </p>
            ))}
          </div>
        ))}
      </div>

      <section className="relative z-10 mx-auto mt-10 w-full max-w-md">
        <div className="pill rim-blue flex flex-col items-center gap-5 p-6 text-center">
          <Orb size={72} state={voice.state} />
          <h1 className="text-2xl font-extrabold tracking-tight">Your plan is ready{s.profile.name ? `, ${s.profile.name}` : ""}.</h1>
          <p className="text-ink-soft">Try everything free for a month: Peaches, event search, calendar and text reminders, and the full 4-week program.</p>

          <div role="radiogroup" aria-label="Billing period" className="flex w-full gap-2 rounded-full bg-white/40 p-1">
            {(["monthly", "annual"] as const).map((p) => (
              <button key={p} role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className="chip flex-1 justify-center">
                {p === "monthly" ? "Monthly" : "Annual · save 25%"}
              </button>
            ))}
          </div>
          <p className="text-sm">
            <strong>1 month free</strong>, then {price}. Renews {renew} unless you cancel. I&apos;ll remind you 2 days before your trial ends.
          </p>

          <button className="btn-primary w-full text-lg" disabled={busy} onClick={start}>
            {applePay ? " Pay · Start free trial" : <><Sparkle /> Start my free month</>}
          </button>
          {!applePay && (
            <div className="flex w-full gap-2">
              <button className="btn-ghost flex-1 text-sm" disabled={busy} onClick={start}>
                Card
              </button>
              <button className="btn-ghost flex-1 text-sm" disabled={busy} onClick={start}>
                Google Pay
              </button>
            </div>
          )}
          <button
            className="text-sm font-bold text-ink-soft underline underline-offset-4"
            onClick={() => {
              setState({ paywallSkipped: true });
              router.push("/home");
            }}
          >
            Skip for now, just show me my plan
          </button>
          <p className="text-xs text-ink-soft">Demo build: checkout is simulated and you won&apos;t be charged. Prices are placeholders.</p>
          <nav className="flex gap-4 text-xs font-semibold underline underline-offset-2">
            <button
              onClick={async () => {
                const e = await restorePurchases();
                setNote(e === "none" ? "No previous purchases found." : "Restored!");
              }}
            >
              Restore purchases
            </button>
            <Link href="/legal#terms">Terms</Link>
            <Link href="/legal#privacy">Privacy</Link>
          </nav>
          {note && <p className="text-xs">{note}</p>}
        </div>
      </section>
    </main>
  );
}
