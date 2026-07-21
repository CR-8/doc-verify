import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { validateCsrf } from "@/lib/middleware/csrf";
import { DocumentUploadCompleteSchema } from "@/lib/validators/document-schemas";
import { storageService } from "@/lib/storage/storage-service";
import { documentRepository } from "@/lib/db/repositories/document-repository";
import { virusScanner } from "@/lib/virus-scanner/scanner";
import { hashDocument } from "@/lib/crypto/hash";
import { getKeyManagementService } from "@/lib/crypto/key-management";
import { PDFDocument } from "pdf-lib";
import { enqueueJob } from "@/lib/jobs/processing-queue";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { enforceUploadQuota } from "@/lib/payments/quota";
import { logger } from "@/lib/logger/logger";
import { Timestamp as AdminTimestamp } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  logger.info("Document complete: request received", { action: "document_complete_start", correlationId });
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    logger.info("Document complete: authenticated", { action: "document_complete_auth", correlationId, userId: user.uid });
    await requireRole(user.uid, "viewer");
    logger.info("Document complete: role authorized", { action: "document_complete_role", correlationId, userId: user.uid });
    await checkRateLimit("POST", "/api/documents/complete", request.headers.get("x-forwarded-for") || "unknown");
    await enforceUploadQuota(user.uid);

    const body = DocumentUploadCompleteSchema.parse(await request.json());
    logger.info("Document complete: body parsed", {
      action: "document_complete_body",
      correlationId,
      userId: user.uid,
      metadata: { uploadId: body.uploadId, title: body.title, classification: body.classification },
    });

    const { buffer, fileSize } = await storageService.verifyAndFinalize(body.uploadId);
    logger.info("Document complete: temp upload finalized", {
      action: "document_complete_finalized",
      correlationId,
      userId: user.uid,
      metadata: { uploadId: body.uploadId, fileSize },
    });

    const scanResult = await virusScanner.scan(buffer);
    logger.info("Document complete: virus scan done", {
      action: "document_complete_scanned",
      correlationId,
      userId: user.uid,
      metadata: { clean: scanResult.clean, skipped: scanResult.skipped, threatName: scanResult.threatName, scanTimeMs: scanResult.scanTimeMs },
    });
    if (!scanResult.clean) {
      logger.warn("Document complete: rejected by virus scan", {
        action: "document_complete_virus",
        correlationId,
        userId: user.uid,
        metadata: { uploadId: body.uploadId, threatName: scanResult.threatName },
      });
      await storageService.cleanupTemp(body.uploadId);
      return handleRouteError(
        Object.assign(new Error("Virus detected in uploaded file"), { code: "VIRUS_DETECTED", statusCode: 400 }),
        correlationId
      );
    }

    const sha256Hash = hashDocument(buffer);
    const kms = getKeyManagementService();

    // Read the real page count up front so the document record and UI never show
    // "0 pages". A malformed PDF should not fail the whole upload, so fall back
    // to 0 and let downstream PDF generation surface any real corruption.
    let pageCount = 0;
    try {
      const parsed = await PDFDocument.load(buffer, { ignoreEncryption: true });
      pageCount = parsed.getPageCount();
    } catch (err) {
      logger.warn("Document complete: could not read page count", {
        action: "document_complete_pagecount_failed",
        correlationId,
        userId: user.uid,
        metadata: { error: err instanceof Error ? err.message : String(err) },
      });
    }

    const doc = await documentRepository.create({
      title: body.title,
      description: body.description || "",
      fileName: `${body.uploadId}.pdf`,
      fileSizeBytes: fileSize,
      pageCount,
      sha256Hash,
      status: "processing",
      uploadedBy: user.uid,
      uploadedAt: AdminTimestamp.now() as any,
      updatedAt: AdminTimestamp.now() as any,
      metadata: body.metadata || {},
      storagePaths: { original: "", public: "", internal: "" },
      encryptedDataKey: "",
      encryptionIv: "",
      encryptionKeyVersion: await kms.getKeyVersion(),
      requiredApprovals: body.requiredApprovals || 1,
      currentApprovals: 0,
      classification: body.classification || "unclassified",
      expiresAt: (body.expiresAt ? AdminTimestamp.fromDate(new Date(body.expiresAt)) : null) as any,
      signaturePageMap: {},
    });

    logger.info("Document complete: document record created", {
      action: "document_complete_created",
      correlationId,
      userId: user.uid,
      metadata: { documentId: doc.id },
    });

    const { encryptedDataKey, encryptionIv, path: originalPath } = await storageService.storeOriginal(doc.id, buffer);
    await documentRepository.update(doc.id, {
      encryptedDataKey,
      encryptionIv,
      storagePaths: { ...doc.storagePaths, original: originalPath },
    });
    await storageService.cleanupTemp(body.uploadId);
    logger.info("Document complete: original stored and temp cleaned", {
      action: "document_complete_stored",
      correlationId,
      userId: user.uid,
      metadata: { documentId: doc.id },
    });

    await documentRepository.updateStatus(doc.id, "pending_approval");

    await enqueueJob({
      documentId: doc.id,
      jobType: "public_pdf",
      correlationId,
    });

    await createAuditLog({
      action: "DOCUMENT_UPLOADED",
      actorId: user.uid,
      targetId: doc.id,
      targetType: "document",
      details: { title: body.title, fileSize, sha256Hash },
      correlationId,
    });

    logger.info("Document complete: success", {
      action: "document_complete_success",
      correlationId,
      userId: user.uid,
      metadata: { documentId: doc.id },
    });
    return successResponse({ documentId: doc.id, status: "pending_approval", sha256Hash }, 201);
  } catch (error) {
    logger.error("Document complete: failed", {
      action: "document_complete_error",
      correlationId,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return handleRouteError(error, correlationId);
  }
}
