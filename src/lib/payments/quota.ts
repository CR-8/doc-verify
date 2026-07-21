import { getAdminDb } from "@/lib/db/firebase";
import { AppError, ErrorCodes } from "@/constants/errors";
import { PAID_PLANS } from "@/lib/payments/plans";

export interface QuotaStatus {
  plan: string;
  used: number;
  limit: number | null; // null = unlimited
  allowed: boolean;
}

const FREE_LIFETIME_LIMIT = 10;

// Computes how many uploads the user has consumed in the current plan period
// and whether another upload is allowed.
// - free: lifetime cap of 10 uploads
// - pro/super/ultra: cap counted from planActivatedAt; expired plans fall
//   back to free
// - business: no automatic cap (custom arrangements)
export async function getUploadQuota(userId: string): Promise<QuotaStatus> {
  const adminDb = getAdminDb();
  const userSnap = await adminDb.collection("users").doc(userId).get();
  const userData = userSnap.data() ?? {};

  let plan: string = userData.plan || "free";
  const expiresAt = userData.planExpiresAt;
  const activatedAt = userData.planActivatedAt;

  const expired =
    expiresAt && typeof expiresAt.toMillis === "function"
      ? expiresAt.toMillis() < Date.now()
      : false;
  if (expired) plan = "free";

  if (plan === "business") {
    return { plan, used: 0, limit: null, allowed: true };
  }

  const planDef = PAID_PLANS[plan];
  const limit = plan === "free" ? FREE_LIFETIME_LIMIT : planDef ? planDef.uploadLimit : FREE_LIFETIME_LIMIT;
  if (limit === null) {
    return { plan, used: 0, limit: null, allowed: true };
  }

  // Single-field query (no composite index needed); period filtering in memory.
  const snapshot = await adminDb
    .collection("documents")
    .where("uploadedBy", "==", userId)
    .select("uploadedAt")
    .get();

  const periodStartMs =
    plan !== "free" && activatedAt && typeof activatedAt.toMillis === "function"
      ? activatedAt.toMillis()
      : null;

  const used = snapshot.docs.filter((d) => {
    if (periodStartMs === null) return true;
    const uploadedAt = d.get("uploadedAt");
    const ms = uploadedAt && typeof uploadedAt.toMillis === "function" ? uploadedAt.toMillis() : 0;
    return ms >= periodStartMs;
  }).length;

  return { plan, used, limit, allowed: used < limit };
}

export async function enforceUploadQuota(userId: string): Promise<QuotaStatus> {
  const quota = await getUploadQuota(userId);
  if (!quota.allowed) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      `Upload limit reached: your ${quota.plan.toUpperCase()} plan allows ${quota.limit} uploads` +
        (quota.plan === "free" ? "" : " in the current period") +
        `. Upgrade your plan to continue uploading.`,
      403
    );
  }
  return quota;
}
