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

// Credentials can be managed from the dashboard Settings → API tab (stored in
// the Firestore `settings` collection, admin-only) or via environment
// variables. The dashboard values take priority so keys can be rotated
// without a redeploy.
export async function getRazorpayCredentials(): Promise<{ keyId: string; keySecret: string } | null> {
  let storedKeyId = "";
  let storedKeySecret = "";
  try {
    const { getAdminDb } = await import("@/lib/db/firebase");
    const adminDb = getAdminDb();
    const [idDoc, secretDoc] = await Promise.all([
      adminDb.collection("settings").doc("razorpayKeyId").get(),
      adminDb.collection("settings").doc("razorpayKeySecret").get(),
    ]);
    storedKeyId = (idDoc.data()?.value as string) || "";
    storedKeySecret = (secretDoc.data()?.value as string) || "";
  } catch {
    // Firestore unavailable — fall back to env vars below.
  }

  const keyId = storedKeyId || process.env.RAZORPAY_KEY_ID || "";
  const keySecret = storedKeySecret || process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function razorpayAuthHeader(creds: { keyId: string; keySecret: string }): string {
  return "Basic " + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");
}
