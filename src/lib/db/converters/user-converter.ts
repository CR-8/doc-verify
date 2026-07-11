import type { FirestoreDataConverter, QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { User } from "@/types/user";

export const userConverter: FirestoreDataConverter<User> = {
  toFirestore(user: User): FirebaseFirestore.DocumentData {
    const { id, ...data } = user;
    return data;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): User {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      email: data.email || "",
      displayName: data.displayName || "",
      role: data.role || "viewer",
      designation: data.designation || "",
      department: data.department || "",
      clearance: data.clearance || "unclassified",
      isActive: data.isActive ?? true,
      emailVerified: data.emailVerified ?? false,
      mfaEnabled: data.mfaEnabled ?? false,
      photoURL: data.photoURL || "",
      phone: data.phone || "",
      createdAt: data.createdAt,
      lastLoginAt: data.lastLoginAt,
    };
  },
};
