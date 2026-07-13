import { ROLE_HIERARCHY, roleGte, type RoleLevel } from "@/constants/roles";

export type { RoleLevel };
export { ROLE_HIERARCHY, roleGte };

/** Human-readable labels for each role, for display in the UI. */
export const ROLE_LABELS: Record<RoleLevel, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  approver: "Approver",
  viewer: "Viewer",
  auditor: "Auditor",
};

/** Short description of what each role can do, shown in role pickers. */
export const ROLE_DESCRIPTIONS: Record<RoleLevel, string> = {
  super_admin: "Full control over the platform, including role assignment.",
  admin: "Manage users, settings, and all documents.",
  approver: "Review, approve, and sign documents.",
  viewer: "Upload and view documents.",
  auditor: "Read-only access to audit logs.",
};

/** Tailwind badge classes per role, for consistent role coloring. */
export const ROLE_BADGE_CLASSES: Record<RoleLevel, string> = {
  super_admin: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  approver: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  viewer: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  auditor: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};
