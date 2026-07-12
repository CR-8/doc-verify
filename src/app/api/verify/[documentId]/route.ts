import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { documentRepository } from "@/lib/db/repositories/document-repository";
import { approvalRepository } from "@/lib/db/repositories/approval-repository";
import { userRepository } from "@/lib/db/repositories/user-repository";

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
      // Return a verification result (not an HTTP error) so the page can render
      // its "not found" state rather than a generic error.
      return successResponse({ valid: false, document: null, signature: null });
    }

    const approvals = await approvalRepository.getByDocumentId(documentId);
    const signed = approvals.filter((a) => a.status === "signed");
    const latest = signed[signed.length - 1];

    let signature = null;
    if (latest) {
      const signer = await userRepository.getById(latest.userId);
      signature = {
        signerName: signer?.displayName || "Unknown Signer",
        signedAt: latest.signedAt?.toDate?.()?.toISOString() || "",
        verificationToken: latest.verificationToken,
      };
    }

    return successResponse({
      valid: doc.status === "approved",
      document: {
        title: doc.title,
        sha256Hash: doc.sha256Hash,
        status: doc.status,
        uploadedAt: doc.uploadedAt?.toDate?.()?.toISOString() || null,
      },
      signature,
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
