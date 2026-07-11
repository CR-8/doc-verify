import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { documentRepository } from "@/lib/db/repositories/document-repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    const { documentId } = await params;
    await checkRateLimit("GET", "/api/verify/*", _request.headers.get("x-forwarded-for") || "unknown");

    const doc = await documentRepository.getById(documentId);
    if (!doc) {
      return handleRouteError(
        Object.assign(new Error("Document not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }

    return successResponse({
      valid: true,
      status: doc.status,
      sha256Hash: doc.sha256Hash,
      metadata: doc.metadata,
      pageCount: doc.pageCount,
      expiresAt: doc.expiresAt?.toDate?.()?.toISOString() || null,
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
