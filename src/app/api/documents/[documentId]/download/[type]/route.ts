import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { storageService } from "@/lib/storage/storage-service";
import { documentRepository } from "@/lib/db/repositories/document-repository";

function safeFileName(title: string, suffix: string): string {
  const base = (title || "document").replace(/[^a-zA-Z0-9-_ ]+/g, "").trim().replace(/\s+/g, "_") || "document";
  return `${base}-${suffix}.pdf`;
}

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

    let buffer: Buffer;
    if (type === "original") {
      await requireRole(user.uid, "admin");
      buffer = await storageService.getOriginalBuffer(documentId, doc.encryptedDataKey);
    } else {
      buffer = await storageService.getDocumentBuffer(documentId, type as "public" | "internal");
    }

    const fileName = safeFileName(doc.title, type);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
