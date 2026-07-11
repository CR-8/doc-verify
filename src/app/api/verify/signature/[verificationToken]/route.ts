import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { approvalRepository } from "@/lib/db/repositories/approval-repository";
import { documentRepository } from "@/lib/db/repositories/document-repository";
import { userRepository } from "@/lib/db/repositories/user-repository";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ verificationToken: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    const { verificationToken } = await params;
    await checkRateLimit("GET", "/api/verify/*", _request.headers.get("x-forwarded-for") || "unknown");

    if (verificationToken.length !== 64) {
      return handleRouteError(
        Object.assign(new Error("Invalid verification token"), { code: "INVALID_TOKEN", statusCode: 400 }),
        correlationId
      );
    }

    const approval = await approvalRepository.getByToken(verificationToken);
    if (!approval) {
      return handleRouteError(
        Object.assign(new Error("Signature not found or invalid token"), { code: "INVALID_TOKEN", statusCode: 404 }),
        correlationId
      );
    }

    const [doc, user] = await Promise.all([
      documentRepository.getById(approval.documentId),
      userRepository.getById(approval.userId),
    ]);

    return successResponse({
      valid: approval.status === "signed",
      signer: user?.displayName || "Unknown Signer",
      signerEmail: user?.email || "",
      timestamp: approval.signedAt?.toDate?.()?.toISOString() || "",
      certificateId: approval.certificateId,
      documentHash: doc?.sha256Hash || "",
      documentId: approval.documentId,
      documentTitle: doc?.title || "",
      status: approval.status,
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
