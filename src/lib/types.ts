export type Category =
  | "career"
  | "health"
  | "relationships"
  | "family"
  | "wedding"
  | "lifestyle"
  | "custom";

export type Transition = {
  id: string;
  from: string;
  to: string;
  category: Category;
  opener: string;
};

export type Timeline = "4 weeks" | "3 months" | "6 months" | string;

export type Profile = {
  name: string;
  age: number | null;
  gender: string;
  location: string;
  transition: Transition | null;
  timeline: Timeline;
  phone: string;
  smsOptIn: boolean;
  phoneVerified: boolean;
};

export type Habit = { id: string; label: string; cadence: string };

export type Plan = {
  welcome: string;
  habits: Habit[];
  socialEvents: string[];
  mentalHygiene: string[];
  mantra: string;
  mentors: string[];
  resources: string[];
  milestone: string;
};

export type EventItem = {
  id: string;
  name: string;
  category: "running" | "career" | "social";
  /** ISO date-time of the next occurrence */
  start: string;
  durationMin: number;
  meetingSpot: string;
  neighborhood: string;
  pace?: string;
  beginnerFriendly: boolean;
  distanceMi: number;
  sourceUrl: string;
  sourceName: string;
  /** True for the seeded fallback list used when live search is unavailable */
  seeded: boolean;
};

export type CalendarItem = {
  eventId: string;
  title: string;
  start: string;
  durationMin: number;
  location: string;
  addedAt: string;
};

export type Reminder = {
  id: string;
  eventId?: string;
  body: string;
  sendAt: string;
  channel: "sms";
};

export type Badge = {
  id: "first-step" | "three-day-streak" | "social-butterfly" | "week-4-finisher";
  label: string;
  earnedAt: string;
};

export type Rewards = {
  points: number;
  streakDays: number;
  lastActiveDay: string | null;
  restDaysUsedThisWeek: number;
  badges: Badge[];
  runsCompleted: number;
};

export type Entitlement = "none" | "trial" | "core" | "pro";

/** A write action Peaches wants to take. Never executed until the user confirms. */
export type Proposal =
  | {
      kind: "add_to_calendar";
      event: EventItem;
      withReminders: boolean;
    }
  | {
      kind: "send_sms_reminder";
      body: string;
      sendAt: string;
    };

export type Draft = { to: string; body: string };

export type Stats = {
  runsCompleted: number;
  streakDays: number;
  points: number;
  badges: string[];
  week: number;
  milestone: string;
  upcoming: { title: string; start: string }[];
};

export type ChatTurn = { role: "user" | "peaches"; text: string };

export type PeachesRequest = {
  messages: ChatTurn[];
  profile: Profile;
  context: {
    calendar: CalendarItem[];
    rewards: Rewards;
    week: number;
    lastEvents: EventItem[];
    milestone: string;
  };
};

export type PeachesResponse = {
  reply: string;
  events?: EventItem[];
  proposal?: Proposal;
  draft?: Draft;
  stats?: Stats;
  chips?: string[];
  crisis?: boolean;
  source: "nlp" | "claude";
};
