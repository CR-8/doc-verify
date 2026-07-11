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
import { enqueueJob } from "@/lib/jobs/processing-queue";
import { createAuditLog } from "@/lib/audit/audit-logger";

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "approver");
    await checkRateLimit("POST", "/api/documents/complete", request.headers.get("x-forwarded-for") || "unknown");

    const body = DocumentUploadCompleteSchema.parse(await request.json());

    const { buffer, fileSize } = await storageService.verifyAndFinalize(body.uploadId);

    const scanResult = await virusScanner.scan(buffer);
    if (!scanResult.clean) {
      await storageService.cleanupTemp(body.uploadId);
      return handleRouteError(
        Object.assign(new Error("Virus detected in uploaded file"), { code: "VIRUS_DETECTED", statusCode: 400 }),
        correlationId
      );
    }

    const sha256Hash = hashDocument(buffer);
    const kms = getKeyManagementService();

    const doc = await documentRepository.create({
      title: body.title,
      description: body.description || "",
      fileName: `${body.uploadId}.pdf`,
      fileSizeBytes: fileSize,
      pageCount: 0,
      sha256Hash,
      status: "processing",
      uploadedBy: user.uid,
      uploadedAt: null as any,
      updatedAt: null as any,
      metadata: body.metadata || {},
      storagePaths: { original: "", public: "", internal: "" },
      encryptedDataKey: "",
      encryptionIv: "",
      encryptionKeyVersion: await kms.getKeyVersion(),
      requiredApprovals: body.requiredApprovals || 1,
      currentApprovals: 0,
      classification: body.classification || "unclassified",
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      signaturePageMap: {},
    });

    const { encryptedDataKey, encryptionIv } = await storageService.storeOriginal(doc.id, buffer);
    await documentRepository.update(doc.id, { encryptedDataKey, encryptionIv });
    await storageService.cleanupTemp(body.uploadId);

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

    return successResponse({ documentId: doc.id, status: "pending_approval", sha256Hash }, 201);
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
