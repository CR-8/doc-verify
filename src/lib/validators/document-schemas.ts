import { z } from "zod";

export const DocumentQuerySchema = z.object({
  status: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["uploadedAt", "title", "status", "fileSizeBytes"]).default("uploadedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const DocumentUploadCompleteSchema = z.object({
  uploadId: z.string().min(1, "Upload ID is required"),
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(2000).default(""),
  metadata: z.record(z.string()).optional(),
  classification: z.string().default("unclassified"),
  requiredApprovals: z.number().int().min(1).max(100).default(1),
  expiresAt: z.string().datetime().optional(),
});

export const DownloadTypeSchema = z.object({
  type: z.enum(["original", "public", "internal"]),
});
