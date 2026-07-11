import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { storageService } from "@/lib/storage/storage-service";
import { certificateRepository } from "@/lib/db/repositories/certificate-repository";
import { siteConfig } from "@/config/site";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    const { certificateId } = await params;
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "approver");
    await checkRateLimit("GET", "/api/certificates/*/download", request.headers.get("x-forwarded-for") || "unknown");

    const cert = await certificateRepository.getById(certificateId);
    if (!cert) {
      return handleRouteError(
        Object.assign(new Error("Certificate not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }

    const path = `${siteConfig.storage.certificatesPrefix}/${certificateId}.pdf`;
    const url = await storageService.getSignedDownloadUrl(path);

    return successResponse({ url, expiresIn: 900 });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
