export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface HealthCheckResult {
  status: "healthy" | "degraded";
  timestamp: string;
  checks: {
    firestore: boolean;
    storage: boolean;
    auth: boolean;
  };
}

export interface UploadUrlResponse {
  uploadUrl: string;
  uploadId: string;
}

export interface DocumentUploadComplete {
  documentId: string;
  status: string;
  sha256Hash: string;
}

export interface ApprovalResponse {
  approvalId: string;
  signatureId: string;
  certificateId: string;
}

export interface VerificationResult {
  valid: boolean;
  status: string;
  sha256Hash: string;
  metadata: Record<string, string>;
  pageCount: number;
  expiresAt: string | null;
}

export interface SignatureVerificationResult {
  valid: boolean;
  signer: string;
  signerDesignation: string;
  timestamp: string;
  certificateId: string;
  documentHash: string;
  documentId: string;
}
