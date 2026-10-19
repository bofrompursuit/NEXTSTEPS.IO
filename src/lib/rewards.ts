import type { Badge, Rewards } from "./types";

export const INITIAL_REWARDS: Rewards = {
  points: 0,
  streakDays: 0,
  lastActiveDay: null,
  restDaysUsedThisWeek: 0,
  badges: [],
  runsCompleted: 0,
};

const BADGE_LABELS: Record<Badge["id"], string> = {
  "first-step": "First Step",
  "three-day-streak": "3-Day Streak",
  "social-butterfly": "Social Butterfly",
  "week-4-finisher": "Week 4 Finisher",
};

export const POINTS = {
  calendarAdd: 50,
  habitCheck: 10,
  friendInvite: 30,
  eventAttended: 100,
} as const;

const LINES = [
  "That's how it begins. Thursday-you is going to be proud.",
  "Look at you go!",
  "Small steps, big chapter.",
  "That's momentum. Keep it rolling.",
  "Future-you just high-fived you.",
];

export type RewardResult = {
  rewards: Rewards;
  pointsAdded: number;
  newBadge?: Badge;
  line: string;
};

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** award_reward tool: grants points, extends the streak (one free rest day a week) and badges. */
export function award(
  r: Rewards,
  reason: keyof typeof POINTS,
  now = new Date(),
  line?: string,
): RewardResult {
  const today = dayKey(now);
  let { streakDays, restDaysUsedThisWeek } = r;
  if (r.lastActiveDay !== today) {
    const gap = r.lastActiveDay
      ? Math.round((Date.parse(today) - Date.parse(r.lastActiveDay)) / 86_400_000)
      : Infinity;
    if (gap === 1) streakDays += 1;
    else if (gap === 2 && restDaysUsedThisWeek < 1) {
      streakDays += 1;
      restDaysUsedThisWeek += 1;
    } else streakDays = 1;
  }
  if (now.getDay() === 1 && r.lastActiveDay !== today) restDaysUsedThisWeek = 0;

  const pointsAdded = POINTS[reason];
  const badges = [...r.badges];
  let newBadge: Badge | undefined;
  const grant = (id: Badge["id"]) => {
    if (badges.some((b) => b.id === id)) return;
    newBadge = { id, label: BADGE_LABELS[id], earnedAt: now.toISOString() };
    badges.push(newBadge);
  };
  if (reason === "calendarAdd") grant("first-step");
  if (reason === "friendInvite") grant("social-butterfly");
  if (streakDays >= 3) grant("three-day-streak");

  return {
    rewards: {
      ...r,
      points: r.points + pointsAdded,
      streakDays,
      restDaysUsedThisWeek,
      lastActiveDay: today,
      badges,
      runsCompleted: r.runsCompleted + (reason === "eventAttended" ? 1 : 0),
    },
    pointsAdded,
    newBadge,
    line: line ?? LINES[Math.floor(Math.random() * LINES.length)],
  };
}
