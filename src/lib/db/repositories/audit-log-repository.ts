import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import { Timestamp as AdminTimestamp } from "firebase-admin/firestore";
import type { AuditLog, AuditSeverity } from "@/types/audit-log";
import { siteConfig } from "@/config/site";

const COLLECTION = "auditLogs";

export const auditLogRepository = {
  async create(log: Omit<AuditLog, "id">): Promise<AuditLog> {
    const ref = adminDb.collection(COLLECTION).doc();
    const details = log.details ?? {};
    const detailsJson = JSON.stringify(details);
    if (detailsJson.length > siteConfig.auditLog.maxDetailsBytes) {
      details._truncated = true;
    }
    await ref.set({
      ...log,
      details,
      timestamp: AdminTimestamp.now(),
      partition: new Date().toISOString().slice(0, 7),
    });
    const result = { ...log, id: ref.id, timestamp: AdminTimestamp.now() };
    return result as unknown as AuditLog;
  },

  async list(query: {
    targetId?: string;
    action?: string;
    actorId?: string;
    partition?: string;
    severity?: AuditSeverity;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: AuditLog[]; nextCursor: string | null; total: number }> {
    let baseQuery: FirebaseFirestore.Query = adminDb.collection(COLLECTION);

    if (query.partition) {
      baseQuery = baseQuery.where("partition", "==", query.partition);
    }
    if (query.targetId) {
      baseQuery = baseQuery.where("targetId", "==", query.targetId);
    }
    if (query.action) {
      baseQuery = baseQuery.where("action", "==", query.action);
    }
    if (query.actorId) {
      baseQuery = baseQuery.where("actorId", "==", query.actorId);
    }
    if (query.severity) {
      baseQuery = baseQuery.where("severity", "==", query.severity);
    }

    baseQuery = baseQuery.orderBy("timestamp", "desc");

    if (query.cursor) {
      const cursorDoc = await adminDb.collection(COLLECTION).doc(query.cursor).get();
      if (cursorDoc.exists) {
        baseQuery = baseQuery.startAfter(cursorDoc);
      }
    }

    const limit = Math.min(query.limit ?? 20, 100);
    baseQuery = baseQuery.limit(limit + 1);

    const snapshot = await baseQuery.get();
    const items = snapshot.docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() } as AuditLog));
    const nextCursor = snapshot.docs.length > limit ? items[items.length - 1]?.id ?? null : null;

    const countSnapshot = await adminDb.collection(COLLECTION).count().get();
    const total = countSnapshot.data()?.count ?? 0;

    return { items, nextCursor, total };
  },
};
