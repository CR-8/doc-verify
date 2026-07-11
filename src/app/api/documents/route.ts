import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { documentRepository } from "@/lib/db/repositories/document-repository";
import { DocumentQuerySchema } from "@/lib/validators/document-schemas";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "viewer");
    await checkRateLimit("GET", "/api/documents", request.headers.get("x-forwarded-for") || "unknown");

    const url = new URL(request.url);
    const query = DocumentQuerySchema.parse(Object.fromEntries(url.searchParams));

    const result = await documentRepository.list({
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return successResponse(result);
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
