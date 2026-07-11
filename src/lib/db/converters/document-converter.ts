import { Timestamp, type FirestoreDataConverter, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { Document } from "@/types/document";

export const documentConverter: FirestoreDataConverter<Document> = {
  toFirestore(doc: Document): FirebaseFirestore.DocumentData {
    const { id, ...data } = doc;
    return { ...data, updatedAt: Timestamp.now() };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): Document {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      title: data.title || "",
      description: data.description || "",
      fileName: data.fileName || "",
      fileSizeBytes: data.fileSizeBytes || 0,
      pageCount: data.pageCount || 0,
      sha256Hash: data.sha256Hash || "",
      status: data.status || "draft",
      uploadedBy: data.uploadedBy || "",
      uploadedAt: data.uploadedAt,
      updatedAt: data.updatedAt,
      metadata: data.metadata || {},
      storagePaths: data.storagePaths || {},
      encryptedDataKey: data.encryptedDataKey || "",
      encryptionIv: data.encryptionIv || "",
      encryptionKeyVersion: data.encryptionKeyVersion || "v1",
      requiredApprovals: data.requiredApprovals || 1,
      currentApprovals: data.currentApprovals || 0,
      classification: data.classification || "unclassified",
      expiresAt: data.expiresAt || null,
      signaturePageMap: data.signaturePageMap || {},
    };
  },
};
