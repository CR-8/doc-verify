import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { validateCsrf } from "@/lib/middleware/csrf";
import { AppError, ErrorCodes } from "@/constants/errors";
import {
  PAID_PLANS,
  RAZORPAY_API_BASE,
  getRazorpayCredentials,
  razorpayAuthHeader,
} from "@/lib/payments/plans";

// Creates a Razorpay order for a paid plan. The amount always comes from the
// server-side plan catalog; the client only names the plan.
export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    await checkRateLimit("POST", "/api/payments/create-order", request.headers.get("x-forwarded-for") || "unknown");

    const body = await request.json().catch(() => ({}));
    const planDef = PAID_PLANS[String(body.plan ?? "")];
    if (!planDef) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "Unknown or non-purchasable plan", 400);
    }

    const creds = await getRazorpayCredentials();
    if (!creds) {
      throw new AppError(
        ErrorCodes.INTERNAL_ERROR,
        "Payment gateway is not configured yet. Add your Razorpay keys in Settings → API.",
        503
      );
    }

    const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: "POST",
      headers: {
        Authorization: razorpayAuthHeader(creds),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: planDef.amountPaise,
        currency: "INR",
        receipt: `${planDef.key}-${Date.now()}`.slice(0, 40),
        notes: { plan: planDef.key, uid: user.uid },
      }),
    });

    const order = await res.json().catch(() => null);
    if (!res.ok || !order?.id) {
      throw new AppError(
        ErrorCodes.INTERNAL_ERROR,
        order?.error?.description ?? "Failed to create payment order",
        502
      );
    }

    return successResponse({
      orderId: order.id,
      amount: planDef.amountPaise,
      currency: "INR",
      keyId: creds.keyId,
      plan: planDef.key,
      planName: planDef.name,
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
