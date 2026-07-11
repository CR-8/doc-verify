import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import { Timestamp as AdminTimestamp } from "firebase-admin/firestore";
import type { Notification, NotificationType } from "@/types/notification";

const COLLECTION = "notifications";

export const notificationRepository = {
  async create(notif: Omit<Notification, "id">): Promise<Notification> {
    const ref = adminDb.collection(COLLECTION).doc();
    await ref.set({
      ...notif,
      read: false,
      createdAt: AdminTimestamp.now(),
    });
    const result = { ...notif, id: ref.id, read: false, createdAt: AdminTimestamp.now() };
    return result as any;
  },

  async listByUser(
    userId: string,
    options?: { read?: boolean; cursor?: string; limit?: number }
  ): Promise<{ items: Notification[]; nextCursor: string | null }> {
    let query: FirebaseFirestore.Query = adminDb.collection(COLLECTION)
      .where("userId", "==", userId);

    if (options?.read !== undefined) {
      query = query.where("read", "==", options.read);
    }

    query = query.orderBy("createdAt", "desc");

    if (options?.cursor) {
      const cursorDoc = await adminDb.collection(COLLECTION).doc(options.cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const limit = Math.min(options?.limit ?? 20, 100);
    query = query.limit(limit + 1);

    const snapshot = await query.get();
    const items = snapshot.docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() } as Notification));
    const nextCursor = snapshot.docs.length > limit ? items[items.length - 1]?.id ?? null : null;

    return { items, nextCursor };
  },

  async markAsRead(id: string): Promise<void> {
    await adminDb.collection(COLLECTION).doc(id).update({ read: true });
  },

  async markAllAsRead(userId: string): Promise<void> {
    const snapshot = await adminDb
      .collection(COLLECTION)
      .where("userId", "==", userId)
      .where("read", "==", false)
      .get();

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, { read: true }));
    await batch.commit();
  },
};
