import type { Timestamp } from "firebase/firestore";

export interface Certificate {
  id: string;
  documentId: string;
  approvalId: string;
  signatureId: string;
  signerId: string;
  signerName: string;
  signerDesignation: string;
  documentTitle: string;
  documentHash: string;
  signedAt: Timestamp;
  verificationToken: string;
  certificateHash: string;
  expiresAt: Timestamp | null;
}
