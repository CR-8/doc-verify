import type { JobType, JobStatus } from "@/types/processing-job";

export interface JobPayload {
  jobId: string;
  documentId: string;
  jobType: JobType;
  correlationId: string;
}

export interface PdfGenerationPayload extends JobPayload {
  jobType: "public_pdf" | "internal_pdf";
  signatureData?: Array<{
    verificationToken: string;
    signerName: string;
    signerDesignation: string;
    signedAt: string;
    signatureHash: string;
    preferredPage?: number;
  }>;
}

export interface CertificatePayload extends JobPayload {
  jobType: "certificate";
  approvalId: string;
  certificateId: string;
  signerName: string;
  signerDesignation: string;
  documentTitle: string;
  documentHash: string;
  signedAt: string;
  verificationToken: string;
}

export type AnyJobPayload = PdfGenerationPayload | CertificatePayload | JobPayload;
