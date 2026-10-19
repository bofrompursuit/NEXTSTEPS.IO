import Anthropic from "@anthropic-ai/sdk";
import { findEvents } from "@/lib/events";
import { buildStats, CRISIS_REPLY, detectCrisis, runIntent, suggestedChips } from "@/lib/intents";
import { formatShort } from "@/lib/time";
import type { Draft, EventItem, PeachesRequest, PeachesResponse, Proposal } from "@/lib/types";

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 4;

const SYSTEM = `You are Peaches, the voice coach inside Next Steps.IO, a life-transition coaching app.
Personality: warm, upbeat, brief, never preachy. Your replies are spoken aloud, so write 1–3 short
sentences of plain conversational text: no markdown, lists, emoji or URLs (the app shows event cards
and source links itself).

Your job: help the user take one concrete next step toward their goal this week, ideally something
on their calendar.

Tools:
- find_events searches listings near the user. Only ever mention events returned by this tool; never
  invent events, times, places or prices. Listings flagged "seeded" are demo data.
- recommend_resources and get_progress are read-only.
- propose_calendar_add, propose_sms_reminder and draft_message do NOT act. They put a confirmation card
  in front of the user, who decides. After proposing, ask a short yes/no question such as "Want me to add
  it?" and stop. Never say something has been added, sent or scheduled.
- Only draft messages to friends; the user sends them from their own phone.

Stay in coaching scope: no medical, legal or financial advice. If the user seems in distress, gently share
that they can call or text 988 (US Suicide & Crisis Lifeline) and stop coaching.`;

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "find_events",
    description:
      "Search nearby events by category and time window. Returns up to 3 ranked listings with id, name, start time (America/New_York), meeting spot, pace, beginner-friendliness, distance and source.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["running", "career", "social"] },
        when: { type: "string", enum: ["this_week", "next_week", "any"] },
        beginner_only: { type: "boolean" },
      },
      required: ["category", "when", "beginner_only"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "recommend_resources",
    description: "Return the user's plan resources and mentor roles for their goal.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_progress",
    description: "Return the user's stats: runs completed, streak, points, badges, program week, milestone and upcoming calendar items.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "propose_calendar_add",
    description:
      "Show the user a confirmation card to add an event (by id from find_events) to their calendar, with text reminders the day before and 2 hours before. Does not add anything until the user confirms.",
    input_schema: {
      type: "object",
      properties: { event_id: { type: "string" } },
      required: ["event_id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "propose_sms_reminder",
    description:
      "Show the user a confirmation card to schedule a text reminder to their own verified number. send_at is ISO 8601. Body must be under 160 characters.",
    input_schema: {
      type: "object",
      properties: { body: { type: "string" }, send_at: { type: "string" } },
      required: ["body", "send_at"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "draft_message",
    description: "Draft a friendly text to a friend for the user to review and send from their own phone.",
    input_schema: {
      type: "object",
      properties: { to: { type: "string" }, body: { type: "string" } },
      required: ["to", "body"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function describeEvent(e: EventItem) {
  return {
    id: e.id,
    name: e.name,
    start: formatShort(e.start),
    meeting_spot: e.meetingSpot,
    pace: e.pace,
    beginner_friendly: e.beginnerFriendly,
    distance_mi: e.distanceMi,
    source: e.sourceName,
    seeded: e.seeded,
  };
}

async function askClaude(req: PeachesRequest): Promise<PeachesResponse> {
  const client = new Anthropic();
  const p = req.profile;
  const profileNote = [
    `User: ${p.name || "unknown"}, ${p.age ?? "?"}, ${p.location || "New York"}.`,
    p.transition ? `Transition: ${p.transition.from} → ${p.transition.to} (${p.transition.category}).` : "",
    `Timeline: ${p.timeline}. Program week ${req.context.week} of 4. Week-4 milestone: ${req.context.milestone}.`,
    `Today is ${formatShort(new Date().toISOString())} New York time.`,
  ].join(" ");

  // Conversation must start with a user turn; drop any leading Peaches greeting.
  const turns = req.messages.slice(-12);
  while (turns.length && turns[0].role !== "user") turns.shift();
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));
  if (!messages.length) messages.push({ role: "user", content: "Hi" });

  const seen = new Map<string, EventItem>(req.context.lastEvents.map((e) => [e.id, e]));
  const out: Omit<PeachesResponse, "reply" | "source"> = {};
  let events: EventItem[] | undefined;
  let proposal: Proposal | undefined;
  let draft: Draft | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: profileNote },
      ],
      tools,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { reply: "Let's keep things focused on your goal. What's one step you'd like to take this week?", source: "claude" };
    }

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const reply = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join(" ")
        .trim();
      return { reply: reply || "I'm here. What would you like to do next?", events, proposal, draft, ...out, source: "claude" };
    }

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) => {
      const input = (tu.input ?? {}) as Record<string, unknown>;
      const ok = (content: unknown): Anthropic.Beta.BetaToolResultBlockParam => ({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(content),
      });
      const err = (msg: string): Anthropic.Beta.BetaToolResultBlockParam => ({
        type: "tool_result",
        tool_use_id: tu.id,
        content: msg,
        is_error: true,
      });
      switch (tu.name) {
        case "find_events": {
          const found = findEvents({
            category: input.category as EventItem["category"],
            when: input.when as "this_week" | "next_week" | "any",
            beginnerOnly: Boolean(input.beginner_only),
          });
          found.forEach((e) => seen.set(e.id, e));
          events = found;
          return ok(found.map(describeEvent));
        }
        case "recommend_resources":
          return ok({ note: "Resources and mentor roles are shown in the user's plan cards; summarize briefly." });
        case "get_progress":
          out.stats = buildStats(req);
          return ok(out.stats);
        case "propose_calendar_add": {
          const e = seen.get(String(input.event_id));
          if (!e) return err("Unknown event_id. Call find_events first and use an id it returned.");
          proposal = { kind: "add_to_calendar", event: e, withReminders: true };
          events = [e];
          return ok({ status: "confirmation_card_shown", note: "Ask the user to confirm. Nothing is added yet." });
        }
        case "propose_sms_reminder": {
          const sendAt = new Date(String(input.send_at));
          if (Number.isNaN(sendAt.getTime()) || sendAt.getTime() < Date.now())
            return err("send_at must be a future ISO 8601 time.");
          if (!req.profile.phoneVerified) return err("User has no verified phone number for texts.");
          proposal = { kind: "send_sms_reminder", body: String(input.body).slice(0, 300), sendAt: sendAt.toISOString() };
          return ok({ status: "confirmation_card_shown", note: "Ask the user to confirm. Nothing is scheduled yet." });
        }
        case "draft_message":
          draft = { to: String(input.to), body: String(input.body) };
          return ok({ status: "draft_shown", note: "The user will review and send it themselves." });
        default:
          return err(`Unknown tool ${tu.name}`);
      }
    });
    messages.push({ role: "user", content: results });
  }

  return {
    reply: proposal ? "Want me to go ahead?" : "Here's what I found.",
    events,
    proposal,
    draft,
    ...out,
    source: "claude",
  };
}

export async function POST(request: Request) {
  let req: PeachesRequest;
  try {
    req = (await request.json()) as PeachesRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const last = req.messages?.filter((m) => m.role === "user").at(-1)?.text ?? "";

  if (detectCrisis(last)) {
    return Response.json({ reply: CRISIS_REPLY, crisis: true, source: "nlp" } satisfies PeachesResponse);
  }

  // Free tier first: simple intents never hit the LLM.
  const fast = runIntent(req);
  if (fast) return Response.json(fast);

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({
      reply: "I can help you find events, add them to your calendar, set reminders or check your stats. Try one of these.",
      chips: suggestedChips(req),
      source: "nlp",
    } satisfies PeachesResponse);
  }

  try {
    return Response.json(await askClaude(req));
  } catch (e) {
    console.error("peaches: claude error", e);
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({ reply: "I'm a little swamped right now. Try one of these while I catch my breath.", chips: suggestedChips(req), source: "nlp" } satisfies PeachesResponse);
    }
    return Response.json({
      reply: "Sorry, I lost my train of thought. Try one of these.",
      chips: suggestedChips(req),
      source: "nlp",
    } satisfies PeachesResponse);
  }
}
