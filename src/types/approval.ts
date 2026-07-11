import type { Timestamp } from "firebase/firestore";

export type ApprovalStatus = "pending" | "signed" | "rejected";

export interface Approval {
  id: string;
  documentId: string;
  userId: string;
  signatureId: string;
  status: ApprovalStatus;
  signedAt: Timestamp;
  ipAddress: string;
  userAgent: string;
  certificateId: string;
  verificationToken: string;
  signatureHash: string;
  signaturePage: number;
  pageSelectorType: "auto_acroform" | "auto_layout" | "auto_append" | "manual";
  metadata: Record<string, string>;
}
