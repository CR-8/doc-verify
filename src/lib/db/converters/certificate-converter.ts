import type { FirestoreDataConverter, QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { Certificate } from "@/types/certificate";

export const certificateConverter: FirestoreDataConverter<Certificate> = {
  toFirestore(cert: Certificate): FirebaseFirestore.DocumentData {
    const { id, ...data } = cert;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Certificate {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      documentId: data.documentId || "",
      approvalId: data.approvalId || "",
      signatureId: data.signatureId || "",
      signerId: data.signerId || "",
      signerName: data.signerName || "",
      signerDesignation: data.signerDesignation || "",
      documentTitle: data.documentTitle || "",
      documentHash: data.documentHash || "",
      signedAt: data.signedAt,
      verificationToken: data.verificationToken || "",
      certificateHash: data.certificateHash || "",
      expiresAt: data.expiresAt || null,
    };
  },
};
