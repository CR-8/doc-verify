import { userRepository } from "@/lib/db/repositories/user-repository";

/**
 * Shared server-side helpers for turning raw Firestore domain records into the
 * enriched DTOs the UI actually consumes. Firestore stores foreign keys (user
 * IDs, document IDs) and `Timestamp` objects; pages expect display names and
 * ISO date strings. Centralising the mapping here keeps every route consistent
 * and avoids N+1 lookups by batch-resolving user names.
 */

type TimestampLike = { toDate?: () => Date; toMillis?: () => number } | Date | string | null | undefined;

/** Converts a Firestore Timestamp (or Date / ISO string) into an ISO string. */
export function toIso(value: TimestampLike): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Batch-resolves a set of user IDs to their display names in a single pass,
 * de-duplicating IDs first. Unknown users fall back to a shortened UID so the
 * UI never renders a blank cell.
 */
export async function resolveUserNames(userIds: Array<string | undefined | null>): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  const entries = await Promise.all(
    unique.map(async (id) => {
      const user = await userRepository.getById(id).catch(() => null);
      const name = user?.displayName || user?.email || `User ${id.slice(0, 6)}`;
      return [id, name] as const;
    })
  );
  return new Map(entries);
}

/** Resolves a single user ID to a display name, with the same fallback rules. */
export async function resolveUserName(userId: string | undefined | null): Promise<string> {
  if (!userId) return "Unknown";
  const map = await resolveUserNames([userId]);
  return map.get(userId) ?? `User ${userId.slice(0, 6)}`;
}
