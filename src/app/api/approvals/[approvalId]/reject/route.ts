import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { validateCsrf } from "@/lib/middleware/csrf";
import { approvalRepository } from "@/lib/db/repositories/approval-repository";
import { documentRepository } from "@/lib/db/repositories/document-repository";
import { createAuditLog } from "@/lib/audit/audit-logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "approver");
    await checkRateLimit("POST", "/api/approvals/*/reject", request.headers.get("x-forwarded-for") || "unknown");

    const { approvalId } = await params;

    const approval = await approvalRepository.getById(approvalId);
    if (!approval) {
      return handleRouteError(
        Object.assign(new Error("Approval not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }

    if (approval.status !== "pending") {
      return handleRouteError(
        Object.assign(new Error("Approval is not in a rejectable state"), { statusCode: 409 }),
        correlationId
      );
    }

    await approvalRepository.updateStatus(approval.id, "rejected");
    await documentRepository.updateStatus(approval.documentId, "rejected");

    await createAuditLog({
      action: "APPROVAL_REJECTED",
      actorId: user.uid,
      targetId: approvalId,
      targetType: "approval",
      details: { documentId: approval.documentId },
      correlationId,
    });

    return successResponse({ rejected: true });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
