import { z } from "zod";

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const IdParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export const DocumentIdParamSchema = z.object({
  documentId: z.string().min(1, "Document ID is required"),
});

export const VerificationTokenParamSchema = z.object({
  verificationToken: z.string().length(64, "Invalid verification token"),
});

export const CertificateIdParamSchema = z.object({
  certificateId: z.string().min(1, "Certificate ID is required"),
});
