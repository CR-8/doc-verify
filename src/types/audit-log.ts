import type { Timestamp } from "firebase/firestore";

export type AuditSeverity = "info" | "warning" | "error" | "critical";

export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  targetId: string;
  targetType: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: Timestamp;
  severity: AuditSeverity;
  partition: string;
  correlationId: string;
}
