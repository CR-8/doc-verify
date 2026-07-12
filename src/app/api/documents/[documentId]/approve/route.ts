import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { validateCsrf } from "@/lib/middleware/csrf";
import { ApprovalActionSchema } from "@/lib/validators/approval-schemas";
import { documentRepository } from "@/lib/db/repositories/document-repository";
import { approvalRepository } from "@/lib/db/repositories/approval-repository";
import { certificateRepository } from "@/lib/db/repositories/certificate-repository";
import { enqueueJob } from "@/lib/jobs/processing-queue";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { generateToken, generateId } from "@/lib/utils";
import { hashPayload } from "@/lib/crypto/hash";
import { getAuthProvider } from "@/lib/auth/firebase-provider";
import { Timestamp as AdminTimestamp } from "firebase-admin/firestore";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "approver");
    await checkRateLimit("POST", "/api/documents/*/approve", request.headers.get("x-forwarded-for") || "unknown");

    const { documentId } = await params;
    const body = ApprovalActionSchema.parse(await request.json().catch(() => ({})));

    const doc = await documentRepository.getById(documentId);
    if (!doc) {
      return handleRouteError(
        Object.assign(new Error("Document not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }

    if (doc.status === "archived") {
      return handleRouteError(
        Object.assign(new Error("Cannot approve an archived document"), { code: "DOCUMENT_ARCHIVED", statusCode: 400 }),
        correlationId
      );
    }

    if (doc.status !== "pending_approval") {
      return handleRouteError(
        Object.assign(new Error("Document is not pending approval"), { code: "APPROVAL_PENDING", statusCode: 400 }),
        correlationId
      );
    }

    const existingApprovals = await approvalRepository.listByDocument(documentId);
    if (existingApprovals.some((a) => a.userId === user.uid && a.status === "signed")) {
      return handleRouteError(
        Object.assign(new Error("Already approved this document"), { code: "ALREADY_APPROVED", statusCode: 409 }),
        correlationId
      );
    }

    const signatureId = generateId();
    const verificationToken = generateToken();
    const signedAtTs = AdminTimestamp.now();
    const signedAt = signedAtTs.toDate().toISOString();
    const signatureHash = hashPayload({
      documentHash: doc.sha256Hash,
      userId: user.uid,
      timestamp: signedAt,
      verificationToken,
    });

    const approval = await approvalRepository.create({
      documentId,
      userId: user.uid,
      signatureId,
      status: "signed",
      signedAt: signedAtTs as any,
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      certificateId: "",
      verificationToken,
      signatureHash,
      signaturePage: body.signaturePage || 0,
      pageSelectorType: body.signaturePage ? "manual" : "auto_append",
      metadata: {},
    });

    const currentCount = await documentRepository.incrementApprovals(documentId);
    const newStatus = currentCount >= doc.requiredApprovals ? "approved" : "pending_approval";
    await documentRepository.updateStatus(documentId, newStatus);

    const cert = await certificateRepository.create({
      documentId,
      approvalId: approval.id,
      signatureId,
      signerId: user.uid,
      signerName: user.displayName,
      signerDesignation: "",
      documentTitle: doc.title,
      documentHash: doc.sha256Hash,
      signedAt: signedAtTs as any,
      verificationToken,
      certificateHash: "",
      expiresAt: doc.expiresAt,
    });

    const certificateHash = hashPayload({
      certificateId: cert.id,
      documentId,
      signatureId,
      signerId: user.uid,
      signerName: user.displayName,
      documentHash: doc.sha256Hash,
      signedAt,
      verificationToken,
    });
    await certificateRepository.update(cert.id, { certificateHash });

    await enqueueJob({ documentId, jobType: "internal_pdf", correlationId });
    await enqueueJob({ documentId, jobType: "certificate", correlationId });

    await createAuditLog({
      action: "DOCUMENT_APPROVED",
      actorId: user.uid,
      targetId: documentId,
      targetType: "document",
      details: { approvalId: approval.id, certificateId: cert.id, signatureId },
      correlationId,
    });

    return successResponse({
      approvalId: approval.id,
      signatureId,
      certificateId: cert.id,
      verificationToken,
      status: newStatus,
    }, 201);
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
