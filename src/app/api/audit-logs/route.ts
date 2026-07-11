import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { AuditLogQuerySchema } from "@/lib/validators/audit-log-schemas";
import { auditLogRepository } from "@/lib/db/repositories/audit-log-repository";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "auditor");
    await checkRateLimit("GET", "/api/audit-logs", request.headers.get("x-forwarded-for") || "unknown");

    const url = new URL(request.url);
    const query = AuditLogQuerySchema.parse(Object.fromEntries(url.searchParams));

    const result = await auditLogRepository.list({
      targetId: query.targetId,
      action: query.action,
      actorId: query.actorId,
      partition: query.partition,
      severity: query.severity,
      cursor: query.cursor,
      limit: query.limit,
    });

    return successResponse(result);
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
