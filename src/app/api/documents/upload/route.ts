import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { validateCsrf } from "@/lib/middleware/csrf";
import { storageService } from "@/lib/storage/storage-service";
import { AppError, ErrorCodes } from "@/constants/errors";
import { logger } from "@/lib/logger/logger";

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  logger.info("Document upload: request received", { action: "document_upload_start", correlationId });
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "viewer");
    logger.info("Document upload: authorized", { action: "document_upload_auth", correlationId, userId: user.uid });
    await checkRateLimit("POST", "/api/documents/upload-url", request.headers.get("x-forwarded-for") || "unknown");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      logger.warn("Document upload: no file provided", { action: "document_upload_no_file", correlationId, userId: user.uid });
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "No file provided", 400);
    }

    const { uploadId } = await storageService.generateUploadUrl();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    logger.info("Document upload: accepting file", {
      action: "document_upload_accepting",
      correlationId,
      userId: user.uid,
      metadata: { uploadId, fileName: file.name, fileSize: file.size },
    });
    await storageService.acceptUpload(uploadId, buffer);
    logger.info("Document upload: stored to temp", {
      action: "document_upload_stored",
      correlationId,
      userId: user.uid,
      metadata: { uploadId },
    });

    return successResponse({ uploadId, fileName: file.name, fileSize: file.size }, 201);
  } catch (error) {
    logger.error("Document upload: failed", {
      action: "document_upload_error",
      correlationId,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return handleRouteError(error, correlationId);
  }
}
