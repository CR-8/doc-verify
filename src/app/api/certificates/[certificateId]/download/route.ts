import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { storageService } from "@/lib/storage/storage-service";
import { certificateRepository } from "@/lib/db/repositories/certificate-repository";
import { siteConfig } from "@/config/site";

// Public: the certificate is a verification artifact reachable via its
// unguessable id/token (QR code or verify page). The metadata route already
// exposes the same certificate publicly, so the PDF download is public too,
// gated by knowledge of the token and rate limited.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    const { certificateId } = await params;
    await checkRateLimit("GET", "/api/certificates/*/download", request.headers.get("x-forwarded-for") || "unknown");

    const cert =
      (await certificateRepository.getById(certificateId)) ??
      (await certificateRepository.getByToken(certificateId));
    if (!cert) {
      return handleRouteError(
        Object.assign(new Error("Certificate not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }

    // The certificate PDF is stored under the certificate's own id.
    const path = `${siteConfig.storage.certificatesPrefix}/${cert.id}`;
    const buffer = await storageService.getRawBuffer(path);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${cert.id}.pdf"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
