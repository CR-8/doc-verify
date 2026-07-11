import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { authenticateRequest } from "@/lib/middleware/auth-guard";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    await checkRateLimit("GET", "/api/auth/*", request.headers.get("x-forwarded-for") || "unknown");
    const { user } = await authenticateRequest(request);
    return successResponse({ uid: user.uid, email: user.email, displayName: user.displayName });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
