import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest, optionalAuth } from "@/lib/middleware/auth-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { documentRepository } from "@/lib/db/repositories/document-repository";
import { approvalRepository } from "@/lib/db/repositories/approval-repository";
import { certificateRepository } from "@/lib/db/repositories/certificate-repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    const { documentId } = await params;
    const auth = await optionalAuth(_request);
    const doc = await documentRepository.getById(documentId);

    if (!doc) {
      return handleRouteError(
        Object.assign(new Error("Document not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }

    if (!auth) {
      return successResponse({
        id: doc.id,
        title: doc.title,
        status: doc.status,
        sha256Hash: doc.sha256Hash,
        metadata: doc.metadata,
        pageCount: doc.pageCount,
        fileSizeBytes: doc.fileSizeBytes,
        uploadedAt: doc.uploadedAt,
        expiresAt: doc.expiresAt,
      });
    }

    const approvals = await approvalRepository.getByDocumentId(documentId);
    const certificates = await certificateRepository.getByDocumentId(documentId);

    return successResponse({
      ...doc,
      approvals,
      certificates,
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
