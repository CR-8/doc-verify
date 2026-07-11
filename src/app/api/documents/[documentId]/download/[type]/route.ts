import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { storageService } from "@/lib/storage/storage-service";
import { documentRepository } from "@/lib/db/repositories/document-repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string; type: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    const { documentId, type } = await params;
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "viewer");
    await checkRateLimit("GET", "/api/documents/*/download/*", request.headers.get("x-forwarded-for") || "unknown");

    if (!["original", "public", "internal"].includes(type)) {
      return handleRouteError(
        Object.assign(new Error("Invalid download type"), { code: "VALIDATION_ERROR", statusCode: 400 }),
        correlationId
      );
    }

    const doc = await documentRepository.getById(documentId);
    if (!doc) {
      return handleRouteError(
        Object.assign(new Error("Document not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }

    if (type === "internal" && doc.status !== "approved") {
      return handleRouteError(
        Object.assign(new Error("Internal PDF only available for approved documents"), { code: "FORBIDDEN", statusCode: 403 }),
        correlationId
      );
    }

    let url: string;
    if (type === "original") {
      await requireRole(user.uid, "admin");
      url = await storageService.getSignedDownloadUrl(doc.storagePaths.original);
    } else if (type === "public" || type === "internal") {
      url = await storageService.getSignedDownloadUrl(doc.storagePaths[type]);
    } else {
      return handleRouteError(
        Object.assign(new Error("Invalid download type"), { code: "VALIDATION_ERROR", statusCode: 400 }),
        correlationId
      );
    }

    return successResponse({ url, expiresIn: 900 });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
