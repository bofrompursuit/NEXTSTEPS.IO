"use client";

import { useSyncExternalStore } from "react";
import { INITIAL_REWARDS } from "./rewards";
import type { CalendarItem, ChatTurn, Entitlement, EventItem, Profile, Reminder, Rewards } from "./types";

/** Demo build keeps state on-device. Alpha moves this to Postgres (Supabase). */
export type AppState = {
  profile: Profile;
  onboarded: boolean;
  entitlement: Entitlement;
  trialStartedAt: string | null;
  planStartedAt: string | null;
  calendar: CalendarItem[];
  reminders: Reminder[];
  rewards: Rewards;
  habitChecks: Record<string, string[]>; // habitId -> ISO dates
  chat: ChatTurn[];
  lastEvents: EventItem[];
  lastVisit: string | null;
  voiceEnabled: boolean;
};

export const EMPTY_PROFILE: Profile = {
  name: "",
  age: null,
  gender: "",
  location: "",
  transition: null,
  timeline: "4 weeks",
  phone: "",
  smsOptIn: false,
  phoneVerified: false,
};

const INITIAL: AppState = {
  profile: EMPTY_PROFILE,
  onboarded: false,
  entitlement: "none",
  trialStartedAt: null,
  planStartedAt: null,
  calendar: [],
  reminders: [],
  rewards: INITIAL_REWARDS,
  habitChecks: {},
  chat: [],
  lastEvents: [],
  lastVisit: null,
  voiceEnabled: true,
};

const KEY = "nextsteps:v1";
const listeners = new Set<() => void>();
let state: AppState = INITIAL;
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...INITIAL, ...JSON.parse(raw) };
  } catch {}
}

export function getState(): AppState {
  load();
  return state;
}

export function setState(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  load();
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
}

export function resetState() {
  state = INITIAL;
  try {
    localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, () => INITIAL);
}

/** True after the client has read persisted state (avoids redirect flicker). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function programWeek(s: AppState): number {
  if (!s.planStartedAt) return 1;
  const days = Math.floor((Date.now() - Date.parse(s.planStartedAt)) / 86_400_000);
  return Math.min(4, Math.floor(days / 7) + 1);
}
