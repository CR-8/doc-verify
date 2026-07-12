import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { certificateRepository } from "@/lib/db/repositories/certificate-repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    const { certificateId } = await params;
    // Certificates are linked both by their document id (from the QR code) and
    // by their 64-char verification token (from the verify page), so accept
    // either form.
    const cert =
      (await certificateRepository.getById(certificateId)) ??
      (await certificateRepository.getByToken(certificateId));
    if (!cert) {
      return handleRouteError(
        Object.assign(new Error("Certificate not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }
    return successResponse({
      ...cert,
      signedAt: cert.signedAt?.toDate?.()?.toISOString() || null,
      expiresAt: cert.expiresAt?.toDate?.()?.toISOString() || null,
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
