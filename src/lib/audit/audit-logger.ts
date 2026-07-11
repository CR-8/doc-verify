import { auditLogRepository } from "@/lib/db/repositories/audit-log-repository";
import type { AuditSeverity } from "@/types/audit-log";
import { logger } from "@/lib/logger/logger";

export async function createAuditLog(params: {
  action: string;
  actorId: string;
  targetId: string;
  targetType: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity?: AuditSeverity;
  correlationId?: string;
}): Promise<void> {
  try {
    const log = {
      action: params.action,
      actorId: params.actorId,
      targetId: params.targetId,
      targetType: params.targetType,
      details: params.details ?? {},
      ipAddress: params.ipAddress ?? "",
      userAgent: params.userAgent ?? "",
      timestamp: null as unknown as FirebaseFirestore.Timestamp,
      severity: params.severity ?? ("info" as const),
      partition: new Date().toISOString().slice(0, 7),
      correlationId: params.correlationId ?? "",
    };
    await auditLogRepository.create(log as any);
  } catch (error) {
    logger.error("Failed to create audit log", {
      action: "audit_log_failed",
      metadata: { error: String(error), originalAction: params.action },
    });
  }
}
