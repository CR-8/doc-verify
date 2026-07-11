import type { Timestamp } from "firebase/firestore";

export type DocumentStatus = "draft" | "processing" | "pending_approval" | "approved" | "rejected" | "archived";

export interface Document {
  id: string;
  title: string;
  description: string;
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
  sha256Hash: string;
  status: DocumentStatus;
  uploadedBy: string;
  uploadedAt: Timestamp;
  updatedAt: Timestamp;
  metadata: Record<string, string>;
  storagePaths: {
    original: string;
    public: string;
    internal: string;
  };
  encryptedDataKey: string;
  encryptionIv: string;
  encryptionKeyVersion: string;
  requiredApprovals: number;
  currentApprovals: number;
  classification: string;
  expiresAt: Timestamp | null;
  signaturePageMap: Record<string, number[]>;
}
