import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { validateCsrf } from "@/lib/middleware/csrf";
import { processingJobRepository } from "@/lib/db/repositories/processing-job-repository";
import { retryFailedJob, processJob } from "@/lib/jobs/processing-queue";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { logger } from "@/lib/logger/logger";

// Re-runs any failed processing jobs (public/internal PDF, certificate) for a
// document. Used to recover documents whose derived PDFs never generated —
// there is no background worker, so jobs are re-run inline here.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { documentId } = await params;
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "viewer");
    await checkRateLimit("POST", "/api/documents/*/reprocess", request.headers.get("x-forwarded-for") || "unknown");

    const jobs = await processingJobRepository.listByDocument(documentId);
    const failed = jobs.filter((j) => j.status === "failed");

    logger.info("Reprocess: retrying failed jobs", {
      action: "document_reprocess_start",
      correlationId,
      userId: user.uid,
      metadata: { documentId, failedCount: failed.length },
    });

    const results: Array<{ jobId: string; jobType: string; retried: boolean; reason?: string }> = [];
    for (const job of failed) {
      try {
        await retryFailedJob(job.id);
        await processJob(job.id);
        results.push({ jobId: job.id, jobType: job.jobType, retried: true });
      } catch (error) {
        // e.g. max retry attempts reached — record and keep going.
        results.push({
          jobId: job.id,
          jobType: job.jobType,
          retried: false,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const retriedCount = results.filter((r) => r.retried).length;
    if (retriedCount > 0) {
      await createAuditLog({
        action: "DOCUMENT_REPROCESSED",
        actorId: user.uid,
        targetId: documentId,
        targetType: "document",
        details: { retriedCount, jobs: results },
        correlationId,
      });
    }

    logger.info("Reprocess: done", {
      action: "document_reprocess_done",
      correlationId,
      userId: user.uid,
      metadata: { documentId, retriedCount, totalFailed: failed.length },
    });

    return successResponse({ documentId, retried: retriedCount, totalFailed: failed.length, results });
  } catch (error) {
    logger.error("Reprocess: failed", {
      action: "document_reprocess_error",
      correlationId,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return handleRouteError(error, correlationId);
  }
}
