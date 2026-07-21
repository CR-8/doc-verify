import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { validateCsrf } from "@/lib/middleware/csrf";
import { UserUpdateSchema } from "@/lib/validators/user-schemas";
import { userRepository } from "@/lib/db/repositories/user-repository";
import { createAuditLog } from "@/lib/audit/audit-logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    const { userId } = await params;
    const { user } = await authenticateRequest(_request);
    // Users may always read their own profile; other records are admin-only.
    if (user.uid !== userId) {
      await requireRole(user.uid, "admin");
    }
    const userData = await userRepository.getById(userId);
    if (!userData) {
      return handleRouteError(
        Object.assign(new Error("User not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }
    return successResponse(userData);
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { userId } = await params;
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "admin");
    const body = UserUpdateSchema.parse(await request.json());
    await userRepository.update(userId, body as any);
    await createAuditLog({
      action: "USER_UPDATED",
      actorId: user.uid,
      targetId: userId,
      targetType: "user",
      details: body,
      correlationId,
    });
    return successResponse({ updated: true });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
