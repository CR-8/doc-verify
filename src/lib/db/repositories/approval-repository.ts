import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import { Timestamp as AdminTimestamp } from "firebase-admin/firestore";
import { approvalConverter } from "@/lib/db/converters/approval-converter";
import type { Approval, ApprovalStatus } from "@/types/approval";

const COLLECTION = "approvals";

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
      .orderBy("signedAt", "asc")
      .get();
    return snapshot.docs.map((d) => d.data());
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
      .orderBy("signedAt", "desc")
      .get();
    return snapshot.docs.map((d) => d.data());
  },

  async listByDocument(documentId: string): Promise<Approval[]> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .withConverter(approvalConverter)
      .where("documentId", "==", documentId)
      .orderBy("signedAt", "desc")
      .get();
    return snapshot.docs.map((d) => d.data());
  },
};
