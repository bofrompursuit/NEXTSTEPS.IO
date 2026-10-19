import { findEvents, nearbyClubs } from "./events";
import { formatWhen, weekdayName } from "./time";
import type { EventItem, PeachesRequest, PeachesResponse, Stats } from "./types";

/**
 * Free, zero-cost intent parser for the common commands (the PRD's "free NLP" tier).
 * Anything it doesn't recognise returns null and goes to Claude.
 */

const CRISIS =
  /\b(suicid\w*|kill (my|him|her)self|end (it all|my life)|self[- ]?harm|hurt(ing)? myself|(don'?t|do not) want to (live|be alive|be here)|want to die|no reason to live)\b/i;

export const CRISIS_REPLY =
  "I'm really glad you told me. I'm a coach, not a crisis counselor, and you deserve real support right now. " +
  "In the US you can call or text 988 to reach the Suicide & Crisis Lifeline, any time, free and confidential. " +
  "If you're in immediate danger, call 911. I'm here when you're ready to keep going.";

export function detectCrisis(text: string): boolean {
  return CRISIS.test(text);
}

const AFFIRM = /^(yes|yeah|yep|yup|sure|ok(ay)?|do it|please|add it|sounds good|confirm|go ahead|let'?s do it)\b/i;
const DECLINE = /^(no|nope|nah|not now|cancel|skip|don'?t)\b/i;

export function isAffirmative(text: string) {
  return AFFIRM.test(text.trim());
}
export function isDecline(text: string) {
  return DECLINE.test(text.trim());
}

function eventCategory(text: string): EventItem["category"] | undefined {
  if (/\b(run|runs|running|jog|5k|10k|race|club)\b/i.test(text)) return "running";
  if (/\b(meetup|panel|network|career|industry|tech|professional)\b/i.test(text)) return "career";
  if (/\b(market|social|fun|party|festival)\b/i.test(text)) return "social";
  return undefined;
}

function defaultCategory(req: PeachesRequest): EventItem["category"] {
  const cat = req.profile.transition?.category;
  return cat === "career" ? "career" : cat === "health" ? "running" : "social";
}

export function buildStats(req: PeachesRequest): Stats {
  const now = Date.now();
  return {
    runsCompleted: req.context.rewards.runsCompleted,
    streakDays: req.context.rewards.streakDays,
    points: req.context.rewards.points,
    badges: req.context.rewards.badges.map((b) => b.label),
    week: req.context.week,
    milestone: req.context.milestone,
    upcoming: req.context.calendar
      .filter((c) => new Date(c.start).getTime() > now)
      .map((c) => ({ title: c.title, start: c.start })),
  };
}

function friendDraft(name: string, req: PeachesRequest) {
  const next = req.context.calendar.find((c) => new Date(c.start).getTime() > Date.now());
  const me = req.profile.name || "me";
  const body = next
    ? `Hey ${name}! I signed up for ${next.title} on ${formatWhen(next.start)}. Want to come run with me? Beginner pace, I promise 🍑 – ${me}`
    : `Hey ${name}! I'm getting into running. Want to be my run buddy this week? Totally beginner pace 🍑 – ${me}`;
  return { to: name, body };
}

const NUM = ["zero", "one", "two", "three", "four", "five"];

function spokenList(events: EventItem[]): string {
  const parts = events.map((e) => `${e.name}, ${formatWhen(e.start)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join("; ")}; and ${parts.at(-1)}` : parts[0] ?? "";
}

function describe(e: EventItem): string {
  const where = e.meetingSpot.split(",")[0];
  return `${e.name}, ${formatWhen(e.start)} at ${where}${e.beginnerFriendly ? ". It's beginner-friendly" : ""}${e.pace ? `, ${e.pace.split(",")[0].toLowerCase()} pace` : ""}`;
}

function nextReminder(req: PeachesRequest, body: (title: string) => string) {
  const next = req.context.calendar.filter((c) => new Date(c.start).getTime() > Date.now()).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (!next) return undefined;
  const sendAt = new Date(Math.max(Date.now() + 15 * 60_000, new Date(next.start).getTime() - 24 * 3_600_000)).toISOString();
  return { next, proposal: { kind: "send_sms_reminder" as const, body: body(next.title), sendAt } };
}

export const CLOSE_APP = /\b(close( the)? app|close it|i'?m done|that'?s all|bye|goodbye|see you|exit|quit)\b/i;

export function runIntent(req: PeachesRequest): PeachesResponse | null {
  const last = req.messages.filter((m) => m.role === "user").at(-1)?.text.trim() ?? "";
  if (!last) return null;
  const t = last.toLowerCase();

  if (detectCrisis(last)) return { reply: CRISIS_REPLY, crisis: true, source: "nlp" };

  if (CLOSE_APP.test(t)) return { reply: "", close: true, source: "nlp" };

  if (/\b(what('?s| is| are)? (my |the )?next( step)?s?|what should i do|what now|next step)\b/.test(t) && !/\b(run|event|meetup|club)\b/.test(t)) {
    const chips = suggestedChips(req);
    return {
      reply: `Here's what I'd do next: ${chips[0].toLowerCase()}. Or ${chips[1].toLowerCase()}. Which one?`,
      chips: [...chips, "Close app"],
      source: "nlp",
    };
  }

  // check_stats
  if (/\b(stats|progress|streak|points|how am i doing|my numbers|badges)\b/.test(t)) {
    const s = buildStats(req);
    const runs = s.runsCompleted === 1 ? "1 run" : `${s.runsCompleted} runs`;
    return {
      reply: `You're in week ${s.week}: ${runs} done, a ${s.streakDays}-day streak and ${s.points} Peach Points. ${
        s.upcoming.length ? `Next up: ${s.upcoming[0].title}, ${formatWhen(s.upcoming[0].start)}.` : "Let's get something on the calendar."
      }`,
      stats: s,
      ...(() => {
        const r = nextReminder(req, (title) => `Peaches here 🍑 ${title} is coming up. You've got this! Reply STOP to opt out.`);
        return r && req.profile.phoneVerified ? { proposal: r.proposal, followUp: `Want me to text you a reminder before ${r.next.title}?` } : {};
      })(),
      source: "nlp",
    };
  }

  // draft_message to a friend
  const ask = last.match(/\b(?:ask|invite|text|message)\s+([A-Z][a-z]+)\b/) ?? last.match(/\b(tina)\b/i);
  if (ask || /\b(run with (me|a friend)|invite a friend|bring a friend)\b/i.test(t)) {
    const raw = ask?.[1] && !/^peaches$/i.test(ask[1]) ? ask[1] : "Tina";
    const name = raw[0].toUpperCase() + raw.slice(1).toLowerCase();
    return {
      reply: `Here's a text for ${name}. Edit it if you like, then send it from your phone. I never message anyone for you.`,
      draft: friendDraft(name, req),
      ...(req.profile.phoneVerified
        ? {
            proposal: {
              kind: "send_sms_reminder" as const,
              body: `Peaches here 🍑 Did ${name} reply? Nudge them about your run! Reply STOP to opt out.`,
              sendAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
            },
            followUp: `Want me to text you tomorrow to check if ${name} replied?`,
          }
        : {}),
      source: "nlp",
    };
  }

  // find_events
  const wantsEvents =
    /^(please |can you |could you |hey peaches,? )*(find|search|look for|show|get|recommend|suggest)\b/.test(t) &&
    /\b(run|runs|running|club|clubs|5k|event|events|meetup|meetups|group|class|panel|something)\b/.test(t);
  const wantsAnother =
    /\b(another|next|more|other|else|different)\b/.test(t) &&
    /\b(run|runs|event|events|meetup|meetups|club|one|option|options|thing|something|recommendation|recommendations|week)\b/.test(t);

  if (wantsEvents || wantsAnother) {
    const category = eventCategory(t) ?? defaultCategory(req);
    const noun = category === "running" ? "run" : category === "career" ? "event" : "plan";

    if (wantsAnother || /\bnext week\b/.test(t)) {
      // Prefer clubs the user hasn't booked yet, so "another" really is a different one.
      const booked = new Set(req.context.calendar.map((c) => c.title));
      const all = findEvents({ category, when: "next_week", beginnerOnly: true, limit: 6 });
      const fresh = all.filter((e) => !booked.has(e.name));
      const events = (fresh.length ? fresh : all).slice(0, 3);
      const pick = events[0];
      if (!pick) return { reply: `I couldn't find another ${noun} next week. Want me to look further out?`, source: "nlp" };
      return {
        reply: `Here's another one: ${describe(pick)}.${events.length > 1 ? ` I also found ${events.slice(1).map((e) => e.name).join(" and ")}.` : ""} Want me to add ${pick.name}?`,
        events,
        proposal: { kind: "add_to_calendar", event: pick, withReminders: true },
        source: "nlp",
      };
    }

    if (/\b(this week|join|tonight|tomorrow|soon)\b/.test(t)) {
      const events = findEvents({ category, when: "this_week", beginnerOnly: true, limit: 3 });
      const pick = events[0];
      if (!pick) return { reply: `Nothing beginner-friendly this week. Want me to check next week?`, source: "nlp" };
      const label =
        category === "running" && /5k/i.test(pick.name) && /social/i.test(pick.name)
          ? "a beginner 5K social run"
          : pick.name;
      return {
        reply: `There's ${label} ${formatWhen(pick.start)}, meeting at ${pick.meetingSpot.split(",")[0]}. Want me to add it?`,
        events: [pick],
        proposal: { kind: "add_to_calendar", event: pick, withReminders: true },
        source: "nlp",
      };
    }

    const events = category === "running" ? nearbyClubs("running") : findEvents({ category, when: "any", limit: 3 });
    const beginners = events.filter((e) => e.beginnerFriendly).length;
    const n = NUM[events.length] ?? String(events.length);
    const b = NUM[beginners] ?? String(beginners);
    return {
      reply:
        events.length === 0
          ? "I couldn't find anything nearby yet."
          : `I found ${n}: ${spokenList(events)}. ${
              beginners === events.length ? "All of them are" : `${b[0].toUpperCase() + b.slice(1)} ${beginners === 1 ? "is" : "are"}`
            } beginner-friendly.`,
      events,
      source: "nlp",
    };
  }

  // set_reminder for an already-booked event
  if (/\bremind me\b/.test(t)) {
    const next = req.context.calendar.find((c) => new Date(c.start).getTime() > Date.now());
    if (next) {
      const sendAt = new Date(new Date(next.start).getTime() - 2 * 3_600_000).toISOString();
      return {
        reply: `Want me to text you two hours before ${next.title} on ${weekdayName(next.start)}?`,
        proposal: { kind: "send_sms_reminder", body: `Peaches here 🍑 ${next.title} starts in 2 hours. You've got this! Reply STOP to opt out.`, sendAt },
        source: "nlp",
      };
    }
  }

  if (/^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/.test(t)) {
    return {
      reply: `Hey ${req.profile.name || "there"}! Ready for your next step?`,
      chips: suggestedChips(req),
      source: "nlp",
    };
  }

  if (/\b(help|what can you do)\b/.test(t)) {
    return {
      reply: "I can find events near you, add them to your calendar, text you reminders, draft an invite to a friend and track your streak.",
      chips: suggestedChips(req),
      source: "nlp",
    };
  }

  return null;
}

export function suggestedChips(req: Pick<PeachesRequest, "profile" | "context">): string[] {
  const cat = req.profile.transition?.category;
  const hasBooking = req.context.calendar.length > 0;
  if (cat === "health") {
    return hasBooking
      ? ["Ask Tina to run with you", "Find another run event", "Check your stats"]
      : ["Find me run clubs in Williamsburg", "Find me a run I can join this week", "Check your stats"];
  }
  if (cat === "career") {
    return hasBooking
      ? ["Find another meetup next week", "Check your stats", "Help me prep for my promotion talk"]
      : ["Find career meetups near me", "Find an event I can join this week", "Check your stats"];
  }
  return ["Find something I can join this week", "Check your stats", "What should I do first?"];
}
