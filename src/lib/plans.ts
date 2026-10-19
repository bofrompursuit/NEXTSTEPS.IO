import type { Category, Plan, Profile } from "./types";

const h = (id: string, label: string, cadence: string) => ({ id, label, cadence });

/** Scenario A: Heavy workload → Promotion */
const CAREER: Plan = {
  welcome: "Let's get that raise!",
  habits: [
    h("wins-log", "20-min weekly “wins log”", "Every Friday"),
    h("focus-hours", "Block 2 focus hours", "Daily"),
    h("impact-project", "Share 1 visible-impact project with your manager", "By week 2"),
  ],
  socialEvents: [
    "1 industry meetup or panel per week",
    "1 coffee chat with a cross-team peer",
    "An internal lunch-and-learn",
  ],
  mentalHygiene: ["Hard stop at a set time, 3 nights a week", "5-min evening wind-down"],
  mantra: "Visible, valuable, valued.",
  mentors: [
    "A senior colleague one level up",
    "A former manager for a reference check",
    "A peer who was recently promoted",
  ],
  resources: [
    "Promotion-case template",
    "Salary benchmarks for your role",
    "Negotiation book and podcast picks",
  ],
  milestone: "Promotion or raise conversation booked with your manager",
};

/** Scenario B: Couch potato → Running */
const RUNNING: Plan = {
  welcome: "Let's get those legs moving!",
  habits: [
    h("walk-run", "Walk-run (Couch-to-5K style)", "3x a week"),
    h("stretch", "10-min stretch after each run", "After runs"),
    h("gear-out", "Lay out running gear the night before", "Night before"),
  ],
  socialEvents: [
    "Beginner-friendly run club this week",
    "Weekend group run or park 5K",
    "A running-store social run",
  ],
  mentalHygiene: ["Celebrate every finished run", "Rest-day reminders to avoid burnout"],
  mantra: "Slow miles still count.",
  mentors: [
    "An experienced club runner as a buddy",
    "A local running coach",
    "A friend to run with (e.g. Tina)",
  ],
  resources: [
    "Beginner 5K plan",
    "Shoe-fitting guide",
    "Running podcast picks",
    "Strava or Apple Health stats",
  ],
  milestone: "Finish a continuous 20-minute run or your first group 5K",
};

/** Same four-part template, category-specific defaults for the remaining presets. */
const GENERIC: Record<Exclude<Category, "career" | "health">, Plan> = {
  relationships: {
    welcome: "Let's write your next chapter.",
    habits: [
      h("say-yes", "Say yes to one new social plan", "Weekly"),
      h("journal", "5-min evening journal", "Daily"),
      h("move", "Move your body 20 minutes", "3x a week"),
    ],
    socialEvents: ["A hobby class or workshop", "A group activity meetup", "Dinner with an old friend"],
    mentalHygiene: ["No-scroll first hour of the day", "One kind thing for yourself daily"],
    mantra: "I'm the main character.",
    mentors: ["A friend who's great at fresh starts", "A trusted older sibling or cousin"],
    resources: ["A book on attachment styles", "A confidence podcast pick"],
    milestone: "Three new social plans completed",
  },
  family: {
    welcome: "Let's get ready for your little one.",
    habits: [
      h("prep-list", "Tick one item off the baby-prep list", "Weekly"),
      h("couple-time", "Phone-free couple time", "2x a week"),
      h("sleep", "Protect a consistent bedtime", "Daily"),
    ],
    socialEvents: ["A local new-parents meetup", "A baby-care or CPR class", "A parent-friend coffee"],
    mentalHygiene: ["10-min daily wind-down together", "Ask for help once a week"],
    mantra: "Ready enough is ready.",
    mentors: ["A friend with a toddler", "Your pediatrician shortlist"],
    resources: ["Hospital bag checklist", "A first-year parenting podcast"],
    milestone: "Nursery set, class taken, support plan written",
  },
  wedding: {
    welcome: "Let's plan something beautiful.",
    habits: [
      h("decision", "Make one wedding decision", "Weekly"),
      h("budget", "10-min budget check-in", "Weekly"),
      h("date-night", "A no-wedding-talk date night", "Weekly"),
    ],
    socialEvents: ["A bridal or vendor expo", "A venue tour", "A tasting"],
    mentalHygiene: ["Wedding-free evenings twice a week", "Gratitude note to your partner"],
    mantra: "It's about us.",
    mentors: ["A recently married friend", "A planner for a 30-min consult"],
    resources: ["Budget template", "Vendor checklist"],
    milestone: "Venue and date locked",
  },
  lifestyle: {
    welcome: "Let's make this season yours.",
    habits: [
      h("new-thing", "Try one new thing", "Weekly"),
      h("outside", "20 minutes outside", "Daily"),
      h("plan-ahead", "Plan next weekend on Wednesday", "Weekly"),
    ],
    socialEvents: ["A seasonal market or festival", "A group class", "A friend's game night"],
    mentalHygiene: ["Morning light walk", "Weekly “best moment” recap"],
    mantra: "Make it a good one.",
    mentors: ["The friend who always has plans", "A local events newsletter"],
    resources: ["Seasonal bucket-list template", "Neighborhood events calendar"],
    milestone: "Four new experiences logged",
  },
  custom: {
    welcome: "Let's make it happen.",
    habits: [
      h("tiny-step", "One tiny step toward your goal", "Daily"),
      h("review", "Weekly progress review", "Sundays"),
      h("share", "Tell one person about your goal", "This week"),
    ],
    socialEvents: ["A meetup related to your goal", "A workshop or class", "A coffee with someone ahead of you"],
    mentalHygiene: ["5-min daily reflection", "Celebrate small wins"],
    mantra: "One step at a time.",
    mentors: ["Someone who's already made this change", "A friend to keep you accountable"],
    resources: ["A starter book on the topic", "A podcast for your goal"],
    milestone: "A visible first milestone reached",
  },
};

export function planFor(profile: Profile): Plan {
  const cat = profile.transition?.category ?? "custom";
  const base = cat === "career" ? CAREER : cat === "health" ? RUNNING : GENERIC[cat];
  return { ...base, welcome: profile.transition?.opener ?? base.welcome };
}
