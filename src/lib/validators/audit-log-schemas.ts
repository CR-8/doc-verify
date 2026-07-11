import { z } from "zod";

export const AuditLogQuerySchema = z.object({
  targetId: z.string().optional(),
  action: z.string().optional(),
  actorId: z.string().optional(),
  partition: z.string().optional(),
  severity: z.enum(["info", "warning", "error", "critical"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
