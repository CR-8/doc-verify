import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import { Timestamp as AdminTimestamp, FieldValue } from "firebase-admin/firestore";
import type { ProcessingJob, JobType, JobStatus } from "@/types/processing-job";

const COLLECTION = "processingJobs";

export const processingJobRepository = {
  async create(job: Omit<ProcessingJob, "id">): Promise<ProcessingJob> {
    const ref = adminDb.collection(COLLECTION).doc();
    await ref.set({
      ...job,
      status: "queued",
      progress: 0,
      attempts: 0,
      createdAt: AdminTimestamp.now(),
      updatedAt: AdminTimestamp.now(),
    });
    return { ...job, id: ref.id, status: "queued", progress: 0, attempts: 0 };
  },

  async getById(id: string): Promise<ProcessingJob | null> {
    const doc = await adminDb.collection(COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as ProcessingJob;
  },

  async updateStatus(id: string, status: JobStatus, errorMessage?: string): Promise<void> {
    const update: Record<string, unknown> = {
      status,
      updatedAt: AdminTimestamp.now(),
    };
    if (status === "processing") {
      update.startedAt = AdminTimestamp.now();
    }
    if (status === "completed") {
      update.completedAt = AdminTimestamp.now();
      update.progress = 100;
    }
    if (errorMessage) {
      update.errorMessage = errorMessage;
    }
    await adminDb.collection(COLLECTION).doc(id).update(update);
  },

  async updateProgress(id: string, progress: number): Promise<void> {
    await adminDb.collection(COLLECTION).doc(id).update({
      progress,
      updatedAt: AdminTimestamp.now(),
    });
  },

  async incrementAttempts(id: string): Promise<void> {
    await adminDb.collection(COLLECTION).doc(id).update({
      attempts: FieldValue.increment(1),
      updatedAt: AdminTimestamp.now(),
    });
  },

  async listQueued(): Promise<ProcessingJob[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("status", "==", "queued")
      .orderBy("createdAt", "asc")
      .limit(10)
      .get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ProcessingJob));
  },

  async listFailed(): Promise<ProcessingJob[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("status", "==", "failed")
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ProcessingJob));
  },

  // No orderBy so this needs only a single-field index on documentId; callers
  // that care about ordering sort in memory.
  async listByDocument(documentId: string): Promise<ProcessingJob[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("documentId", "==", documentId)
      .get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ProcessingJob));
  },
};
