import { AppError, ErrorCodes } from "@/constants/errors";
import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import type { UserRole } from "@/types/user";
import { ROLE_HIERARCHY } from "@/constants/roles";

export async function requireRole(userId: string, requiredRole: UserRole): Promise<void> {
  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new AppError(ErrorCodes.FORBIDDEN, "User not found", 403);
  }

  const userData = userDoc.data();
  if (!userData) {
    throw new AppError(ErrorCodes.FORBIDDEN, "User not found", 403);
  }

  const userRole = userData.role as UserRole | undefined;
  if (!userRole) {
    throw new AppError(ErrorCodes.FORBIDDEN, "User has no role assigned", 403);
  }

  if (!userData.isActive) {
    throw new AppError(ErrorCodes.FORBIDDEN, "User account is deactivated", 403);
  }

  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  if (userLevel < requiredLevel) {
    throw new AppError(ErrorCodes.FORBIDDEN, "Insufficient permissions", 403);
  }
}

export async function hasDocumentAccess(
  userId: string,
  documentId: string,
  requiredAccess: "view" | "approve" | "admin"
): Promise<boolean> {
  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) return false;
  const userData = userDoc.data()!;
  const userRole = userData.role as UserRole;

  const isSuperAdmin = userRole === "super_admin";
  const isAdminRole = userRole === "admin";

  if (isSuperAdmin || isAdminRole) return true;

  if (requiredAccess === "admin") return false;

  const permissionQuery = await adminDb
    .collection("documentPermissions")
    .where("documentId", "==", documentId)
    .where("userId", "==", userId)
    .get();

  const hasPermission = !permissionQuery.empty;
  if (!hasPermission && userRole === "viewer" && requiredAccess === "view") return false;
  if (!hasPermission && userRole === "approver" && requiredAccess === "approve") return false;

  if (requiredAccess === "approve" && userRole !== "approver") return false;

  return true;
}
