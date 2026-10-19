import type { EventItem } from "./types";

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** .ics for Apple Calendar / any calendar app. Includes 1-day and 2-hour alarms. */
export function buildIcs(e: EventItem): string {
  const end = new Date(new Date(e.start).getTime() + e.durationMin * 60_000).toISOString();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Next Steps.IO//Peaches//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@nextsteps.io`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${escape(e.name)}`,
    `LOCATION:${escape(e.meetingSpot)}`,
    `DESCRIPTION:${escape(`Added by Peaches · Next Steps.IO\nSource: ${e.sourceUrl}`)}`,
    `URL:${e.sourceUrl}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(`Tomorrow: ${e.name}`)}`,
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(`In 2 hours: ${e.name}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(e: EventItem) {
  const blob = new Blob([buildIcs(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.name.replace(/[^\w]+/g, "-").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Google Calendar "add event" template link: no OAuth needed for the demo. */
export function googleCalendarUrl(e: EventItem): string {
  const end = new Date(new Date(e.start).getTime() + e.durationMin * 60_000).toISOString();
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.name,
    dates: `${icsDate(e.start)}/${icsDate(end)}`,
    location: e.meetingSpot,
    details: `Added by Peaches · Next Steps.IO\nSource: ${e.sourceUrl}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Reminder times per PRD: the day before and 2 hours before. */
export function reminderTimes(e: EventItem): string[] {
  const t = new Date(e.start).getTime();
  return [t - 86_400_000, t - 2 * 3_600_000]
    .filter((x) => x > Date.now())
    .map((x) => new Date(x).toISOString());
}
