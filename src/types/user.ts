import type { Timestamp } from "firebase/firestore";

export type UserRole = "super_admin" | "admin" | "approver" | "viewer" | "auditor";

export type PlanKey = "free" | "pro" | "super" | "ultra" | "business";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  designation: string;
  department: string;
  clearance: string;
  isActive: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  photoURL: string;
  phone: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  plan: PlanKey;
  planActivatedAt: Timestamp | null;
  planExpiresAt: Timestamp | null;
}
