import { z } from "zod";

export const UserCreateSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1, "Display name is required").max(200),
  role: z.enum(["admin", "approver", "viewer", "auditor"]),
  designation: z.string().max(200).default(""),
  department: z.string().max(200).default(""),
  phone: z.string().max(20).optional(),
});

export const UserUpdateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  role: z.enum(["admin", "approver", "viewer", "auditor"]).optional(),
  designation: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().max(20).optional(),
});

export const UserQuerySchema = z.object({
  role: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
