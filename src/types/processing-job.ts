import type { Timestamp } from "firebase/firestore";

export type JobType = "public_pdf" | "internal_pdf" | "certificate" | "virus_scan" | "encrypt";
export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export interface ProcessingJob {
  id: string;
  documentId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  errorMessage: string;
  errorCode: string;
  attempts: number;
  idempotencyKey: string;
  correlationId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
}
