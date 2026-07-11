export const siteConfig = {
  name: "doc-verify",
  description: "Document Verification & Electronic Approval Platform",
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES) || 104857600,
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  session: {
    cookieName: "__session",
    maxAge: 60 * 60 * 24, // 24 hours
  },
  mfa: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_MFA === "true",
    stepUpMinutes: 5,
  },
  storage: {
    signedUrlExpiryMs: 15 * 60 * 1000, // 15 minutes
    tempPrefix: "temp",
    documentsPrefix: "documents",
    certificatesPrefix: "certificates",
  },
  encryption: {
    keyVersion: process.env.ENCRYPTION_KEY_VERSION || "v1",
    algorithm: "aes-256-gcm",
    ivLength: 12,
    keyLength: 32,
  },
  rateLimiting: {
    disabled: process.env.RATE_LIMIT_DISABLED === "true",
  },
  auditLog: {
    retentionDays: 90,
    maxDetailsBytes: 500 * 1024, // 500KB
  },
  qrCode: {
    errorCorrectionLevel: "M" as const,
    size: 256,
    dpi: 150,
  },
} as const;
