export const ROLE_HIERARCHY = {
  super_admin: 100,
  admin: 80,
  approver: 60,
  viewer: 40,
  auditor: 20,
} as const;

export type RoleLevel = keyof typeof ROLE_HIERARCHY;

export function roleGte(userRole: RoleLevel, requiredRole: RoleLevel): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
