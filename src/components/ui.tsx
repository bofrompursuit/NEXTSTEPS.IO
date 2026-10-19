"use client";

import Link from "next/link";
import { useEffect } from "react";
import { googleCalendarUrl, downloadIcs } from "@/lib/calendar";
import { formatWhen } from "@/lib/time";
import type { EventItem } from "@/lib/types";
import type { VoiceState } from "@/lib/voice";

export function Sparkle({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 2c.6 4.7 2.9 7.3 8 8-5.1.7-7.4 3.3-8 8-.6-4.7-2.9-7.3-8-8 5.1-.7 7.4-3.3 8-8z" />
      <path d="M19.5 14c.3 2 1.2 3 3 3.3-1.8.3-2.7 1.3-3 3.2-.3-1.9-1.2-2.9-3-3.2 1.8-.3 2.7-1.3 3-3.3z" opacity=".75" />
    </svg>
  );
}

export function MicIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-ink">
      <span className="orb inline-block h-7 w-7" aria-hidden />
      <span>
        Next Steps<span className="text-blue">.IO</span>
      </span>
    </Link>
  );
}

export function Orb({ state = "idle", size = 96, onClick, label = "Peaches" }: { state?: VoiceState; size?: number; onClick?: () => void; label?: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      aria-label={onClick ? label : undefined}
      role={onClick ? undefined : "img"}
      aria-roledescription={onClick ? undefined : "Peaches avatar"}
      className="orb shrink-0"
      data-state={state}
      style={{ width: size, height: size }}
    />
  );
}

export function MicButton({ state, onPress, disabled }: { state: VoiceState; onPress: () => void; disabled?: boolean }) {
  const listening = state === "listening";
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Talk to Peaches"}
      className="btn-primary !h-16 !w-16 !min-h-0 !rounded-full !p-0 shrink-0 disabled:opacity-40"
      data-state={state}
      style={listening ? { animation: "pulse 1.1s ease-in-out infinite" } : undefined}
    >
      <MicIcon />
    </button>
  );
}

export function EventCard({ e, compact }: { e: EventItem; compact?: boolean }) {
  return (
    <article className="pill rim-peach p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold leading-tight">{e.name}</h4>
        {e.beginnerFriendly && <span className="rounded-full bg-mint/30 px-2 py-0.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">Beginner</span>}
      </div>
      <p className="mt-1 text-sm font-semibold text-blue">{formatWhen(e.start)}</p>
      <p className="text-sm text-ink-soft">{e.meetingSpot}</p>
      {!compact && (
        <p className="mt-1 text-xs text-ink-soft">
          {e.pace ? `${e.pace} · ` : ""}
          {e.distanceMi} mi away
        </p>
      )}
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
          Source: {e.sourceName}
        </a>
        {e.seeded && <span className="rounded-full bg-butter/50 px-2 py-0.5 font-bold text-amber-900 dark:text-amber-100" title="Seeded demo listing. Confirm details at the source.">Demo listing</span>}
      </p>
    </article>
  );
}

export function CalendarExport({ e }: { e: EventItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a className="btn-ghost text-sm" href={googleCalendarUrl(e)} target="_blank" rel="noreferrer">
        Google Calendar
      </a>
      <button className="btn-ghost text-sm" onClick={() => downloadIcs(e)}>
        Apple / .ics
      </button>
    </div>
  );
}

export function RewardToast({ points, badge, line, onDone }: { points: number; badge?: string; line: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div role="status" className="fixed inset-x-0 top-6 z-50 flex justify-center px-4" onClick={onDone}>
      <div className="pill rim-butter pop flex max-w-md items-center gap-4 px-5 py-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-butter to-peach text-2xl" aria-hidden>
          {badge ? "🏅" : "🍑"}
        </div>
        <div>
          <p className="font-extrabold">
            {badge ? `${badge} badge` : "Nice!"} · +{points} Peach Points
          </p>
          <p className="text-sm text-ink-soft">{line}</p>
        </div>
      </div>
    </div>
  );
}
