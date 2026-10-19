import type { EventItem } from "./types";
import { DAY_MS, nextWeekly } from "./time";

/**
 * Seeded fallback listings for the Williamsburg demo. They are clearly flagged
 * `seeded: true` and render with a "Demo listing" badge so Peaches never presents
 * them as verified real-world events. Each links to the public page for the venue
 * or organizer so users can confirm details. Swap for live sources in Alpha.
 */
type Seed = Omit<EventItem, "id" | "start" | "seeded"> & {
  key: string;
  weekday: number;
  hour: number;
  minute: number;
};

const SEEDS: Seed[] = [
  {
    key: "mccarren-social-5k",
    name: "McCarren Park Beginner 5K Social Run",
    category: "running",
    weekday: 4,
    hour: 19,
    minute: 0,
    durationMin: 60,
    meetingSpot: "McCarren Park track entrance, Bedford Ave & N 12th St",
    neighborhood: "Williamsburg",
    pace: "Conversational, 11–13 min/mi, no-drop",
    beginnerFriendly: true,
    distanceMi: 0.4,
    sourceUrl: "https://www.nycgovparks.org/parks/mccarren-park",
    sourceName: "NYC Parks · McCarren Park",
  },
  {
    key: "domino-sunrise",
    name: "Domino Park Sunrise Striders",
    category: "running",
    weekday: 2,
    hour: 6,
    minute: 30,
    durationMin: 50,
    meetingSpot: "Domino Park, River St & Grand St",
    neighborhood: "Williamsburg",
    pace: "Intermediate, 8:30–9:30 min/mi",
    beginnerFriendly: false,
    distanceMi: 0.9,
    sourceUrl: "https://www.dominopark.com/",
    sourceName: "Domino Park",
  },
  {
    key: "bushwick-inlet-walk-run",
    name: "Bushwick Inlet Walk-Run Club",
    category: "running",
    weekday: 6,
    hour: 9,
    minute: 0,
    durationMin: 45,
    meetingSpot: "Bushwick Inlet Park, Kent Ave & N 9th St",
    neighborhood: "Williamsburg",
    pace: "Walk-run intervals, all levels",
    beginnerFriendly: true,
    distanceMi: 1.1,
    sourceUrl: "https://www.nycgovparks.org/parks/bushwick-inlet-park",
    sourceName: "NYC Parks · Bushwick Inlet Park",
  },
  {
    key: "bedford-store-social",
    name: "Bedford Ave Running-Store Social Run",
    category: "running",
    weekday: 3,
    hour: 19,
    minute: 0,
    durationMin: 60,
    meetingSpot: "Bedford Ave & N 7th St (L train)",
    neighborhood: "Williamsburg",
    pace: "Two pace groups, 10 & 12 min/mi",
    beginnerFriendly: true,
    distanceMi: 0.5,
    sourceUrl: "https://www.nyrr.org/run/race-calendar",
    sourceName: "NYRR community calendar",
  },
  {
    key: "prospect-sat-5k",
    name: "Saturday Park 5K, Prospect Park",
    category: "running",
    weekday: 6,
    hour: 8,
    minute: 0,
    durationMin: 60,
    meetingSpot: "Grand Army Plaza entrance",
    neighborhood: "Prospect Park",
    pace: "Timed 5K, walkers welcome",
    beginnerFriendly: true,
    distanceMi: 3.6,
    sourceUrl: "https://www.prospectpark.org/",
    sourceName: "Prospect Park Alliance",
  },
  {
    key: "bk-product-meetup",
    name: "Brooklyn Product & Tech Meetup",
    category: "career",
    weekday: 2,
    hour: 18,
    minute: 30,
    durationMin: 120,
    meetingSpot: "Williamsburg co-working space, N 3rd St",
    neighborhood: "Williamsburg",
    beginnerFriendly: true,
    distanceMi: 0.5,
    sourceUrl: "https://www.meetup.com/find/?location=us--ny--Brooklyn",
    sourceName: "Meetup · Brooklyn",
  },
  {
    key: "women-leadership-panel",
    name: "Leadership & Promotion Panel",
    category: "career",
    weekday: 4,
    hour: 18,
    minute: 0,
    durationMin: 90,
    meetingSpot: "Brooklyn Public Library, Williamsburgh branch",
    neighborhood: "Williamsburg",
    beginnerFriendly: true,
    distanceMi: 0.7,
    sourceUrl: "https://www.bklynlibrary.org/locations/williamsburgh",
    sourceName: "Brooklyn Public Library",
  },
  {
    key: "makers-market",
    name: "Weekend Makers Market",
    category: "social",
    weekday: 0,
    hour: 11,
    minute: 0,
    durationMin: 180,
    meetingSpot: "East River waterfront, Kent Ave",
    neighborhood: "Williamsburg",
    beginnerFriendly: true,
    distanceMi: 0.8,
    sourceUrl: "https://www.nycgovparks.org/parks/east-river-state-park",
    sourceName: "NYC Parks",
  },
];

export type EventQuery = {
  category?: EventItem["category"];
  when?: "this_week" | "next_week" | "any";
  beginnerOnly?: boolean;
  limit?: number;
};

export function seededEvents(now = new Date()): EventItem[] {
  return SEEDS.flatMap((s) =>
    [0, 1].map((weeksAhead) => {
      const { key, weekday, hour, minute, ...rest } = s;
      const start = nextWeekly(weekday, hour, minute, now, weeksAhead).toISOString();
      return { ...rest, id: `${key}-${start.slice(0, 10)}`, start, seeded: true };
    }),
  );
}

/** find_events tool. Ranks by beginner-fit, then distance, then soonest. */
export function findEvents(q: EventQuery, now = new Date()): EventItem[] {
  const t = now.getTime();
  let list = seededEvents(now);
  if (q.category) list = list.filter((e) => e.category === q.category);
  if (q.beginnerOnly) list = list.filter((e) => e.beginnerFriendly);
  if (q.when === "this_week") {
    list = list.filter((e) => new Date(e.start).getTime() - t < 7 * DAY_MS);
  } else if (q.when === "next_week") {
    list = list.filter((e) => {
      const dt = new Date(e.start).getTime() - t;
      return dt >= 7 * DAY_MS && dt < 14 * DAY_MS;
    });
  } else {
    // "any": one listing per club, its next occurrence
    const seen = new Set<string>();
    list = list
      .sort((a, b) => a.start.localeCompare(b.start))
      .filter((e) => (seen.has(e.name) ? false : (seen.add(e.name), true)));
  }
  return list
    .sort(
      (a, b) =>
        Number(b.beginnerFriendly) - Number(a.beginnerFriendly) ||
        a.distanceMi - b.distanceMi ||
        a.start.localeCompare(b.start),
    )
    .slice(0, q.limit ?? 3);
}

/** For the "run clubs near me" list: nearest clubs, regardless of level. */
export function nearbyClubs(category: EventItem["category"], now = new Date(), limit = 3) {
  return findEvents({ category, when: "any", limit: 20 }, now)
    .filter((e) => e.neighborhood === "Williamsburg")
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .slice(0, limit);
}
