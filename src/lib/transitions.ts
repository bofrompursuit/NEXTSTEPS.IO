import type { Category, Transition } from "./types";

export const PRESET_TRANSITIONS: Transition[] = [
  {
    id: "promotion",
    from: "Heavy workload",
    to: "Promotion",
    category: "career",
    opener: "Let's get that raise!",
  },
  {
    id: "running",
    from: "Couch potato",
    to: "New hobby: Running",
    category: "health",
    opener: "Let's get those legs moving!",
  },
  {
    id: "breakup",
    from: "Break-up",
    to: "New boyfriend",
    category: "relationships",
    opener: "Let's write your next chapter.",
  },
  {
    id: "first-kid",
    from: "Couple",
    to: "First kid",
    category: "family",
    opener: "Let's get ready for your little one.",
  },
  {
    id: "wedding",
    from: "LTR",
    to: "Wedding planning",
    category: "wedding",
    opener: "Let's plan something beautiful.",
  },
  {
    id: "fun-fall",
    from: "Sad summer",
    to: "Fun Fall/Winter 2026",
    category: "lifestyle",
    opener: "Let's make this season yours.",
  },
];

const CATEGORY_KEYWORDS: [Category, RegExp][] = [
  ["career", /\b(job|work|career|promot|raise|boss|manager|interview|salary|startup|business)\w*/i],
  ["health", /\b(run|running|gym|fit|fitness|weight|exercise|marathon|5k|yoga|health|walk|swim|bike)\w*/i],
  ["family", /\b(baby|kid|child|pregnan|parent|mom|dad|family)\w*/i],
  ["wedding", /\b(wedding|engag|married|marry|fianc)\w*/i],
  ["relationships", /\b(break.?up|dating|date|boyfriend|girlfriend|partner|divorce|single|friend|lonely|new in town)\w*/i],
  ["lifestyle", /\b(season|fun|travel|hobby|move|moving|city|winter|summer|fall)\w*/i],
];

const CATEGORY_OPENERS: Record<Category, string> = {
  career: "Let's get that raise!",
  health: "Let's get those legs moving!",
  relationships: "Let's write your next chapter.",
  family: "Let's get ready for your little one.",
  wedding: "Let's plan something beautiful.",
  lifestyle: "Let's make this season yours.",
  custom: "Let's make it happen.",
};

export function categorize(text: string): Category {
  for (const [cat, re] of CATEGORY_KEYWORDS) if (re.test(text)) return cat;
  return "custom";
}

/**
 * Turns free text like "from new in town to a real friend group" into a Transition.
 * Splits on "from … to …" or "→" when present.
 */
export function customTransition(text: string): Transition {
  const clean = text.trim().replace(/[.!?]+$/, "");
  const m =
    clean.match(/from\s+(.+?)\s+(?:to|into)\s+(.+)/i) ||
    clean.match(/(.+?)\s*(?:→|->|to)\s+(.+)/i);
  const from = m ? m[1].trim() : "Where I am now";
  const to = m ? m[2].trim() : clean;
  const category = categorize(clean);
  return {
    id: "custom",
    from: capitalize(from),
    to: capitalize(to),
    category,
    opener: CATEGORY_OPENERS[category],
  };
}

export function confirmLine(t: Transition, timeline: string): string {
  const when = /^\d+\s/.test(timeline) ? `in ${timeline}` : `by ${timeline}`;
  return `Got it — from ${t.from.toLowerCase()} to ${t.to.toLowerCase()} ${when}. Sound right?`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
