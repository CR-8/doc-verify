import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { validateCsrf } from "@/lib/middleware/csrf";
import { UserCreateSchema } from "@/lib/validators/user-schemas";
import { userRepository } from "@/lib/db/repositories/user-repository";
import { getAuthProvider } from "@/lib/auth/firebase-provider";
import { createAuditLog } from "@/lib/audit/audit-logger";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "admin");
    const url = new URL(request.url);
    const role = url.searchParams.get("role") || undefined;
    const cursor = url.searchParams.get("cursor") || undefined;
    const limit = Number(url.searchParams.get("limit")) || 20;
    const result = await userRepository.list({ role, cursor, limit });
    return successResponse({
      users: result.items,
      total: result.total,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "admin");
    const body = UserCreateSchema.parse(await request.json());
    const authProvider = getAuthProvider();
    const authUser = await authProvider.createUser(body.email, body.password, body.displayName);
    await userRepository.create({
      id: authUser.uid,
      email: body.email,
      displayName: body.displayName,
      role: body.role,
      designation: body.designation || "",
      department: body.department || "",
      clearance: "unclassified",
      isActive: true,
      emailVerified: false,
      mfaEnabled: false,
      photoURL: "",
      phone: body.phone || "",
      createdAt: null as unknown as any,
      lastLoginAt: null as unknown as any,
      plan: "free",
      planActivatedAt: null,
      planExpiresAt: null,
    });
    await createAuditLog({
      action: "USER_CREATED",
      actorId: user.uid,
      targetId: authUser.uid,
      targetType: "user",
      details: { email: body.email, role: body.role },
      correlationId,
    });
    return successResponse({ uid: authUser.uid, email: body.email, role: body.role }, 201);
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
