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
    const snapshot = await adminDb
      .collection(COLLECTION)
      .withConverter(certificateConverter)
      .where("documentId", "==", documentId)
      .orderBy("signedAt", "desc")
      .get();
    return snapshot.docs.map((d) => d.data());
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
