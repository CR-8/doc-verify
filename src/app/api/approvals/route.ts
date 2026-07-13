import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { ApprovalQuerySchema } from "@/lib/validators/approval-schemas";
import { approvalRepository } from "@/lib/db/repositories/approval-repository";
import { documentRepository } from "@/lib/db/repositories/document-repository";
import { resolveUserNames, toIso } from "@/lib/db/enrich";

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

    // Enrich with the approver's display name and the document title so the
    // approvals table renders real values instead of "-". Document titles are
    // fetched once per unique document to avoid an N+1.
    const names = await resolveUserNames(approvals.map((a) => a.userId));
    const uniqueDocIds = Array.from(new Set(approvals.map((a) => a.documentId)));
    const docTitles = new Map<string, string>();
    await Promise.all(
      uniqueDocIds.map(async (id) => {
        const doc = await documentRepository.getById(id).catch(() => null);
        docTitles.set(id, doc?.title ?? "Untitled document");
      })
    );

    const enriched = approvals.map((a) => ({
      id: a.id,
      documentId: a.documentId,
      document: docTitles.get(a.documentId) ?? "Untitled document",
      approver: names.get(a.userId) ?? "Unknown",
      status: a.status,
      date: toIso(a.signedAt),
    }));

    return successResponse({ approvals: enriched, total: enriched.length });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
