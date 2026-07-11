import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { ApprovalQuerySchema } from "@/lib/validators/approval-schemas";
import { approvalRepository } from "@/lib/db/repositories/approval-repository";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "viewer");
    const url = new URL(request.url);
    const query = ApprovalQuerySchema.parse(Object.fromEntries(url.searchParams));

    let approvals;
    if (query.documentId) {
      approvals = await approvalRepository.getByDocumentId(query.documentId);
    } else {
      approvals = await approvalRepository.listAll();
    }

    return successResponse({ items: approvals, total: approvals.length });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
