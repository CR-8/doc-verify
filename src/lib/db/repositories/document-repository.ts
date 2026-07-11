import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import { documentConverter } from "@/lib/db/converters/document-converter";
import { Timestamp as AdminTimestamp, FieldValue } from "firebase-admin/firestore";
import type { Document, DocumentStatus } from "@/types/document";
import { AppError, ErrorCodes } from "@/constants/errors";

const COLLECTION = "documents";

export const documentRepository = {
  async create(doc: Omit<Document, "id">): Promise<Document> {
    const ref = adminDb.collection(COLLECTION).doc();
    await ref.set(documentConverter.toFirestore({ ...doc, id: ref.id } as Document));
    return { ...doc, id: ref.id };
  },

  async getById(id: string): Promise<Document | null> {
    const doc = await adminDb.collection(COLLECTION).doc(id).withConverter(documentConverter).get();
    if (!doc.exists) return null;
    return doc.data() ?? null;
  },

  async update(id: string, data: Partial<Document>): Promise<void> {
    await adminDb.collection(COLLECTION).doc(id).update(documentConverter.toFirestore(data as Document));
  },

  async updateStatus(id: string, status: DocumentStatus): Promise<void> {
    await adminDb.collection(COLLECTION).doc(id).update({ status, updatedAt: AdminTimestamp.now() });
  },

  async list(query: {
    status?: string;
    uploadedBy?: string;
    cursor?: string;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }): Promise<{ items: Document[]; nextCursor: string | null; total: number }> {
    let baseQuery: FirebaseFirestore.Query = adminDb.collection(COLLECTION).withConverter(documentConverter);

    if (query.status) {
      baseQuery = baseQuery.where("status", "==", query.status);
    }
    if (query.uploadedBy) {
      baseQuery = baseQuery.where("uploadedBy", "==", query.uploadedBy);
    }

    const sortField = query.sortBy || "uploadedAt";
    const sortOrder = query.sortOrder || "desc";
    baseQuery = baseQuery.orderBy(sortField, sortOrder);

    if (query.cursor) {
      const cursorDoc = await adminDb.collection(COLLECTION).doc(query.cursor).get();
      if (cursorDoc.exists) {
        baseQuery = baseQuery.startAfter(cursorDoc);
      }
    }

    const limit = Math.min(query.limit ?? 20, 100);
    baseQuery = baseQuery.limit(limit + 1);

    const snapshot = await baseQuery.get();
    const items = snapshot.docs.slice(0, limit).map((d) => d.data() as any);
    const nextCursor = snapshot.docs.length > limit ? items[items.length - 1]?.id ?? null : null;

    const countSnapshot = await adminDb.collection(COLLECTION).count().get();
    const total = countSnapshot.data()?.count ?? 0;

    return { items, nextCursor, total };
  },

  async incrementApprovals(id: string): Promise<number> {
    const ref = adminDb.collection(COLLECTION).doc(id);
    await ref.update({ currentApprovals: FieldValue.increment(1) });
    const doc = await ref.get();
    return doc.data()?.currentApprovals ?? 0;
  },

  async delete(id: string): Promise<void> {
    await adminDb.collection(COLLECTION).doc(id).delete();
  },
};
