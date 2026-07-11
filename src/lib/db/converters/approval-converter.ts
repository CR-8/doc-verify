import type { FirestoreDataConverter, QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { Approval } from "@/types/approval";

export const approvalConverter: FirestoreDataConverter<Approval> = {
  toFirestore(approval: Approval): FirebaseFirestore.DocumentData {
    const { id, ...data } = approval;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Approval {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      documentId: data.documentId || "",
      userId: data.userId || "",
      signatureId: data.signatureId || "",
      status: data.status || "pending",
      signedAt: data.signedAt,
      ipAddress: data.ipAddress || "",
      userAgent: data.userAgent || "",
      certificateId: data.certificateId || "",
      verificationToken: data.verificationToken || "",
      signatureHash: data.signatureHash || "",
      signaturePage: data.signaturePage || 0,
      pageSelectorType: data.pageSelectorType || "auto_append",
      metadata: data.metadata || {},
    };
  },
};
