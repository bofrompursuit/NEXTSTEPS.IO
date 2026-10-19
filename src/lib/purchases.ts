"use client";

import { setState } from "./store";
import type { Entitlement } from "./types";

/**
 * Billing seam. The demo build simulates purchases locally.
 * Alpha: replace with RevenueCat Web Billing (@revenuecat/purchases-js) using
 * NEXT_PUBLIC_REVENUECAT_API_KEY. Offerings carry trial eligibility and the
 * trial / core / pro entitlements; Apple Pay is offered by the RevenueCat checkout.
 */
export const PRICES = {
  core: { monthly: 9.99, annual: 89.99 },
  pro: { monthly: 19.99, annual: 149 },
} as const;

export const billingConfigured = Boolean(process.env.NEXT_PUBLIC_REVENUECAT_API_KEY);

export function supportsApplePay(): boolean {
  return typeof window !== "undefined" && "ApplePaySession" in window;
}

export async function purchase(entitlement: Exclude<Entitlement, "none">): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  setState((s) => ({
    entitlement,
    trialStartedAt: entitlement === "trial" ? new Date().toISOString() : s.trialStartedAt,
  }));
}

export async function restorePurchases(): Promise<Entitlement> {
  await new Promise((r) => setTimeout(r, 400));
  return "none";
}
