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
    const cert = await certificateRepository.getById(certificateId);
    if (!cert) {
      return handleRouteError(
        Object.assign(new Error("Certificate not found"), { code: "NOT_FOUND", statusCode: 404 }),
        correlationId
      );
    }
    return successResponse(cert);
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
