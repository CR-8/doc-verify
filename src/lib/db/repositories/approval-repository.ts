import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import { Timestamp as AdminTimestamp } from "firebase-admin/firestore";
import { approvalConverter } from "@/lib/db/converters/approval-converter";
import type { Approval, ApprovalStatus } from "@/types/approval";

const COLLECTION = "approvals";

// Returns the signed time in millis, or null for approvals that are not yet
// signed (the `signedAt` field is absent until an approval is completed).
function signedMillis(approval: Approval): number | null {
  const value = (approval as { signedAt?: { toMillis?: () => number } }).signedAt;
  return value && typeof value.toMillis === "function" ? value.toMillis() : null;
}

// In-memory ordering by signedAt, keeping not-yet-signed approvals in the
// result (Firestore's orderBy would drop documents missing the field) and
// placing them last. Sorting client-side also avoids requiring a composite
// index for the documentId + signedAt queries.
function sortBySignedAt(approvals: Approval[], direction: "asc" | "desc"): Approval[] {
  return [...approvals].sort((a, b) => {
    const am = signedMillis(a);
    const bm = signedMillis(b);
    if (am === null && bm === null) return 0;
    if (am === null) return 1;
    if (bm === null) return -1;
    return direction === "asc" ? am - bm : bm - am;
  });
}

export const approvalRepository = {
  async create(approval: Omit<Approval, "id">): Promise<Approval> {
    const ref = adminDb.collection(COLLECTION).doc();
    const data = approvalConverter.toFirestore({ ...approval, id: ref.id } as Approval);
    await ref.set(data);
    return { ...approval, id: ref.id };
  },

  async getById(id: string): Promise<Approval | null> {
    const doc = await adminDb.collection(COLLECTION).doc(id).withConverter(approvalConverter).get();
    if (!doc.exists) return null;
    return doc.data() ?? null;
  },

  async getByDocumentId(documentId: string): Promise<Approval[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .withConverter(approvalConverter)
      .where("documentId", "==", documentId)
      .get();
    return sortBySignedAt(snapshot.docs.map((d) => d.data()), "asc");
  },

  async getByToken(verificationToken: string): Promise<Approval | null> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .withConverter(approvalConverter)
      .where("verificationToken", "==", verificationToken)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  },

  async updateStatus(id: string, status: ApprovalStatus, certificateId?: string): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (certificateId) update.certificateId = certificateId;
    update.signedAt = AdminTimestamp.now();
    await adminDb.collection(COLLECTION).doc(id).update(update);
  },

  async listAll(): Promise<Approval[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .withConverter(approvalConverter)
      .get();
    return sortBySignedAt(snapshot.docs.map((d) => d.data()), "desc");
  },

  async listByDocument(documentId: string): Promise<Approval[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .withConverter(approvalConverter)
      .where("documentId", "==", documentId)
      .get();
    return sortBySignedAt(snapshot.docs.map((d) => d.data()), "desc");
  },

  async deleteByDocumentId(documentId: string): Promise<void> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("documentId", "==", documentId)
      .get();
    if (snapshot.empty) return;
    const batch = adminDb.batch();
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  },
};
