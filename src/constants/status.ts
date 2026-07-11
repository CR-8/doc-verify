export const DOCUMENT_STATUS = {
  DRAFT: "draft",
  PROCESSING: "processing",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  ARCHIVED: "archived",
} as const;

export const APPROVAL_STATUS = {
  PENDING: "pending",
  SIGNED: "signed",
  REJECTED: "rejected",
} as const;

export const JOB_STATUS = {
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;
