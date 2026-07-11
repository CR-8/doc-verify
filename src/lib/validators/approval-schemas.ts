import { z } from "zod";

export const ApprovalActionSchema = z.object({
  signaturePage: z.number().int().positive().optional(),
  comment: z.string().max(1000).optional(),
});

export const ApprovalQuerySchema = z.object({
  documentId: z.string().optional(),
  status: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const SettingsUpdateSchema = z.object({
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.record(z.string()),
  ]),
  description: z.string().max(500).optional(),
});
