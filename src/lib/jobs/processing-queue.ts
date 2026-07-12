import { processingJobRepository } from "@/lib/db/repositories/processing-job-repository";
import { storageService } from "@/lib/storage/storage-service";
import { generatePublicPdf } from "@/lib/pdf/public-pdf-generator";
import { generateInternalPdf } from "@/lib/pdf/internal-pdf-generator";
import { generateCertificatePdf } from "@/lib/pdf/certificate-generator";
import { documentRepository } from "@/lib/db/repositories/document-repository";
import { certificateRepository } from "@/lib/db/repositories/certificate-repository";
import { siteConfig } from "@/config/site";
import { logger } from "@/lib/logger/logger";
import type { PdfGenerationPayload, CertificatePayload } from "./job-types";

export async function enqueueJob(params: {
  documentId: string;
  jobType: "public_pdf" | "internal_pdf" | "certificate";
  correlationId: string;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await processingJobRepository.create({
    id: "",
    documentId: params.documentId,
    jobType: params.jobType,
    status: "queued" as const,
    progress: 0,
    errorMessage: "",
    errorCode: "",
    attempts: 0,
    idempotencyKey: params.idempotencyKey || `${params.documentId}_${params.jobType}_${Date.now()}`,
    correlationId: params.correlationId,
    createdAt: null as unknown as FirebaseFirestore.Timestamp,
    updatedAt: null as unknown as FirebaseFirestore.Timestamp,
    completedAt: null,
  } as any);

  // There is no separate background worker in this deployment, so run the job
  // inline. processJob records success/failure on the job record itself and
  // does not rethrow, so enqueue callers (upload/approve) still succeed even if
  // PDF generation fails — the failure is visible via the job status.
  await processJob(job.id).catch((error) => {
    logger.error("Inline job processing error", {
      action: "job_inline_error",
      metadata: { jobId: job.id, documentId: params.documentId, jobType: params.jobType, error: String(error) },
    });
  });

  return job.id;
}

export async function processJob(jobId: string): Promise<void> {
  const job = await processingJobRepository.getById(jobId);
  if (!job || job.status !== "queued") return;

  await processingJobRepository.updateStatus(jobId, "processing");

  try {
    switch (job.jobType) {
      case "public_pdf":
        await handlePublicPdfGeneration(job.documentId, jobId);
        break;
      case "internal_pdf":
        await handleInternalPdfGeneration(job.documentId, jobId);
        break;
      case "certificate":
        await handleCertificateGeneration(job.documentId, jobId);
        break;
    }
    await processingJobRepository.updateStatus(jobId, "completed");
  } catch (error) {
    await processingJobRepository.incrementAttempts(jobId);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await processingJobRepository.updateStatus(jobId, "failed", errorMessage);
    logger.error("Job processing failed", {
      action: "job_failed",
      metadata: { jobId, documentId: job.documentId, jobType: job.jobType, error: errorMessage },
    });

    if (job.attempts >= 2) {
      await documentRepository.updateStatus(job.documentId, "draft");
    }
  }
}

async function handlePublicPdfGeneration(documentId: string, _jobId: string): Promise<void> {
  const doc = await documentRepository.getById(documentId);
  if (!doc) throw new Error("Document not found");
  const buffer = await storageService.getOriginalBuffer(documentId, doc.encryptedDataKey);
  const publicPdf = await generatePublicPdf(buffer, documentId);
  const publicId = await storageService.storePublicPdf(documentId, publicPdf);
  await documentRepository.update(documentId, {
    storagePaths: { ...doc.storagePaths, public: publicId },
  });
}

async function handleInternalPdfGeneration(documentId: string, _jobId: string): Promise<void> {
  const doc = await documentRepository.getById(documentId);
  if (!doc) throw new Error("Document not found");

  const approvalsModule = await import("@/lib/db/repositories/approval-repository");
  const approvals = await approvalsModule.approvalRepository.getByDocumentId(documentId);
  const signedApprovals = approvals.filter((a) => a.status === "signed");

  const signatures = signedApprovals.map((a) => ({
    verificationToken: a.verificationToken,
    signerName: "",
    signerDesignation: "",
    signedAt: a.signedAt?.toDate?.()?.toISOString() || "",
    signatureHash: a.signatureHash,
    preferredPage: a.signaturePage || undefined,
  }));

  const buffer = await storageService.getOriginalBuffer(documentId, doc.encryptedDataKey);
  const internalPdf = await generateInternalPdf(buffer, documentId, signatures);
  const internalId = await storageService.storeInternalPdf(documentId, internalPdf);
  await documentRepository.update(documentId, {
    storagePaths: { ...doc.storagePaths, internal: internalId },
  });
}

async function handleCertificateGeneration(documentId: string, _jobId: string): Promise<void> {
  const doc = await documentRepository.getById(documentId);
  if (!doc) throw new Error("Document not found");

  const certs = await certificateRepository.getByDocumentId(documentId);
  for (const cert of certs) {
    const pdfBuffer = await generateCertificatePdf({
      certificateId: cert.id,
      documentTitle: doc.title,
      documentId: doc.id,
      signerName: cert.signerName,
      signerDesignation: cert.signerDesignation,
      signedAt: cert.signedAt?.toDate?.()?.toISOString() || "",
      documentHash: cert.documentHash,
      verificationToken: cert.verificationToken,
    });
    await storageService.storeCertificate(cert.id, pdfBuffer);
  }
}

export async function retryFailedJob(jobId: string): Promise<void> {
  const job = await processingJobRepository.getById(jobId);
  if (!job || job.status !== "failed") return;
  if (job.attempts >= 3) throw new Error("Max retry attempts reached");
  await processingJobRepository.updateStatus(jobId, "queued");
}
