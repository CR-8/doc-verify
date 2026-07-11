import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { notificationRepository } from "@/lib/db/repositories/notification-repository";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const { user } = await authenticateRequest(request);
    const url = new URL(request.url);
    const readParam = url.searchParams.get("read");
    const read = readParam !== null ? readParam === "true" : undefined;
    const cursor = url.searchParams.get("cursor") || undefined;
    const limit = Number(url.searchParams.get("limit")) || 20;
    const result = await notificationRepository.listByUser(user.uid, { read, cursor, limit });
    return successResponse(result);
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}

export async function PATCH(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const { user } = await authenticateRequest(request);
    const body = await request.json();
    if (body.markAllAsRead) {
      await notificationRepository.markAllAsRead(user.uid);
    } else if (body.notificationId) {
      await notificationRepository.markAsRead(body.notificationId);
    }
    return successResponse({ updated: true });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
