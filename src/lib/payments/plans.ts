import type { PlanKey } from "@/types/user";

// Single server-side source of truth for purchasable plans. Amounts are in
// paise (Razorpay's unit): ₹2,000 = 200000 paise. The client never supplies
// an amount — only a plan key that is resolved here.
export interface PaidPlanDef {
  key: PlanKey;
  name: string;
  amountPaise: number;
  periodDays: number;
  uploadLimit: number | null; // null = unlimited
  capacityLabel: string;
}

export const PAID_PLANS: Record<string, PaidPlanDef> = {
  pro: {
    key: "pro",
    name: "PRO",
    amountPaise: 2000 * 100,
    periodDays: 30,
    uploadLimit: 25,
    capacityLabel: "10–25 uploads / month",
  },
  super: {
    key: "super",
    name: "SUPER",
    amountPaise: 6000 * 100,
    periodDays: 90,
    uploadLimit: 100,
    capacityLabel: "25–100 uploads / 3 months",
  },
  ultra: {
    key: "ultra",
    name: "ULTRA",
    amountPaise: 30000 * 100,
    periodDays: 365,
    uploadLimit: null,
    capacityLabel: "Unlimited uploads / year",
  },
};

export const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

export function getRazorpayCredentials(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function razorpayAuthHeader(creds: { keyId: string; keySecret: string }): string {
  return "Basic " + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
}
