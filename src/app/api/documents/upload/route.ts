import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { validateCsrf } from "@/lib/middleware/csrf";
import { storageService } from "@/lib/storage/storage-service";
import { AppError, ErrorCodes } from "@/constants/errors";

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "approver");
    await checkRateLimit("POST", "/api/documents/upload-url", request.headers.get("x-forwarded-for") || "unknown");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "No file provided", 400);
    }

    const { uploadId } = await storageService.generateUploadUrl();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await storageService.acceptUpload(uploadId, buffer);

    return successResponse({ uploadId, fileName: file.name, fileSize: file.size }, 201);
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
