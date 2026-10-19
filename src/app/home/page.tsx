"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarExport, EventCard, Logo, MicButton, Orb, RewardToast, Sparkle } from "@/components/ui";
import { reminderTimes } from "@/lib/calendar";
import { CRISIS_REPLY, detectCrisis, isAffirmative, isDecline, runIntent, suggestedChips } from "@/lib/intents";
import { planFor } from "@/lib/plans";
import { award, type RewardResult } from "@/lib/rewards";
import { getState, programWeek, resetState, setState, useAppState, useHydrated } from "@/lib/store";
import { formatShort, formatWhen, weekdayName } from "@/lib/time";
import type { ChatTurn, Draft, EventItem, PeachesRequest, PeachesResponse, Proposal, Stats } from "@/lib/types";
import { useVoice } from "@/lib/voice";

type Card = { events?: EventItem[]; proposal?: Proposal; draft?: Draft; stats?: Stats; added?: EventItem };

export default function Home() {
  const router = useRouter();
  const s = useAppState();
  const hydrated = useHydrated();
  const plan = useMemo(() => planFor(s.profile), [s.profile]);
  const week = programWeek(s);

  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [card, setCard] = useState<Card>({});
  const [chips, setChips] = useState<string[]>([]);
  const [reward, setReward] = useState<RewardResult | null>(null);
  const [presenting, setPresenting] = useState(-1);
  const logRef = useRef<HTMLDivElement>(null);

  const voice = useVoice((t) => send(t));
  const say = useCallback(
    (reply: string) => {
      setState((x) => ({ chat: [...x.chat, { role: "peaches" as const, text: reply }].slice(-40) }));
      voice.speak(reply, getState().voiceEnabled);
    },
    [voice],
  );

  // Redirect if not onboarded / not subscribed.
  useEffect(() => {
    if (!hydrated) return;
    if (!s.onboarded) router.replace("/start");
    else if (s.entitlement === "none") router.replace("/trial");
  }, [hydrated, s.onboarded, s.entitlement, router]);

  // Greeting: first visit presents the plan; later days pick up where you left off.
  const greeted = useRef(false);
  useEffect(() => {
    if (!hydrated || greeted.current || !s.onboarded) return;
    greeted.current = true;
    const today = new Date().toISOString().slice(0, 10);
    const returning = s.lastVisit && s.lastVisit !== today && s.chat.length > 0;
    setState({ lastVisit: today });
    const ctx = { profile: s.profile, context: { calendar: s.calendar } } as Pick<PeachesRequest, "profile" | "context">;
    setChips(suggestedChips(ctx));
    if (s.chat.length === 0) {
      const name = s.profile.name ? `${s.profile.name}! ` : "";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- start the card-by-card plan presentation once
      setPresenting(0);
      say(`Welcome, ${name}${plan.welcome} Here's your plan for the next four weeks. Tap any card to skip ahead.`);
    } else if (returning) {
      say(`Welcome back${s.profile.name ? `, ${s.profile.name}` : ""}! Let's pick up where you left off.`);
    }
  }, [hydrated, s, plan.welcome, say]);

  // Advance the plan presentation.
  useEffect(() => {
    if (presenting < 0 || presenting > 3) return;
    const t = setTimeout(() => setPresenting((p) => p + 1), 2200);
    return () => clearTimeout(t);
  }, [presenting]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [s.chat.length, card]);

  // Space or Cmd/Ctrl+K toggles the mic.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.code === "Space" && !typing)) {
        e.preventDefault();
        if (voice.state === "listening") voice.stopListening();
        else voice.listen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [voice]);

  const grant = (reason: Parameters<typeof award>[1], line?: string) => {
    const r = award(getState().rewards, reason, new Date(), line);
    setState({ rewards: r.rewards });
    setReward(r);
    return r;
  };

  const confirm = (p: Proposal) => {
    if (p.kind === "add_to_calendar") {
      const e = p.event;
      const st = getState();
      const texts = st.profile.phoneVerified && st.profile.smsOptIn;
      setState((x) => ({
        calendar: [...x.calendar.filter((c) => c.eventId !== e.id), { eventId: e.id, title: e.name, start: e.start, durationMin: e.durationMin, location: e.meetingSpot, addedAt: new Date().toISOString() }],
        reminders: texts
          ? [
              ...x.reminders,
              ...reminderTimes(e).map((at, i) => ({
                id: `${e.id}-${i}`,
                eventId: e.id,
                sendAt: at,
                channel: "sms" as const,
                body: `Peaches here 🍑 ${i === 0 ? "Tomorrow" : "In 2 hours"}: ${e.name} at ${e.meetingSpot}. Gear out! Reply STOP to opt out.`,
              })),
            ]
          : x.reminders,
      }));
      const dayBefore = weekdayName(new Date(new Date(e.start).getTime() - 86_400_000).toISOString());
      setCard({ added: e });
      say(texts ? `Done! It's on your calendar and I'll text you ${dayBefore}.` : `Done! It's on your calendar. Turn on texts in settings and I'll remind you.`);
      const first = !getState().rewards.badges.some((b) => b.id === "first-step");
      const r = grant("calendarAdd", first ? `That's how it begins. ${weekdayName(e.start)}-you is going to be proud.` : undefined);
      setTimeout(() => voice.speak(r.line, getState().voiceEnabled), 2600);
    } else {
      setState((x) => ({ reminders: [...x.reminders, { id: `r-${Date.now()}`, body: p.body, sendAt: p.sendAt, channel: "sms" }] }));
      setCard({});
      say(`Done! I'll text you ${formatWhen(p.sendAt)}.`);
    }
    setChips(suggestedChips({ profile: getState().profile, context: { calendar: getState().calendar } } as PeachesRequest));
  };

  async function send(raw: string) {
    const msg = raw.trim();
    if (!msg || busy) return;
    setText("");
    voice.stopSpeaking();
    const st = getState();
    const history: ChatTurn[] = [...st.chat, { role: "user", text: msg }];
    setState({ chat: history.slice(-40) });

    // Confirmation of a pending write is handled on-device, never by the model.
    if (card.proposal) {
      if (isAffirmative(msg)) return confirm(card.proposal);
      if (isDecline(msg)) {
        setCard({ events: card.events });
        return say("No problem. Want me to look for something else?");
      }
    }
    if (detectCrisis(msg)) return say(CRISIS_REPLY);

    const req: PeachesRequest = {
      messages: history.slice(-12),
      profile: st.profile,
      context: { calendar: st.calendar, rewards: st.rewards, week: programWeek(st), lastEvents: st.lastEvents, milestone: plan.milestone },
    };
    setBusy(true);
    voice.setState("thinking");
    let res: PeachesResponse;
    try {
      const r = await fetch("/api/peaches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) });
      if (!r.ok) throw new Error(String(r.status));
      res = await r.json();
    } catch {
      // Offline or server down: free on-device intents still work.
      res = runIntent(req) ?? { reply: "I'm offline right now, but I can still find events and show your stats.", chips: suggestedChips(req), source: "nlp" };
    } finally {
      setBusy(false);
      voice.setState("idle");
    }
    if (res.events?.length) setState({ lastEvents: res.events });
    setCard({ events: res.events, proposal: res.proposal, draft: res.draft, stats: res.stats });
    if (res.chips) setChips(res.chips);
    say(res.reply);
  }

  if (!hydrated || !s.onboarded) return null;

  const upcoming = s.calendar.filter((c) => new Date(c.start).getTime() > Date.now() - 3 * 3_600_000).sort((a, b) => a.start.localeCompare(b.start));
  const past = s.calendar.filter((c) => new Date(c.start).getTime() <= Date.now() - 3 * 3_600_000);
  const today = new Date().toISOString().slice(0, 10);
  const lastPeaches = [...s.chat].reverse().find((m) => m.role === "peaches")?.text;

  const sections = [
    {
      title: "Habits",
      rim: "rim-blue",
      body: (
        <ul className="flex flex-col gap-2">
          {plan.habits.map((h) => {
            const done = s.habitChecks[h.id]?.includes(today);
            return (
              <li key={h.id}>
                <button
                  className="flex min-h-11 w-full items-center gap-3 text-left"
                  aria-pressed={!!done}
                  onClick={() => {
                    if (done) return;
                    setState((x) => ({ habitChecks: { ...x.habitChecks, [h.id]: [...(x.habitChecks[h.id] ?? []), today] } }));
                    grant("habitCheck");
                  }}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${done ? "border-transparent bg-gradient-to-br from-blue to-sky-400 text-white" : "border-blue/40"}`} aria-hidden>
                    {done ? "✓" : ""}
                  </span>
                  <span className={done ? "line-through opacity-60" : ""}>
                    <span className="font-semibold">{h.label}</span> <span className="text-sm text-ink-soft">· {h.cadence}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      title: "Social events",
      rim: "rim-peach",
      body: (
        <>
          <ul className="list-inside list-disc space-y-1">{plan.socialEvents.map((x) => <li key={x}>{x}</li>)}</ul>
          <button className="chip mt-3" onClick={() => send(chips[1] ?? "Find something I can join this week")}>
            <Sparkle className="h-4 w-4 text-blue" /> Find one this week
          </button>
        </>
      ),
    },
    {
      title: "Mental hygiene & motivation",
      rim: "rim-mint",
      body: (
        <>
          <ul className="list-inside list-disc space-y-1">{plan.mentalHygiene.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="mt-3 rounded-2xl bg-butter/40 px-4 py-3 text-lg font-extrabold">“{plan.mantra}”</p>
        </>
      ),
    },
    {
      title: "Mentors & resources",
      rim: "rim-pink",
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-bold text-ink-soft">Reach out to</p>
            <ul className="space-y-1">{plan.mentors.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <p className="mb-1 text-sm font-bold text-ink-soft">Resources</p>
            <ul className="space-y-1">{plan.resources.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] lg:grid lg:grid-cols-[minmax(360px,420px)_1fr] lg:gap-8">
      {reward && <RewardToast points={reward.pointsAdded} badge={reward.newBadge?.label} line={reward.line} onDone={() => setReward(null)} />}

      {/* Left: Peaches + conversation (sticky on desktop) */}
      <aside className="lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:py-4">
        <header className="flex items-center justify-between py-2">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="chip !min-h-9 text-sm" aria-label={`${s.rewards.points} Peach Points, ${s.rewards.streakDays}-day streak`}>
              🍑 {s.rewards.points} · 🔥 {s.rewards.streakDays}
            </span>
            <Settings />
          </div>
        </header>

        <section className="pill rim-peach mt-3 flex flex-col p-4 lg:min-h-0 lg:flex-1" aria-label="Conversation with Peaches">
          <div className="flex items-center gap-3">
            <Orb size={56} state={busy ? "thinking" : voice.state} />
            <div className="min-w-0">
              <p className="font-extrabold">Peaches</p>
              <p className="truncate text-sm text-ink-soft">
                {voice.state === "listening" ? "Listening…" : busy ? "Thinking…" : voice.state === "speaking" ? "Speaking" : "Ask me anything about your plan"}
              </p>
            </div>
          </div>

          <div ref={logRef} className="no-scrollbar mt-3 flex max-h-[42dvh] flex-col gap-2 overflow-y-auto lg:max-h-none lg:flex-1" aria-live="polite">
            {s.chat.slice(-12).map((m, i) => (
              <p
                key={i}
                className={`max-w-[88%] rounded-2xl px-4 py-2 ${m.role === "user" ? "self-end bg-gradient-to-r from-blue to-sky-500 text-white" : "self-start bg-white/80 dark:bg-white/10"}`}
              >
                {m.text}
              </p>
            ))}
            {voice.interim && <p className="max-w-[88%] self-end rounded-2xl bg-blue/20 px-4 py-2 italic">{voice.interim}</p>}

            {card.events && !card.added && (
              <div className="flex flex-col gap-2">
                {card.events.map((e) => (
                  <div key={e.id} className="flex flex-col gap-2">
                    <EventCard e={e} />
                    {!card.proposal && (
                      <button className="chip self-start" onClick={() => setCard({ events: [e], proposal: { kind: "add_to_calendar", event: e, withReminders: true } })}>
                        Add to calendar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {card.proposal && (
              <div className="pill rim-blue flex flex-col gap-3 p-4">
                <p className="font-semibold">
                  {card.proposal.kind === "add_to_calendar"
                    ? `Add “${card.proposal.event.name}” to your calendar${s.profile.phoneVerified ? " and text you the day before and 2 hours before" : ""}?`
                    : `Text you “${card.proposal.body}” on ${formatShort(card.proposal.sendAt)}?`}
                </p>
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 !min-h-11" onClick={() => card.proposal && confirm(card.proposal)}>
                    Confirm
                  </button>
                  <button className="btn-ghost flex-1" onClick={() => send("no")}>
                    Not now
                  </button>
                </div>
              </div>
            )}

            {card.added && (
              <div className="pill rim-mint flex flex-col gap-3 p-4">
                <p className="font-bold">✓ On your calendar: {card.added.name}</p>
                <p className="text-sm text-ink-soft">Also add it to your phone’s calendar:</p>
                <CalendarExport e={card.added} />
              </div>
            )}

            {card.draft && <DraftCard draft={card.draft} onSent={() => grant("friendInvite", "Running's better together. Nice move!")} />}

            {card.stats && (
              <div className="pill rim-butter grid grid-cols-3 gap-2 p-4 text-center">
                {[
                  ["Runs", card.stats.runsCompleted],
                  ["Streak", `${card.stats.streakDays}d`],
                  ["Points", card.stats.points],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-2xl font-extrabold">{v}</p>
                    <p className="text-xs font-semibold text-ink-soft">{k}</p>
                  </div>
                ))}
                <p className="col-span-3 mt-1 text-sm">
                  Week {card.stats.week} of 4 → {card.stats.milestone}
                </p>
              </div>
            )}
          </div>

          {/* Dock: bottom thumb zone on mobile, inside the panel on desktop */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/40 bg-[var(--card)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:static lg:mt-3 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            {chips.length > 0 && (
              <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                {chips.map((c) => (
                  <button key={c} className="chip shrink-0 text-sm" onClick={() => send(c)} disabled={busy}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex items-center gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              <input className="field flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={voice.supported.stt ? "Ask Peaches anything… (Space to talk)" : "Ask Peaches anything…"} aria-label="Message Peaches" />
              <MicButton state={voice.state} disabled={!voice.supported.stt || busy} onPress={() => (voice.state === "listening" ? voice.stopListening() : voice.listen())} />
            </form>
            {lastPeaches && (
              <p className="sr-only" aria-live="polite">
                Peaches said: {lastPeaches}
              </p>
            )}
          </div>
        </section>
      </aside>

      {/* Right: the plan */}
      <main className="flex flex-col gap-5 pb-56 pt-5 lg:py-6 lg:pb-10">
        <nav aria-label="Program progress" className="pill rim-blue flex items-center gap-2 p-2">
          {[1, 2, 3, 4].map((w) => (
            <div key={w} className={`flex-1 rounded-2xl px-2 py-2 text-center text-sm font-bold ${w === week ? "bg-gradient-to-r from-blue to-sky-400 text-white" : w < week ? "bg-mint/40" : "text-ink-soft"}`} aria-current={w === week ? "step" : undefined}>
              Week {w}
            </div>
          ))}
        </nav>

        <section className="pill rim-peach p-5">
          <p className="text-sm font-bold uppercase tracking-wide text-coral">
            {s.profile.transition ? `${s.profile.transition.from} → ${s.profile.transition.to}` : "Your goal"}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{plan.welcome}</h1>
          <p className="mt-2 text-ink-soft">
            Week-4 milestone: <strong className="text-ink">{plan.milestone}</strong>
          </p>
          {week === 4 && (
            <Link href="/pro" className="btn-primary mt-4">
              <Sparkle /> See what’s next with Pro
            </Link>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          {sections.map((sec, i) => {
            const hidden = presenting >= 0 && presenting < 4 && i > presenting;
            return (
              <section
                key={sec.title}
                className={`pill ${sec.rim} p-5 transition-all duration-500 ${hidden ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100"} ${presenting === i ? "pop" : ""}`}
                onClick={() => presenting >= 0 && presenting < 4 && setPresenting(4)}
                aria-hidden={hidden}
              >
                <h2 className="mb-3 text-lg font-extrabold">{sec.title}</h2>
                {sec.body}
              </section>
            );
          })}
        </div>

        <section className="pill rim-mint p-5">
          <h2 className="mb-3 text-lg font-extrabold">Your calendar</h2>
          {upcoming.length === 0 && past.length === 0 ? (
            <p className="text-ink-soft">Nothing yet. Ask Peaches to find something this week.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {upcoming.map((c) => (
                <li key={c.eventId} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{c.title}</p>
                    <p className="text-sm text-ink-soft">{formatWhen(c.start)} · {c.location}</p>
                  </div>
                  <span className="text-xs font-semibold text-ink-soft">{s.reminders.filter((r) => r.eventId === c.eventId).length} texts</span>
                </li>
              ))}
              {past.map((c) => (
                <li key={c.eventId} className="flex items-center justify-between gap-3 opacity-80">
                  <p className="font-semibold">{c.title}</p>
                  <button
                    className="chip text-sm"
                    onClick={() => {
                      setState((x) => ({ calendar: x.calendar.filter((y) => y.eventId !== c.eventId) }));
                      grant("eventAttended", "You showed up. That's the whole secret.");
                    }}
                  >
                    I went! 🎉
                  </button>
                </li>
              ))}
            </ul>
          )}
          {s.reminders.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold">Scheduled texts ({s.reminders.length})</summary>
              <ul className="mt-2 space-y-1 text-ink-soft">
                {s.reminders.map((r) => (
                  <li key={r.id}>
                    {formatShort(r.sendAt)}: {r.body}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Demo build: texts are queued on-device; Twilio sending lands in Alpha.</p>
            </details>
          )}
        </section>

        {s.rewards.badges.length > 0 && (
          <section className="pill rim-butter flex flex-wrap gap-2 p-5" aria-label="Badges">
            {s.rewards.badges.map((b) => (
              <span key={b.id} className="chip">
                🏅 {b.label}
              </span>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function DraftCard({ draft, onSent }: { draft: Draft; onSent: () => void }) {
  const [body, setBody] = useState(draft.body);
  const [copied, setCopied] = useState(false);
  return (
    <div className="pill rim-pink flex flex-col gap-3 p-4">
      <p className="font-bold">Text to {draft.to}</p>
      <textarea className="field min-h-24 py-3" value={body} onChange={(e) => setBody(e.target.value)} aria-label={`Message to ${draft.to}`} />
      <div className="flex gap-2">
        <a className="btn-primary flex-1 !min-h-11" href={`sms:?&body=${encodeURIComponent(body)}`} onClick={onSent}>
          Open in Messages
        </a>
        <button
          className="btn-ghost"
          onClick={async () => {
            await navigator.clipboard?.writeText(body);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-ink-soft">You send it. Peaches never messages anyone but you.</p>
    </div>
  );
}

function Settings() {
  const s = useAppState();
  const router = useRouter();
  return (
    <details className="relative">
      <summary className="btn-ghost !min-h-9 cursor-pointer list-none text-sm" aria-label="Settings">
        ⚙︎
      </summary>
      <div className="pill rim-blue absolute right-0 z-50 mt-2 flex w-60 flex-col gap-2 p-3 text-sm">
        <label className="flex min-h-11 items-center justify-between gap-2 font-semibold">
          Peaches speaks aloud
          <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={s.voiceEnabled} onChange={(e) => setState({ voiceEnabled: e.target.checked })} />
        </label>
        <Link href="/pro" className="btn-ghost">
          Upgrade to Pro
        </Link>
        <button
          className="btn-ghost"
          onClick={() => {
            const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "nextsteps-data.json";
            a.click();
          }}
        >
          Export my data
        </button>
        <button
          className="btn-ghost !text-coral"
          onClick={() => {
            if (confirm("Delete your account data from this device?")) {
              resetState();
              router.replace("/");
            }
          }}
        >
          Delete my data
        </button>
      </div>
    </details>
  );
}
