import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import { Timestamp } from "firebase-admin/firestore";
import { userConverter } from "@/lib/db/converters/user-converter";
import type { User, UserRole } from "@/types/user";

const COLLECTION = "users";

export const userRepository = {
  async create(user: Omit<User, "id"> & { id: string }): Promise<User> {
    const ref = adminDb.collection(COLLECTION).doc(user.id);
    await ref.set(userConverter.toFirestore({ ...user, id: ref.id } as User));
    return { ...user, id: ref.id };
  },

  async getById(id: string): Promise<User | null> {
    const doc = await adminDb.collection(COLLECTION).doc(id).withConverter(userConverter).get();
    if (!doc.exists) return null;
    return doc.data() ?? null;
  },

  async getByEmail(email: string): Promise<User | null> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .withConverter(userConverter)
      .where("email", "==", email)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data();
  },

  async update(id: string, data: Partial<User>): Promise<void> {
    await adminDb.collection(COLLECTION).doc(id).update(data);
  },

  async list(query: {
    role?: string;
    isActive?: boolean;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: User[]; nextCursor: string | null; total: number }> {
    let baseQuery: FirebaseFirestore.Query = adminDb.collection(COLLECTION).withConverter(userConverter);

    if (query.role) {
      baseQuery = baseQuery.where("role", "==", query.role);
    }
    if (query.isActive !== undefined) {
      baseQuery = baseQuery.where("isActive", "==", query.isActive);
    }

    baseQuery = baseQuery.orderBy("createdAt", "desc");

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
};
