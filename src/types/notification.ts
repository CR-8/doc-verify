import type { Timestamp } from "firebase/firestore";

export type NotificationType = "approval_request" | "approval_completed" | "certificate_generated" | "document_uploaded" | "document_expired" | "system";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  documentId: string;
  createdAt: Timestamp;
}
