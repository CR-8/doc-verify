import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import { certificateConverter } from "@/lib/db/converters/certificate-converter";
import type { Certificate } from "@/types/certificate";

const COLLECTION = "certificates";

export const certificateRepository = {
  async create(cert: Omit<Certificate, "id">): Promise<Certificate> {
    const ref = adminDb.collection(COLLECTION).doc();
    const data = certificateConverter.toFirestore({ ...cert, id: ref.id } as Certificate);
    await ref.set(data);
    return { ...cert, id: ref.id };
  },

  async getById(id: string): Promise<Certificate | null> {
    const doc = await adminDb.collection(COLLECTION).doc(id).withConverter(certificateConverter).get();
    if (!doc.exists) return null;
    return doc.data() ?? null;
  },

  async update(id: string, data: Partial<Omit<Certificate, "id">>): Promise<void> {
    await adminDb.collection(COLLECTION).doc(id).update(data);
  },

  async getByDocumentId(documentId: string): Promise<Certificate[]> {
    // Filter by documentId only (no composite index needed) and sort in memory
    // so certificates without a signedAt value are not silently dropped.
    const snapshot = await adminDb
      .collection(COLLECTION)
      .withConverter(certificateConverter)
      .where("documentId", "==", documentId)
      .get();
    return snapshot.docs.map((d) => d.data()).sort((a, b) => {
      const am = (a as { signedAt?: { toMillis?: () => number } }).signedAt;
      const bm = (b as { signedAt?: { toMillis?: () => number } }).signedAt;
      const av = am && typeof am.toMillis === "function" ? am.toMillis() : null;
      const bv = bm && typeof bm.toMillis === "function" ? bm.toMillis() : null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
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

  async getByToken(verificationToken: string): Promise<Certificate | null> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .withConverter(certificateConverter)
      .where("verificationToken", "==", verificationToken)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  },
};
