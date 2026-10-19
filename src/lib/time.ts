/** Launch market is NYC, so event wall-clock times are anchored to New York. */
export const EVENT_TZ = "America/New_York";

function offsetMinutes(at: Date, tz: string): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT-4"
  const m = part?.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1].startsWith("-") ? -1 : 1;
  return Number(m[1]) * 60 + sign * Number(m[2] ?? 0);
}

function zonedParts(at: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    y: Number(parts.year),
    mo: Number(parts.month),
    d: Number(parts.day),
    wd: weekdays.indexOf(parts.weekday),
    h: Number(parts.hour),
    mi: Number(parts.minute),
  };
}

function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(guess - offsetMinutes(new Date(guess), tz) * 60_000);
}

/**
 * Next occurrence (strictly after `now`) of a weekly slot in `tz`.
 * `weeksAhead` = 1 skips to the following week's occurrence.
 */
export function nextWeekly(
  weekday: number,
  hour: number,
  minute: number,
  now: Date,
  weeksAhead = 0,
  tz = EVENT_TZ,
): Date {
  const p = zonedParts(now, tz);
  let delta = (weekday - p.wd + 7) % 7;
  if (delta === 0 && (hour < p.h || (hour === p.h && minute <= p.mi))) delta = 7;
  delta += weeksAhead * 7;
  // Anchor on noon UTC of today's NY date to avoid DST edge drift, then add days.
  const base = new Date(Date.UTC(p.y, p.mo - 1, p.d, 12));
  base.setUTCDate(base.getUTCDate() + delta);
  return zonedToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, minute, tz);
}

export function formatWhen(iso: string, tz = EVENT_TZ): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "long", timeZone: tz });
  const p = zonedParts(d, tz);
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  const ampm = p.h < 12 ? "am" : "pm";
  const time = p.mi === 0 ? `${h12} ${ampm}` : `${h12}:${String(p.mi).padStart(2, "0")} ${ampm}`;
  return `${day} at ${time}`;
}

export function formatShort(iso: string, tz = EVENT_TZ): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

export function weekdayName(iso: string, tz = EVENT_TZ): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", timeZone: tz });
}

export const DAY_MS = 86_400_000;
