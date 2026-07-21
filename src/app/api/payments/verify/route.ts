import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { validateCsrf } from "@/lib/middleware/csrf";
import { AppError, ErrorCodes } from "@/constants/errors";
import { getAdminDb } from "@/lib/db/firebase";
import { createAuditLog } from "@/lib/audit/audit-logger";
import {
  PAID_PLANS,
  RAZORPAY_API_BASE,
  getRazorpayCredentials,
  razorpayAuthHeader,
} from "@/lib/payments/plans";

// Verifies a completed Razorpay checkout and activates the purchased plan.
// Trust chain: HMAC signature proves the payment belongs to the order; the
// order is fetched from Razorpay to learn which plan/uid it was created for;
// the payment is fetched to confirm it was actually captured for the full
// amount. Only then is the user's plan updated.
export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    await checkRateLimit("POST", "/api/payments/verify", request.headers.get("x-forwarded-for") || "unknown");

    const body = await request.json().catch(() => ({}));
    const orderId = String(body.razorpay_order_id ?? "");
    const paymentId = String(body.razorpay_payment_id ?? "");
    const signature = String(body.razorpay_signature ?? "");
    if (!orderId || !paymentId || !signature) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Missing payment verification fields", 400);
    }

    const creds = await getRazorpayCredentials();
    if (!creds) {
      throw new AppError(ErrorCodes.INTERNAL_ERROR, "Payment gateway is not configured", 503);
    }

    const expected = createHmac("sha256", creds.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(signature, "utf8");
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new AppError(ErrorCodes.FORBIDDEN, "Payment signature verification failed", 400);
    }

    const authHeader = { Authorization: razorpayAuthHeader(creds) };
    const [orderRes, paymentRes] = await Promise.all([
      fetch(`${RAZORPAY_API_BASE}/orders/${orderId}`, { headers: authHeader }),
      fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}`, { headers: authHeader }),
    ]);
    const order = await orderRes.json().catch(() => null);
    const payment = await paymentRes.json().catch(() => null);
    if (!orderRes.ok || !order?.id || !paymentRes.ok || !payment?.id) {
      throw new AppError(ErrorCodes.INTERNAL_ERROR, "Could not confirm payment with the gateway", 502);
    }

    const planDef = PAID_PLANS[String(order.notes?.plan ?? "")];
    if (!planDef) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Order is not linked to a known plan", 400);
    }
    if (order.notes?.uid !== user.uid) {
      throw new AppError(ErrorCodes.FORBIDDEN, "This payment belongs to a different account", 403);
    }
    if (payment.order_id !== orderId || payment.status !== "captured" || payment.amount !== planDef.amountPaise) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Payment was not captured for the expected amount", 400);
    }

    const adminDb = getAdminDb();
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + planDef.periodDays * 24 * 60 * 60 * 1000);

    await adminDb.collection("users").doc(user.uid).set(
      { plan: planDef.key, planActivatedAt: now, planExpiresAt: expiresAt },
      { merge: true }
    );

    await adminDb.collection("payments").doc(paymentId).set({
      userId: user.uid,
      plan: planDef.key,
      orderId,
      paymentId,
      amountPaise: planDef.amountPaise,
      currency: "INR",
      status: "captured",
      activatedAt: now,
      expiresAt,
    });

    await createAuditLog({
      action: "PLAN_ACTIVATED",
      actorId: user.uid,
      targetId: user.uid,
      targetType: "user",
      details: { plan: planDef.key, orderId, paymentId, amountPaise: planDef.amountPaise },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      correlationId,
    });

    return successResponse({
      plan: planDef.key,
      planName: planDef.name,
      expiresAt: expiresAt.toDate().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
