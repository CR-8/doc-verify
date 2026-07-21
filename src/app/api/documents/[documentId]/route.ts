import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest, optionalAuth } from "@/lib/middleware/auth-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { validateCsrf } from "@/lib/middleware/csrf";
import { hasDocumentAccess } from "@/lib/middleware/role-guard";
import { documentRepository } from "@/lib/db/repositories/document-repository";
import { approvalRepository } from "@/lib/db/repositories/approval-repository";
import { certificateRepository } from "@/lib/db/repositories/certificate-repository";
import { resolveUserNames, toIso } from "@/lib/db/enrich";
import { storageService } from "@/lib/storage/storage-service";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { AppError, ErrorCodes } from "@/constants/errors";

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

    // Resolve the uploader and every approver's display name in one batch so the
    // UI never has to show a raw Firebase UID.
    const names = await resolveUserNames([doc.uploadedBy, ...approvals.map((a) => a.userId)]);

    const enrichedApprovals = approvals.map((a) => ({
      id: a.id,
      approver: names.get(a.userId) ?? "Unknown",
      status: a.status,
      date: toIso(a.signedAt),
      comment: a.metadata?.comment ?? "",
    }));

    const firstCert = certificates[0];

    return successResponse({
      id: doc.id,
      title: doc.title,
      description: doc.description,
      status: doc.status,
      fileName: doc.fileName,
      fileSize: doc.fileSizeBytes,
      pageCount: doc.pageCount,
      sha256Hash: doc.sha256Hash,
      uploadedBy: names.get(doc.uploadedBy) ?? "Unknown",
      uploadedAt: toIso(doc.uploadedAt),
      classification: doc.classification,
      requiredApprovals: doc.requiredApprovals,
      currentApprovals: doc.currentApprovals,
      expiresAt: toIso(doc.expiresAt),
      approvals: enrichedApprovals,
      hasCertificate: certificates.length > 0,
      certificateId: firstCert?.id,
      certificates,
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    await checkRateLimit("DELETE", "/api/documents/*", request.headers.get("x-forwarded-for") || "unknown");

    const { documentId } = await params;
    const doc = await documentRepository.getById(documentId);
    if (!doc) {
      return handleRouteError(
        Object.assign(new Error("Document not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }

    const isUploader = doc.uploadedBy === user.uid;
    if (!isUploader) {
      const isAdmin = await hasDocumentAccess(user.uid, documentId, "admin");
      if (!isAdmin) {
        throw new AppError(ErrorCodes.FORBIDDEN, "Only the uploader or an admin can delete this document", 403);
      }
    }

    await storageService.cleanupDocument(documentId);
    await approvalRepository.deleteByDocumentId(documentId);
    await certificateRepository.deleteByDocumentId(documentId);
    await documentRepository.delete(documentId);

    await createAuditLog({
      action: "DOCUMENT_DELETED",
      actorId: user.uid,
      targetId: documentId,
      targetType: "document",
      details: { title: doc.title, status: doc.status, fileName: doc.fileName },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      correlationId,
    });

    return successResponse({ deleted: true, id: documentId });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
