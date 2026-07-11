import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { certificateRepository } from "@/lib/db/repositories/certificate-repository";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const { user } = await authenticateRequest(request);
    const url = new URL(request.url);
    const documentId = url.searchParams.get("documentId");

    let certificates;
    if (documentId) {
      certificates = await certificateRepository.getByDocumentId(documentId);
    } else {
      return handleRouteError(
        Object.assign(new Error("documentId query parameter is required"), { code: "VALIDATION_ERROR", statusCode: 400 }),
        correlationId
      );
    }

    return successResponse({ items: certificates, total: certificates.length });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
