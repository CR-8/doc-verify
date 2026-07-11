# MASTER_SPEC.md — doc-verify

## Document Verification & Electronic Approval Platform

---

## 1. Architecture Overview

### 1.1 System Architecture

Monolithic Next.js application with App Router, deployed on Vercel. Server-first architecture minimizes client state. Backend logic resides in Next.js Route Handlers and Server Actions. Firebase services (Auth, Firestore, Storage) provide the BaaS layer. PDF processing and QR generation occur server-side via `pdf-lib` and `qrcode`.

### 1.2 Architectural Decisions

| Decision | Choice | Justification |
|----------|--------|---------------|
| Framework | Next.js App Router | Unified frontend/backend, server components, Vercel-native |
| Database | Cloud Firestore | Serverless, realtime, scales to zero, fits gov deployment |
| Auth | Firebase Auth (abstracted) | Replaceable auth via adapter pattern |
| Storage | Firebase Storage | Direct integration with Firestore, signed URL security |
| PDF Processing | pdf-lib | Pure JS, no native deps, serverless-compatible |
| QR Generation | qrcode | Pure JS, lightweight, server-safe |
| State | Server-first | Minimizes client JS, improves security, SEO-friendly |
| Deployment | Vercel | Preview deploys, edge functions, serverless |

### 1.3 Three-Artifact Storage Model

Every uploaded document produces three stored artifacts:

1. **Original PDF** — Bitwise-identical to upload. Never modified. Stored encrypted at rest.
2. **Public PDF** — Each page has a Document Verification QR. For public distribution. No signature data.
3. **Internal Verification PDF** — Document QR + Signature QR beside every authenticated signature. Never publicly distributed.

---

## 2. Requirements

### 2.1 Functional Requirements

- FR-001: Users upload PDF documents (1–1000+ pages)
- FR-002: System generates SHA-256 hash of original document
- FR-003: System generates Public PDF with Document QR on every page
- FR-004: System generates Internal Verification PDF with Document QR + Signature QRs
- FR-005: Authenticated users can approve and sign documents
- FR-006: Each approval generates a unique certificate
- FR-007: QR codes link to verification portal
- FR-008: Public verification via QR scan (no auth required)
- FR-009: Internal dashboard with role-based access
- FR-010: Audit logging for all document and approval events
- FR-011: Download original, public, and internal PDFs (authorization-gated)
- FR-012: Certificate download and online viewing
- FR-013: Realtime updates for authenticated internal users (upload/approval status)
- FR-014: Role-based access control (Admin, Approver, Viewer)

### 2.2 Non-Functional Requirements

- NFR-001: Handle documents up to 1000+ pages without architectural changes
- NFR-002: Response time under 2s for verification pages
- NFR-003: Zero-downtime deploys via Vercel
- NFR-004: Full audit trail immutable for compliance
- NFR-005: CSRF, XSS, rate-limit, secure headers enforced
- NFR-006: AES-256-GCM encryption for original PDF storage
- NFR-007: All API inputs validated via Zod
- NFR-008: All authentication abstracted behind provider interface

---

## 3. Database Schema (Firestore)

### 3.1 Collections

#### `documents/{documentId}`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated document ID |
| title | string | Document title |
| description | string | Optional description |
| fileName | string | Original filename |
| fileSizeBytes | number | Original file size |
| pageCount | number | Total pages |
| sha256Hash | string | SHA-256 of original PDF |
| status | enum | draft, pending_approval, approved, rejected, archived |
| uploadedBy | string | User ID of uploader |
| uploadedAt | timestamp | Upload timestamp |
| updatedAt | timestamp | Last modification timestamp |
| metadata | map | Key-value metadata (extensible) |
| storagePaths | map | { original, public, internal } — storage paths |
| encryptionKeyId | string | KMS key identifier for original PDF |
| requiredApprovals | number | Minimum approvals needed |
| currentApprovals | number | Current approval count |
| expiresAt | timestamp | Optional document expiry |

#### `users/{userId}`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Firebase UID |
| email | string | User email |
| displayName | string | Display name |
| role | enum | admin, approver, viewer |
| designation | string | Job title/designation |
| department | string | Department |
| isActive | boolean | Account active status |
| createdAt | timestamp | Account creation |
| lastLoginAt | timestamp | Last login |
| phone | string | Optional phone |

#### `approvals/{approvalId}`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated approval ID |
| documentId | string | Reference to document |
| userId | string | Approver user ID |
| signatureId | string | Unique signature identifier |
| status | enum | pending, signed, rejected |
| signedAt | timestamp | Timestamp of approval |
| ipAddress | string | IP at time of signing (hashed) |
| userAgent | string | User agent at signing |
| certificateId | string | Reference to generated certificate |
| verificationToken | string | Unique token for signature verification |
| metadata | map | Additional signer context |
| signatureHash | string | SHA-256 of approval event payload |

#### `certificates/{certificateId}`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated certificate ID |
| documentId | string | Reference to document |
| approvalId | string | Reference to approval |
| signatureId | string | Unique signature identifier |
| signerId | string | User ID of signer |
| signerName | string | Display name at time of signing |
| signerDesignation | string | Designation at time of signing |
| documentTitle | string | Document title at time of signing |
| documentHash | string | SHA-256 of original document |
| signedAt | timestamp | Approval timestamp |
| verificationToken | string | Token for online verification |
| certificateHash | string | SHA-256 of certificate payload |
| expiresAt | timestamp | Optional certificate expiry |

#### `auditLogs/{logId}`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated log ID |
| action | string | Action performed |
| actorId | string | User ID who performed action |
| targetId | string | Affected entity ID |
| targetType | string | Entity type (document, approval, etc.) |
| details | map | Action-specific data |
| ipAddress | string | Requestor IP (hashed) |
| userAgent | string | Requestor user agent |
| timestamp | timestamp | Event time (server-side) |
| severity | enum | info, warning, error, critical |

#### `notifications/{notificationId}`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated ID |
| userId | string | Target user |
| type | enum | approval_request, approval_completed, certificate_generated, document_uploaded, system |
| title | string | Notification title |
| message | string | Notification body |
| read | boolean | Read status |
| documentId | string | Related document (optional) |
| createdAt | timestamp | Creation time |

#### `settings/{settingId}`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Setting key |
| value | SettingValue | Setting value (string | number | boolean | string[] | Record<string, string>) |
| description | string | Setting description |
| updatedBy | string | Last editor |
| updatedAt | timestamp | Last update |

#### `processingJobs/{jobId}`

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated job ID |
| documentId | string | Reference to document |
| jobType | enum | public_pdf, internal_pdf, certificate, virus_scan, encrypt |
| status | enum | queued, processing, completed, failed, cancelled |
| progress | number | 0–100 percent complete |
| errorMessage | string | Error details on failure |
| errorCode | string | Machine-readable error code |
| attempts | number | Retry count (max 3) |
| idempotencyKey | string | Idempotency key for deduplication |
| correlationId | string | Request correlation ID |
| createdAt | timestamp | Job creation time |
| updatedAt | timestamp | Last update time |
| completedAt | timestamp | Completion time |

#### `documentPermissions/{permissionId}`

| Field | Type | Description |
|-------|------|-------------|
| documentId | string | Reference to document |
| userId | string | Authorized user ID |
| role | enum | approver, viewer |
| grantedBy | string | Admin who granted access |
| grantedAt | timestamp | Grant timestamp |
| expiresAt | timestamp | Optional expiry for temporary access |

#### `approvalChains/{chainId}`

| Field | Type | Description |
|-------|------|-------------|
| documentId | string | Reference to document |
| steps | array | Ordered list of { order, userId, type: sequential | parallel } |
| requiredCount | number | Required approvals for parallel steps |
| createdAt | timestamp | Creation timestamp |
| updatedAt | timestamp | Last update timestamp |

### 3.2 Composite Indexes

| Collection | Fields | Purpose |
|------------|--------|---------|
| documents | status, uploadedAt DESC | Dashboard document listing |
| documents | uploadedBy, uploadedAt DESC | User document listing |
| approvals | documentId, signedAt DESC | Document approval timeline |
| approvals | userId, signedAt DESC | User approval history |
| approvals | status, signedAt ASC | Pending approval queue |
| auditLogs | targetId, timestamp DESC | Entity audit trail |
| auditLogs | actorId, timestamp DESC | User activity trail |
| auditLogs | action, timestamp DESC | Action-based search |
| notifications | userId, read, createdAt DESC | User notification feed |
| certificates | documentId, signedAt DESC | Document certificates |
| processingJobs | status, createdAt ASC | Job processing queue |
| processingJobs | documentId, createdAt DESC | Document job history |
| auditLogs | partition, timestamp DESC | Partition-based audit queries |
| documentPermissions | documentId, userId | Document access lookup |
| approvalChains | documentId | Approval chain lookup |

### 3.3 Audit Log Archival Strategy

- Audit logs use a `partition` field with value `YYYY-MM` (e.g., `2026-07`).
- Composite index on `(partition, timestamp)` for efficient monthly queries.
- **Hot storage**: Primary Firestore retains 90 days of logs.
- **Cold storage**: Logs older than 90 days exported monthly to BigQuery (for compliance queries) and Google Cloud Storage (JSON Lines archive).
- **Archival cron**: `scripts/archive-audit-logs.ts` runs on the 1st of each month via scheduled GitHub Action or Cloud Scheduler.
- **Zod size limit**: `details` field capped at 500KB per entry. Entries exceeding this are truncated with a warning flag.
- **Immutable**: No update or delete operations on audit logs (enforced in Firestore security rules).

### 3.5 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() { return request.auth != null; }
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function isAdmin() { return isAuthenticated() && getUserRole() == 'admin'; }
    function isApprover() { return isAuthenticated() && getUserRole() in ['admin', 'approver']; }
    function isAuditor() { return isAuthenticated() && getUserRole() in ['admin', 'auditor']; }

    match /documents/{docId} {
      allow read: if isAuthenticated();
      allow create: if isApprover();
      allow update: if isAdmin() || (isApprover() && resource.data.uploadedBy == request.auth.uid);
      allow delete: if isAdmin();
    }

    match /approvals/{approvalId} {
      allow read: if isAuthenticated();
      allow create: if isApprover();
      allow update: if isAdmin();
      allow delete: if false;
    }

    match /certificates/{certId} {
      allow read: if true; // Public verification
      allow write: if isAdmin();
    }

    match /auditLogs/{logId} {
      allow create: if isAuthenticated();
      allow read: if isAdmin() || request.auth.uid == resource.data.actorId;
      allow update: if false; // Immutable
      allow delete: if false; // Immutable
    }

    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || request.auth.uid == userId;
    }

    match /processingJobs/{jobId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    match /notifications/{notifId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow write: if isAuthenticated();
    }

    match /settings/{settingId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    match /documentPermissions/{permissionId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    match /approvalChains/{chainId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Storage file access gated through backend only
    match /{path=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 4. Authentication & Authorization

### 4.1 Auth Provider Abstraction

```typescript
interface AuthProvider {
  verifyToken(token: string): Promise<AuthUser>;
  getUser(uid: string): Promise<AuthUser | null>;
  createUser(email: string, password: string, displayName: string): Promise<AuthUser>;
  updateUser(uid: string, data: Partial<AuthUser>): Promise<void>;
  deleteUser(uid: string): Promise<void>;
}

interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  createdAt: Date;
}
```

Default implementation: FirebaseAuthProvider. Swappable via dependency injection.

### 4.2 RBAC Model

| Role | Permissions |
|------|-------------|
| super_admin | Full system access: manage users, roles, settings, all documents, audit logs, system configuration |
| admin | Upload documents, approve/reject documents, manage users, view all documents, manage settings, view audit logs |
| approver | Upload documents, approve/reject assigned documents, view assigned documents, download certificates |
| viewer | View documents assigned to them, verify documents, download public PDFs |
| auditor | Read-only access to all audit logs, documents, certificates (no mutations) |

Authorization enforced at:
- Route level (middleware)
- API level (Route Handler guard)
- Component level (conditional rendering via server components)

### 4.3 Document-Level Permissions

Beyond role-based access, documents support explicit user-level permissions stored in `documentPermissions/{permissionId}`:

- Documents can be assigned to specific users with `approver` or `viewer` role
- Temporary access via `expiresAt` field (automatically enforced in queries)
- Document-level permissions override role-based access for non-admin users
- Permission grants are audit-logged

### 4.4 Approval Chain Model

Documents can define an approval chain stored in `approvalChains/{chainId}`:

```typescript
interface IApprovalChain {
  documentId: string;
  steps: {
    order: number;
    userIds: string[];
    type: 'sequential' | 'parallel';
    requiredCount: number; // For parallel steps
  }[];
}
```

- Sequential: step N+1 can only be approved after step N is complete
- Parallel: any `requiredCount` of `userIds` in the step must approve
- Documents without explicit chain: any approver can approve (legacy mode)
- Chain is enforced during `POST /api/documents/{id}/approve`

### 4.6 Multi-Factor Authentication (MFA)

- Firebase Authentication MFA enabled (TOTP support)
- Configurable via `settings/security.requireMfa` — global toggle
- **Step-up authentication**: Approval action requires fresh MFA verification within the last 5 minutes
- `mfaVerifiedAt` timestamp stored in session; if absent or expired (>5min), user must re-verify before approval
- AuthProvider interface extended:
  ```typescript
  interface AuthProvider {
    // ... existing methods
    isMfaEnabled(userId: string): Promise<boolean>;
    requireMfaChallenge(userId: string): Promise<{ sessionInfo: string }>;
    verifyMfaChallenge(userId: string, sessionInfo: string, code: string): Promise<boolean>;
  }
  ```
- Non-MFA users cannot perform approval actions when MFA is globally required
- Audit log: MFA_VERIFIED on successful step-up

### 4.7 Session Management

- Firebase Auth session cookies for SSR
- `__session` cookie, httpOnly, secure, sameSite=lax
- Token refreshed on page navigation via Firebase SDK
- Middleware validates session on every protected route
- MFA step-up state stored in session (`mfaVerifiedAt`)

---

## 5. Storage Design (Firebase Storage)

### 5.1 Storage Path Convention

```
/documents/{documentId}/original.pdf
/documents/{documentId}/public.pdf
/documents/{documentId}/internal.pdf
/certificates/{certificateId}.pdf
/temp/{uploadId}/original.pdf
```

### 5.2 Security

- No public read access on storage bucket
- All reads go through backend signed URLs (max 15min expiry)
- Upload verified server-side before finalizing
- Original PDF encrypted with AES-256-GCM before storage
- Temp uploads auto-deleted after 24h (via Cloud Function or cleanup cron)

### 5.3 File Validation

- MIME type: `application/pdf`
- Max size: 100MB (configurable via `settings/upload.maxFileSize`)
- Signature bytes: PDF header validation (`%PDF-` magic bytes check)
- Content scanning: abstraction for ClamAV integration via `lib/virus-scanner/scanner.ts`
- Virus scan result stored in document metadata before finalization
- **Body size configuration**: Upload route handler disables Next.js body parser in favor of Firebase Storage direct upload via signed URL. Client uploads directly to `/temp/{uploadId}/original.pdf`. Backend verifies after upload completes.

### 5.4 Upload Flow (Revised)

Direct-to-Storage upload eliminates serverless body size limits:

1. Client requests signed upload URL from `POST /api/documents/upload-url`
2. Client uploads directly to Firebase Storage using signed URL (no size limit)
3. Client calls `POST /api/documents/complete` with the upload ID
4. Backend verifies file (MIME, size, magic bytes, virus scan)
5. Backend proceeds with PDF generation via async processing queue

---

## 6. Workflows

### 6.0 Signature Placement Strategy

The system must decide WHERE signature representations appear in the Internal Verification PDF. Strategy evaluated in order:

**Strategy 1: AcroForm Detection (Primary)**

Parse the PDF for existing AcroForm signature fields using `pdf-lib` form API. If signature fields exist:
- Place signature visualization at field coordinates
- Overlay Signature QR beside the signature field
- Preserve all existing form field data
- Supported PDFs: government forms, standardized templates

**Strategy 2: Geometric Layout Analysis (Secondary)**

If no AcroForm signature fields found, analyze page layout:
- Scan each page for signature indicators: `___` underscore lines, "Signature:" / "Signed by" text patterns, "Date:" field patterns
- Locate candidate whitespace regions in lower 25% of page (bottom margin approach)
- Place signature in largest suitable whitespace region on the last page with signature indicators
- Implementation via text extraction + coordinate analysis

**Strategy 3: Signature Page Append (Default Tertiary)**

If no suitable location found on any existing page:
- Append one new page per signature at document end
- Page contains: signer name, designation, timestamp, Signature QR, visual representation
- Deterministic and reliable for all documents
- Page appended before generating Document QR on appended page

**Strategy 4: Manual Override (User Control)**

- Approver selects page number during approval workflow
- Admin can pre-configure signature placement in document metadata (`signaturePageMap: { userId: number[] }`)
- Document type templates can define default signature pages
- Override stored in approval document

**Decision Tree:**
```
AcroForm fields exist? → YES → Place at field coordinates
NO → Layout has signature indicators? → YES → Place near closest indicator
NO → User specified page? → YES → Place on specified page
NO → Default → Append signature page at document end
```

### 6.1 Document Upload (Async Saga)

```
1. User selects PDF → client-side validation (size, type)
2. Client requests signed upload URL from POST /api/documents/upload-url
3. Client uploads directly to /temp/{uploadId}/original.pdf via signed URL
4. Client calls POST /api/documents/complete with uploadId
5. Backend creates processingJob (type: 'virus_scan') in Firestore
6. Backend verifies file: MIME, magic bytes, size, virus scan
   → Failure: delete temp file, mark job failed, return error
7. Backend computes SHA-256 hash of uploaded buffer
8. Backend creates document record (status: "processing")
9. Backend encrypts original with AES-256-GCM
10. Backend stores encrypted original to /documents/{docId}/original.pdf
    → Failure: delete firestore doc, clean temp, return error (Saga compensate)
11. Backend creates processingJob (type: 'public_pdf') with correlationId
12. Processing job generates Public PDF (Document QR on every page)
    → Uses QStash or Cloud Run (async, handles 1000+ pages)
    → Updates job progress every 50 pages via Firestore
13. Backend creates processingJob (type: 'internal_pdf')
14. Processing job generates Internal Verification PDF (Document QR only, no signatures)
15. Backend updates document status to "pending_approval"
16. Backend triggers notification to assigned approvers
17. Audit log: DOCUMENT_UPLOADED
18. Realtime event (Firestore listener): document status update
19. Saga completes: document is fully processed and ready for approval
```

**Saga Compensation**: If any step fails, all prior steps are reversed:
- Storage upload: delete uploaded file
- Firestore doc: delete document record
- PDF generation: delete generated PDFs
- All compensating actions are idempotent and logged

### 6.2 Approval Workflow (Async Saga)

```
1. Approver receives notification (in-app + optional email)
2. Approver logs in → MFA step-up verification (if required)
3. Approver reviews document content
4. Approver optionally selects signature placement page (manual override)
5. Approver clicks "Approve & Sign"
6. Backend validates MFA session (mfaVerifiedAt within 5 min)
7. Backend validates approval chain:
   a. If sequential chain: check previous step is approved
   b. If parallel chain: check requiredCount not exceeded
   c. If legacy mode: check user is approver
8. Backend creates approval record in Firestore transaction:
   a. Generate unique signatureId (uuid v4)
   b. Record signer identity, timestamp, IP, user agent
   c. Create verificationToken (crypto.randomBytes(32).toString('hex'))
   d. Determine signature placement page (see 6.0)
   e. Compute signatureHash = SHA-256(JSON.stringify({documentHash, userId, timestamp, verificationToken}))
   f. Create approval document
   g. Increment document.currentApprovals via transaction
   h. Document reaches requiredApprovals → status = "approved"
9. Backend creates processingJob (type: 'internal_pdf') with correlationId
10. Processing job regenerates Internal Verification PDF:
    a. Load original PDF buffer
    b. Embed Document QR on every page (same QR, cached)
    c. Determine signature placement via hybrid strategy (section 6.0)
    d. Place signature visualization: signer name, designation, timestamp
    e. Embed Signature QR beside signature (from {baseUrl}/sign/{verificationToken})
    f. Upload updated internal PDF to /documents/{docId}/internal.pdf
11. Backend creates processingJob (type: 'certificate')
12. Processing job generates certificate PDF
13. Backend updates certificate record in Firestore
14. Audit log: DOCUMENT_APPROVED
15. Notification: certificate available, document status update
16. Realtime event (Firestore listener): approval status update
```

**Saga Compensation**: If signature page generation fails → revert approval record, decrement counter, notify admin with error context.

### 6.3 Document Verification (Public)

```
1. User scans Document QR on any page
2. Opens {baseUrl}/verify/{documentId} (no auth required)
3. Page fetches document metadata (public fields only)
4. Displays: status, hash, metadata, public PDF viewer
5. Cache-Control: public, max-age=3600 on public data
6. If user authenticates and is authorized: internal PDF option
7. Audit log: DOCUMENT_VERIFIED
```

### 6.4 Document Expiry Enforcement

```
1. Daily cron job (scripts/enforce-expiry.ts) runs via GitHub Actions / Cloud Scheduler
2. Queries documents where expiresAt < Timestamp.now() AND status != 'archived'
3. For each expired document:
   a. Update status to "archived"
   b. Create audit log: DOCUMENT_EXPIRED
   c. Trigger notification to document owner and assigned approvers
4. Verification pages for archived documents:
   - Show banner: "This document has expired as of {expiresAt}"
   - Document hash still verifiable (immutable audit trail)
   - Certificates remain accessible but marked as expired
   - Signature verification shows document context
5. Expired documents excluded from active document queries
```

### 6.5 Signature Verification (Public)

```
1. User scans Signature QR from Internal Verification PDF
2. Opens {baseUrl}/sign/{verificationToken} (no auth required)
3. Page fetches approval + certificate data
4. Displays: signer info, timestamp, certificate, hash, verification status
5. Audit log: SIGNATURE_VERIFIED
```

---

## 7. PDF Processing

### 7.1 Public PDF Generation

```
Input: Original PDF buffer
Process:
For each page:
  - Embed Document QR (generated from {baseUrl}/verify/{documentId})
  - Position: bottom-right corner, 1 inch × 1 inch
  - Add label: "Verify at {baseUrl}/verify/{documentId}"
Output: Public PDF (non-encrypted, publicly distributable)
```

### 7.2 Internal Verification PDF Generation

```
Input: Original PDF buffer + approvals data
Dependencies: pdf-lib, @pdf-lib/fontkit, qrcode
Process:
1. Load original PDF with pdf-lib
2. Register fontkit for font embedding (supports CJK and custom fonts)
3. Generate Document QR buffer (cached, same for all pages)
4. For each approval:
   a. Determine signature placement by hybrid strategy (section 6.0):
      - Try AcroForm detection → extract signature field coordinates
      - Try geometric layout analysis → find signature indicators
      - Use manual override if specified
      - Fallback: append new signature page
   b. Generate Signature QR buffer (unique per approval)
   c. Embed signature visualization: signer name, designation, timestamp
   d. Embed Signature QR beside signature
   e. Record placement coordinates in approval metadata for audit
5. For each page of original content:
   - Embed Document QR at bottom-right (1 inch × 1 inch)
6. Save output PDF buffer
7. Upload to /documents/{docId}/internal.pdf
Output: Internal PDF (encrypted at rest, never public)
```

**Performance optimization for 1000+ pages:**
- Document QR generated once, reused across all pages
- Pages processed in parallel batches (Promise.all concurrency limit: 5)
- Job reports progress every 50 pages via Firestore update
- Cold start mitigated by Cloud Run minInstances: 1
- Maximum job timeout: 300s (Cloud Run) / 60s (Vercel with QStash fan-out)

### 7.3 Certificate PDF Generation

```
Page layout:
  - Header: Organization logo + "Certificate of Approval"
  - Certificate ID (human-readable)
  - Document title and ID
  - Signer name and designation
  - Date and timestamp of signing
  - Document SHA-256 hash (hex)
  - Verification token
  - QR code linking to {baseUrl}/certificate/{certificateId}
  - Footer: verification instructions
```

---

## 8. QR Code Processing

### 8.1 QR Generation

- Library: `qrcode` (server-side)
- Error correction: M (15%)
- Size: 256×256px embedded in PDF at ~150 DPI
- Content: URL with embedded verification token

### 8.2 QR URLs

| QR Type | URL Pattern | Auth Required |
|---------|-------------|---------------|
| Document QR | `{baseUrl}/verify/{documentId}` | No |
| Signature QR | `{baseUrl}/sign/{verificationToken}` | No |
| Certificate QR | `{baseUrl}/certificate/{certificateId}` | No |

Verification tokens are 64-character hex strings derived from `crypto.randomBytes(32)`.

---

## 9. Certificate Processing

### 9.1 Certificate Data

Signed data payload (used for hash):
```typescript
{
  certificateId: string;
  documentId: string;
  signatureId: string;
  signerId: string;
  signerName: string;
  signerDesignation: string;
  documentTitle: string;
  documentHash: string;
  signedAt: string; // ISO 8601
  verificationToken: string;
}
```

### 9.2 Certificate Verification

- `certificateHash = SHA-256(JSON.stringify(signedPayload))`
- Verification page recomputes hash and compares with stored hash
- Tampered data will not match

---

## 10. Verification Portal

### 10.1 Public Routes (No Auth)

| Route | Purpose |
|-------|---------|
| `/verify/{documentId}` | Document verification from Document QR |
| `/sign/{verificationToken}` | Signature verification from Signature QR |
| `/certificate/{certificateId}` | Certificate viewing |

### 10.2 Authenticated Routes

| Route | Purpose |
|-------|---------|
| `/dashboard` | Main dashboard |
| `/dashboard/documents` | Document list |
| `/dashboard/documents/{id}` | Document detail + approvals |
| `/dashboard/documents/{id}/approve` | Approval action |
| `/dashboard/approvals` | Approval queue |
| `/dashboard/users` | User management (admin) |
| `/dashboard/settings` | System settings (admin) |

---

## 11. API Design

### 11.0 Common Response Envelope

Every API response includes:
```typescript
{
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  correlationId: string; // UUID generated per request
}
```

### 11.1 Pagination Convention

List endpoints use cursor-based pagination (not offset-based):

**Request:**
- `cursor` — Last document ID from previous page (optional, for pagination)
- `limit` — Page size (default 20, max 100)

**Response:**
- `data.items` — Array of results
- `data.nextCursor` — Cursor for next page (null if last page)
- `data.total` — Total count (approximate for large collections)

### 11.2 Route Handlers

#### `GET /api/health`

- Auth: None
- Response: `{ status: 'healthy', timestamp, checks: { firestore: boolean, storage: boolean, auth: boolean } }`
- Performs: lightweight Firebase connectivity check (Firestore ping, Storage bucket existence, Auth SDK init)

#### `POST /api/documents/upload`

- Auth: Required
- Role: admin, approver
- Body: FormData with PDF file
- Response: `{ documentId, status, sha256Hash }`
- Validates: file type, size, virus scan status

#### `GET /api/documents`

- Auth: Required
- Role: admin, approver, viewer
- Query: `status`, `limit`, `offset`, `sortBy`, `sortOrder`
- Response: `{ documents: [], total, limit, offset }`

#### `GET /api/documents/{id}`

- Auth: Optional (public fields), Required (full)
- Response: Document metadata + storage URLs

#### `GET /api/documents/{id}/download/{type}`

- Auth: Required
- Type: `original`, `public`, `internal`
- Role: admin (all), approver (assigned), viewer (public only)
- Response: Signed download URL (15min expiry)

#### `POST /api/documents/{id}/approve`

- Auth: Required
- Role: admin, approver
- Body: `{}` (approval action)
- Response: `{ approvalId, signatureId, certificateId }`

#### `GET /api/approvals`

- Auth: Required
- Role: admin, approver, viewer
- Query: `documentId`, `status`, `limit`, `offset`
- Response: `{ approvals: [], total }`

#### `GET /api/certificates/{id}`

- Auth: Optional
- Response: Certificate data (public fields)

#### `GET /api/certificates/{id}/download`

- Auth: Required
- Role: admin, approver
- Response: Certificate PDF download

#### `GET /api/verify/{documentId}`

- Auth: Optional (public)
- Response: { status, sha256Hash, metadata, pageCount }

#### `GET /api/verify/signature/{verificationToken}`

- Auth: Optional (public)
- Response: { valid, signer, timestamp, certificateId, documentHash }

#### `GET /api/users`

- Auth: Required
- Role: admin
- Response: User list

#### `POST /api/users`

- Auth: Required
- Role: admin
- Body: { email, password, displayName, role, designation }
- Validates: email format, password strength, role validity

#### `PATCH /api/users/{id}`

- Auth: Required
- Role: admin
- Body: Partial user update

#### `GET /api/settings`

- Auth: Required
- Role: admin
- Response: Settings object

#### `PATCH /api/settings`

- Auth: Required
- Role: admin
- Body: Partial settings update

#### `GET /api/audit-logs`

- Auth: Required
- Role: admin
- Query: `targetId`, `action`, `actorId`, `limit`, `offset`
- Response: { logs: [], total }

### 11.2 WebSocket / Realtime

SSE (Server-Sent Events) via `GET /api/realtime` or Firebase Realtime listeners on client side.

For Vercel compatibility: use Firebase `onSnapshot` listeners server-side and push via Vercel Edge Functions or direct Firestore client subscriptions on authenticated dashboard pages.

Decision: Use Firestore Realtime listeners directly from client for authenticated internal pages. Public pages use standard fetch.

---

## 12. Security Architecture

### 12.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Unauthorized document access | RBAC + document-level permissions + signed URLs + backend auth gate |
| Unauthorized approval | MFA step-up + approval chain enforcement + session validation |
| Tampered uploaded documents | SHA-256 hash verification at upload and verification time |
| Tampered certificates | Certificate hash + verification token + payload signing |
| QR code forgery | Verification tokens (64-char random hex, crypto.randomBytes(32)) |
| Session hijacking | httpOnly secure cookies, short expiry, MFA step-up for mutations |
| CSRF | Next.js built-in CSRF protection + origin + referer header check |
| XSS | Input sanitization, CSP headers, no dangerouslySetInnerHTML |
| Uploaded malware | File validation + MIME check + magic bytes + ClamAV integration |
| Brute force | Rate limiting on auth, verification, and approval endpoints |
| Data interception | TLS everywhere, HSTS preload |
| Insider threat | Audit logging, separation of duties, document-level permissions |
| Storage compromise | AES-256-GCM encryption of original PDFs + KMS key management |
| Key compromise | Per-document keys + KMS key rotation + IV management |
| Orphaned resources | Saga pattern with compensating transactions |
| Idempotency violation | Idempotency keys on all mutation endpoints |
| Denial of service | Rate limiting + Vercel DDoS protection + function concurrency limits |
| Verification token leakage | Tokens single-use for writes, read-only for verification |
| Privilege escalation | Role hierarchy enforced at middleware + API + security rules |

### 12.2 Encryption Strategy

#### Key Management Service Interface

```typescript
interface IKeyManagementService {
  /** Generate a new data encryption key. Returns plaintext (for use) and ciphertext (for storage). */
  generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: Buffer }>;
  /** Decrypt a data key for use. */
  decryptDataKey(ciphertextDataKey: Buffer): Promise<Buffer>;
  /** Encrypt a data key for storage. */
  encryptDataKey(plaintextDataKey: Buffer): Promise<Buffer>;
  /** Current key version identifier. */
  getKeyVersion(): Promise<string>;
}
```

**Default Implementation (LocalKms — dev/staging):**
- Master key from `ENCRYPTION_MASTER_KEY` env var (64 hex chars = 32 bytes)
- HKDF-SHA256 for key derivation
- Per-document data key: 32 bytes from `crypto.randomBytes(32)`
- Data key encrypted with master key via AES-256-GCM, stored in `document.encryptedDataKey`

**Production Implementation (Google Cloud KMS):**
- Master key stored in Cloud KMS with automatic rotation (90-day rotation policy)
- Per-document data key generated via KMS `generateRandomBytes`
- Data key encrypted with Cloud KMS key, stored in `document.encryptedDataKey`
- Cloud KMS IAM controls access to key material
- Audit logging on every KMS operation

#### Encryption Operations

| Artifact | Encryption | Key | Purpose |
|----------|-----------|-----|---------|
| Original PDF | AES-256-GCM | Per-document data key | Confidentiality at rest |
| Public PDF | None (cleartext) | N/A | Public distribution |
| Internal PDF | Server-side (Firebase Storage default) | Google-managed key | Restricted distribution |
| Audit logs | Server-side (Firebase Storage default) | Google-managed key | Integrity |

#### IV Management

- AES-256-GCM uses a random 96-bit (12-byte) IV per encryption operation
- IV generated via `crypto.randomBytes(12)` for every encrypt call
- IV stored alongside ciphertext: prepended as first 12 bytes of the stored blob
- Maximum encryptions per key before IV collision risk: 2^32
- Alert generated via monitoring at 2^28 encryptions (~268M)

#### Key Rotation

- Per-document data keys are single-use (generated per document)
- Master key rotation supported via `KEY_VERSION` env var
- Rotation script: `scripts/re-encrypt-documents.ts`
  - Reads all documents with old key version
  - Decrypts data key, re-encrypts with new master key
  - Updates `document.encryptionKeyVersion`
- Annual key rotation as standard practice, quarterly for classified documents

### 12.3 Security Headers

```typescript
{
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
}
```

---

## 13. Rate Limiting

### 13.1 Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/documents/upload-url | 10 requests | 1 minute |
| /api/documents/complete | 10 requests | 1 minute |
| /api/documents/{id}/approve | 5 requests | 1 minute |
| /api/documents/{id}/download/* | 30 requests | 1 minute |
| /api/verify/* | 60 requests | 1 minute |
| /api/auth/* | 20 requests | 1 minute |
| /api/certificates/{id}/download | 20 requests | 1 minute |
| /api/users (create) | 5 requests | 1 minute |
| /api/settings (write) | 10 requests | 1 minute |
| /api/audit-logs | 30 requests | 1 minute |

### 13.2 Implementation

In-memory rate limiter for Vercel serverless (per-instance). For production multi-instance, use Upstash Redis or similar.

---

## 14. Validation

### 14.1 Zod Schemas

Every API endpoint validates input with a Zod schema. Shared schemas in `src/lib/validators/`.

Key schemas:
- `DocumentUploadSchema` - file validation
- `ApprovalSchema` - approval action
- `UserCreateSchema` - user creation
- `UserUpdateSchema` - user update
- `SettingsUpdateSchema` - settings
- `DocumentQuerySchema` - query parameters
- `ApprovalQuerySchema` - query parameters

---

## 15. Repository Structure

```
doc-verify/
├── .github/
│   └── workflows/
│       └── ci.yml
├── public/
│   └── images/
│       ├── logo.svg
│       └── og-image.png
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── verify/
│   │   │   │   └── [documentId]/
│   │   │   │       └── page.tsx
│   │   │   ├── sign/
│   │   │   │   └── [verificationToken]/
│   │   │   │       └── page.tsx
│   │   │   ├── certificate/
│   │   │   │   └── [certificateId]/
│   │   │   │       └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── documents/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [documentId]/
│   │   │   │   │       ├── page.tsx
│   │   │   │   │       └── approve/
│   │   │   │   │           └── page.tsx
│   │   │   │   ├── approvals/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── users/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx
│   │   │   ├── verify/
│   │   │   │   └── invalid/
│   │   │   │       └── page.tsx
│   │   │   └── unauthorized/
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   ├── health/
│   │   │   │   └── route.ts
│   │   │   ├── auth/
│   │   │   │   └── route.ts
│   │   │   ├── documents/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [documentId]/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   ├── approve/
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── download/
│   │   │   │   │       └── [type]/
│   │   │   │   │           └── route.ts
│   │   │   │   └── upload/
│   │   │   │       └── route.ts
│   │   │   ├── approvals/
│   │   │   │   └── route.ts
│   │   │   ├── certificates/
│   │   │   │   ├── route.ts
│   │   │   │   └── [certificateId]/
│   │   │   │       ├── route.ts
│   │   │   │       └── download/
│   │   │   │           └── route.ts
│   │   │   ├── verify/
│   │   │   │   ├── [documentId]/
│   │   │   │   │   └── route.ts
│   │   │   │   └── signature/
│   │   │   │       └── [verificationToken]/
│   │   │   │           └── route.ts
│   │   │   ├── users/
│   │   │   │   ├── route.ts
│   │   │   │   └── [userId]/
│   │   │   │       └── route.ts
│   │   │   ├── settings/
│   │   │   │   └── route.ts
│   │   │   ├── audit-logs/
│   │   │   │   └── route.ts
│   │   │   └── notifications/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/ (shadcn)
│   │   ├── documents/
│   │   │   ├── document-card.tsx
│   │   │   ├── document-list.tsx
│   │   │   ├── document-upload.tsx
│   │   │   ├── document-viewer.tsx
│   │   │   └── document-status-badge.tsx
│   │   ├── approvals/
│   │   │   ├── approval-button.tsx
│   │   │   ├── approval-list.tsx
│   │   │   ├── approval-timeline.tsx
│   │   │   └── signature-display.tsx
│   │   ├── certificates/
│   │   │   ├── certificate-card.tsx
│   │   │   ├── certificate-detail.tsx
│   │   │   └── certificate-download.tsx
│   │   ├── verification/
│   │   │   ├── document-verification.tsx
│   │   │   ├── signature-verification.tsx
│   │   │   └── verification-badge.tsx
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── dashboard-layout.tsx
│   │   │   └── public-layout.tsx
│   │   └── shared/
│   │       ├── qr-display.tsx
│   │       ├── pdf-viewer.tsx
│   │       ├── hash-display.tsx
│   │       ├── loading-skeleton.tsx
│   │       ├── error-boundary.tsx
│   │       ├── empty-state.tsx
│   │       ├── confirmation-dialog.tsx
│   │       └── audit-log-viewer.tsx
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── provider.ts (interface)
│   │   │   ├── firebase-provider.ts
│   │   │   └── middleware.ts
│   │   ├── db/
│   │   │   ├── firebase.ts (Firebase admin + client init)
│   │   │   ├── repositories/
│   │   │   │   ├── document-repository.ts
│   │   │   │   ├── user-repository.ts
│   │   │   │   ├── approval-repository.ts
│   │   │   │   ├── certificate-repository.ts
│   │   │   │   ├── audit-log-repository.ts
│   │   │   │   └── notification-repository.ts
│   │   │   └── converters/
│   │   │       ├── document-converter.ts
│   │   │       ├── user-converter.ts
│   │   │       ├── approval-converter.ts
│   │   │       └── certificate-converter.ts
│   │   ├── storage/
│   │   │   └── storage-service.ts
│   │   ├── pdf/
│   │   │   ├── public-pdf-generator.ts
│   │   │   ├── internal-pdf-generator.ts
│   │   │   └── certificate-generator.ts
│   │   ├── qr/
│   │   │   └── qr-generator.ts
│   │   ├── crypto/
│   │   │   ├── hash.ts
│   │   │   └── encryption.ts
│   │   ├── audit/
│   │   │   └── audit-logger.ts
│   │   ├── validators/
│   │   │   ├── document-schemas.ts
│   │   │   ├── user-schemas.ts
│   │   │   ├── approval-schemas.ts
│   │   │   └── common-schemas.ts
│   │   ├── middleware/
│   │   │   ├── auth-guard.ts
│   │   │   ├── role-guard.ts
│   │   │   ├── rate-limiter.ts
│   │   │   └── csrf.ts
│   │   ├── logger/
│   │   │   └── logger.ts
│   │   ├── config.ts
│   │   └── utils.ts
│   ├── types/
│   │   ├── document.ts
│   │   ├── user.ts
│   │   ├── approval.ts
│   │   ├── certificate.ts
│   │   ├── audit-log.ts
│   │   ├── notification.ts
│   │   ├── settings.ts
│   │   └── api.ts
│   ├── constants/
│   │   ├── roles.ts
│   │   ├── status.ts
│   │   └── errors.ts
│   ├── virus-scanner/
│   │   └── scanner.ts
│   ├── jobs/
│   │   ├── processing-queue.ts
│   │   └── job-types.ts
│   └── config/
│       ├── firebase.ts
│       └── site.ts
├── scripts/
│   ├── seed.ts
│   ├── migrate.ts
│   ├── archive-audit-logs.ts
│   ├── enforce-expiry.ts
│   └── re-encrypt-documents.ts
├── tests/
│   ├── unit/
│   │   ├── lib/
│   │   │   ├── pdf/
│   │   │   ├── qr/
│   │   │   ├── crypto/
│   │   │   ├── validators/
│   │   │   └── auth/
│   │   └── components/
│   ├── integration/
│   │   ├── api/
│   │   └── workflows/
│   └── e2e/
│       └── verification.spec.ts
├── .env.local.example
├── .eslintrc.json
├── .prettierrc
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── MASTER_SPEC.md
├── CLAUDE.md
└── package.json
```

---

## 16. Naming Standards

- **Files**: kebab-case (e.g., `document-repository.ts`)
- **React Components**: PascalCase (e.g., `DocumentCard.tsx`)
- **Functions/Variables**: camelCase (e.g., `getDocumentById`)
- **Types/Interfaces**: PascalCase. Interface suffix `Interface` only when distinguishing from a concrete class (e.g., `AuthProvider` interface, `FirebaseAuthProvider` implementation). No I-prefix. (e.g., `Document`, `User`, `Approval`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)
- **Firestore Collections**: camelCase (e.g., `auditLogs`)
- **Route Handlers**: RESTful plural nouns (e.g., `/api/documents`)
- **Environment Variables**: UPPER_SNAKE_CASE prefixed with `NEXT_PUBLIC_` for client (e.g., `NEXT_PUBLIC_FIREBASE_API_KEY`)

---

## 17. Coding Standards

- TypeScript strict mode enabled
- No `any` types; prefer `unknown` when type is uncertain
- Every function has explicit return type
- Every exported function/class has JSDoc description
- Imports ordered: external → internal → types
- No circular dependencies
- Single responsibility per module
- No side effects in constructors
- Pure functions preferred
- Async/await over raw promises
- Error handling via custom `AppError` class with code, message, statusCode

---

## 18. Error Handling

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

Error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`, `FILE_TOO_LARGE`, `INVALID_FILE_TYPE`, `VIRUS_DETECTED`, `APPROVAL_PENDING`, `ALREADY_APPROVED`.

API responses follow `{ success: boolean, data?: T, error?: { code: string, message: string, details?: unknown } }`.

---

## 19. Logging

```typescript
enum LogLevel { DEBUG, INFO, WARN, ERROR }

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  userId?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}
```

Structured JSON logging. In production, log to stdout. In Vercel, logs automatically collected.

---

## 20. Performance

### 20.1 PDF Generation

- PDF generation runs asynchronously via processing jobs — never blocks the request-response cycle
- Document QR generated once per document, cached in memory for the job duration, reused across all pages
- Pages processed in parallel batches (Promise.all with concurrency limit of 5)
- Job reports progress every 50 pages via Firestore update
- Cold start mitigated by Cloud Run `minInstances: 1` (production) or Vercel cron pings
- `@pdf-lib/fontkit` registered for font embedding (CJK support)

### 20.2 Caching

- **Vercel Edge Config**: Frequently accessed verification data cached (Document status + hash, cache TTL: 1 hour)
- **ISR**: Verification pages use `revalidate: 3600` with on-demand revalidation on document status change
- **Cache-Control headers**: Public verification API responses set `Cache-Control: public, max-age=3600, stale-while-revalidate=300`
- **SWR pattern**: Client-side verification pages use stale-while-revalidate for instant loading
- **Firestore caching**: Firestore SDK client-side caching enabled for authenticated pages

### 20.3 Firestore

- Composite indexes for all sort/filter combinations
- Cursor-based pagination (no offset skips) to minimize read costs
- Query limits: default 20, max 100
- Denormalized counters for approval counts (avoid COUNT queries)

### 20.4 Delivery

- Signed URLs with 15min TTL to prevent link sharing and reduce CDN cost
- Lazy-load PDF viewers (client-side, on user interaction)
- Static generation for landing pages and public verification pages
- Image optimization via Next.js Image component
- Dynamic imports for heavy libraries (pdf-lib, qrcode) — loaded only when needed

---

## 21. Testing Strategy

- **Unit tests**: Vitest. Test all lib/ modules. Mock Firebase.
- **Integration tests**: Supertest + Vitest. Test API routes with mocked auth.
- **E2E tests**: Playwright. Test critical flows: upload → approve → verify.

---

## 22. Deployment

### 22.1 Vercel Requirements

**Plan: Pro (required for production)**

| Feature | Hobby | Pro | Required For |
|---------|-------|-----|-------------|
| Function timeout | 10s | 60s (300s with Enterprise) | PDF processing jobs |
| Serverless functions | 100GB/mo | 1000GB/mo | Document upload/processing |
| Bandwidth | 100GB | 1000GB | PDF downloads |
| Team features | No | Yes | Multi-developer workflow |
| Concurrency | Basic | 10x | Production traffic |

### 22.2 Scaling Strategy

**Phase 1: Vercel + QStash (Initial deployment)**
- PDF processing via Upstash QStash (5min timeout, 10MB payload)
- Suitable for documents up to ~300 pages
- No additional infrastructure to manage
- Cost: QStash free tier sufficient for initial deployment

**Phase 2: Vercel + Cloud Run (Documents >300 pages)**
- PDF processing workers on Cloud Run (up to 60min timeout, 32GB RAM)
- Cloud Tasks for job orchestration
- minInstances: 1 to eliminate cold starts
- Cost: ~$50-100/month for Cloud Run + Tasks

**Phase 3: Government deployment**
- Cloud Run + Cloud KMS + Cloud Scheduler
- No Vercel dependency (Next.js standalone output)
- Containerized deployment on GKE or on-premise Kubernetes
- Background workers for all PDF processing
- Dedicated Redis cache for verification data

### 22.3 Vercel Configuration

- Node.js 20+
- Function max duration: 300s (Enterprise plan for large PDF processing)
- Memory: 1024MB for PDF processing functions
- Environment variables configured in Vercel dashboard
- Preview deployments for every PR
- Production branch: `main`

### 22.4 CI/CD Pipeline

GitHub Actions:
1. Lint
2. Type check
3. Unit tests
4. Integration tests
5. Build check
6. Deploy to Vercel (on main)

### 22.5 Environment Variables

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_PROJECT_ID=
NEXT_PUBLIC_BASE_URL=
SESSION_SECRET=
ENCRYPTION_MASTER_KEY=
ENCRYPTION_KEY_VERSION=v1
RATE_LIMIT_DISABLED=false
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
QSTASH_URL=
CLOUD_RUN_TASK_HANDLER_URL=
NEXT_PUBLIC_ENABLE_MFA=false
MAX_FILE_SIZE_BYTES=104857600
```

---

## 23. Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Empty document (0 pages) | Reject with clear error |
| Very large document (1000+ pages) | Process in chunks, extended timeout |
| Concurrent approval | Firestore transaction with optimistic concurrency control; status check before write; retry on contention |
| Expired verification token | Return INVALID_TOKEN error with clear message and instructions to re-verify |
| Deleted document | Soft delete (status=archived); verification shows "This document has been archived"; hash and certificates remain verifiable |
| Network failure during upload | Direct-to-Storage upload eliminates body size limits; temp files cleaned after 24h via scheduled job |
| Invalid QR scan | Friendly 404 page with instructions; suggest checking the QR is from a valid doc-verify document |
| Browser PDF viewer incompatibility | PDF.js fallback viewer via dynamic import |
| Rate limit exceeded | 429 response with retry-after header; client should back off exponentially |
| Unverified email | Restrict approval action until email verified; resend verification option |
| Session expired mid-approval | Redirect to login with returnUrl parameter; preserve approval intent |
| Password-protected PDF | Detect encryption; return clear error: "Document is password-protected. Please remove protection before uploading." |
| PDF with AcroForms | Preserve form data during QR overlay; use pdf-lib form APIs; if not supported, warn user in audit log |
| CJK characters in document | fontkit registered for font embedding; system fonts extracted from document; fallback to standard fonts |
| Non-PDF file uploaded | MIME + magic byte check rejects before upload; clear error message |
| Storage quota exceeded | Return STORAGE_QUOTA_EXCEEDED error; document marked as failed; admin notified |
| Concurrent signature on same page | First approval places signature; subsequent approvals appended to next available location; conflict logged |
| Approval after document archived | Return DOCUMENT_ARCHIVED error; no mutations allowed on archived documents |
| Processing job fails mid-way | Job status = failed; error details stored; admin dashboard shows failed jobs; retry button available |
| Encryption key version mismatch | Re-encryption script migrates documents; verification falls back to old key if available |
| Firestore write limit exceeded | Exponential backoff with jitter (max 5 retries); alert if persistent |
| Vercel function cold start | Cloud Run minInstances: 1 for PDF processing; cron-based warm-up pings for Vercel functions |
| User deactivated mid-session | Session validated on every API call; deactivated user receives 403 with account status message |
| Document with 0 pages | Rejected at upload stage after server-side page count validation |
| Document with >100MB | Rejected with FILE_TOO_LARGE error; configurable via settings |

---

## 24. Acceptance Criteria

- AC-001: User uploads PDF → system generates all three artifact PDFs
- AC-002: Public PDF displays Document QR on every page
- AC-003: Scanning Document QR opens verification page with document metadata
- AC-004: Authorized user approves document → approval recorded in Firestore
- AC-005: Internal PDF updated with Signature QR beside signature
- AC-006: Certificate generated and downloadable
- AC-007: Scanning Signature QR opens signature verification page
- AC-008: Unauthorized user cannot access admin functions
- AC-009: Audit log entries for: upload, approve, verify, download, user management
- AC-010: Document hash verification shows tamper status
- AC-011: RBAC enforced at route, API, and component level
- AC-012: All forms validate input client and server side
- AC-013: Rate limiting active on all API endpoints
- AC-014: Application passes production build without errors
- AC-015: Async PDF generation with progress indicator for documents >50 pages
- AC-016: MFA step-up required for approval action when enabled
- AC-017: Signature placement works for: AcroForm PDFs, plain PDFs, CJK PDFs
- AC-018: Processing jobs retry on failure (max 3 attempts) with dead letter queue
- AC-019: Audit logs >90 days archived to BigQuery with monthly cron
- AC-020: Expired documents automatically archived with daily cron
- AC-021: Document-level permissions enforced for non-admin users
- AC-022: Approval chain (sequential/parallel) enforced during approval
- AC-023: Health endpoint returns Firebase connectivity status
- AC-024: All API responses include correlationId for request tracing
- AC-025: Cursor-based pagination on all list endpoints

---

## 25. Implementation Checklist

- [ ] Project initialization (Next.js, deps, config)
- [ ] Firebase configuration (client + admin SDK)
- [ ] Type definitions (Document, User, Approval, Certificate, AuditLog, Notification, Settings, API)
- [ ] Constants and error codes
- [ ] Configuration module
- [ ] Logger module (structured JSON, correlationId propagation)
- [ ] Crypto utilities (SHA-256 hash, AES-256-GCM encryption/decryption, HKDF key derivation)
- [ ] Key management service (LocalKms implementation, Cloud KMS interface)
- [ ] Auth provider interface + Firebase implementation (incl. MFA methods)
- [ ] Auth middleware
- [ ] RBAC middleware (role hierarchy: super_admin > admin > approver > viewer > auditor)
- [ ] Document-level permission middleware
- [ ] Approval chain validator
- [ ] Rate limiter (in-memory + Upstash Redis interface)
- [ ] Validators (Zod schemas for all endpoints)
- [ ] Firestore repository interfaces + implementations (document, user, approval, certificate, audit-log, notification, processing-job, permission)
- [ ] Firestore converters (document, user, approval, certificate)
- [ ] Storage service (signed URLs, direct upload, cleanup)
- [ ] Virus scanner abstraction (ClamAV integration)
- [ ] QR generator (Document QR, Signature QR, Certificate QR)
- [ ] Signature placement engine (hybrid: AcroForm, layout analysis, page append, manual)
- [ ] PDF generators (public, internal with signature placement, certificate)
- [ ] Processing job queue (enqueue, process, retry, dead letter)
- [ ] Audit logger
- [ ] API route handlers (health, upload, documents, approvals, certificates, verify, users, settings, audit-logs, notifications)
- [ ] shadcn/ui setup + components (Button, Input, Label, Card, Badge, Dialog, etc.)
- [ ] Dashboard layout (sidebar, header, dashboard-layout)
- [ ] Public layout + public pages (verify, sign, certificate, unauthorized, invalid)
- [ ] Document upload component (direct-to-storage flow)
- [ ] Document list + detail pages (with approval timeline, job status)
- [ ] Approval workflow (button, list, timeline, MFA step-up dialog)
- [ ] Certificate display + download
- [ ] Verification portal (document verification, signature verification, certificate verification)
- [ ] User management pages (CRUD, role assignment, document permissions)
- [ ] Settings page (system config, security settings including MFA toggle)
- [ ] Audit log viewer (filterable, partition-based)
- [ ] Notification system (in-app, realtime via Firestore)
- [ ] Landing page
- [ ] Error pages (404, 500, unauthorized, invalid token)
- [ ] Security headers config (CSP, HSTS, X-Frame-Options, etc.)
- [ ] Rate limiting integration
- [ ] Testing setup (Vitest, Testing Library, Supertest, Playwright)
- [ ] Unit tests (lib/: crypto, auth, pdf, qr, validators, repositories, storage)
- [ ] Integration tests (API: upload, approve, verify, download)
- [ ] E2E tests (upload → approve → verify flow)
- [ ] CI/CD workflow (lint, typecheck, test, build, deploy)
- [ ] Production build verification

---

## 26. Dependencies

### Production

```
next, react, react-dom
typescript, @types/react, @types/node
tailwindcss, postcss, autoprefixer
firebase, firebase-admin
react-hook-form, @hookform/resolvers, zod
pdf-lib, @pdf-lib/fontkit
qrcode, @types/qrcode
lucide-react
class-variance-authority
clsx, tailwind-merge
next-themes
sonner (toast notifications)
date-fns
uuid, @types/uuid
@upstash/redis (rate limiting in multi-instance)
@upstash/qstash (async job processing)
```

### shadcn/ui

Installed components: Button, Input, Label, Card, Badge, Dialog, DropdownMenu, Table, Tabs, Avatar, Skeleton, Select, Separator, Sheet, Toast, Tooltip, Progress, Alert, Breadcrumb, Command, Popover, ScrollArea

### Dev

```
vitest
@testing-library/react, @testing-library/jest-dom
supertest, @types/supertest
playwright
eslint, eslint-config-next
prettier
```

---

## 27. Module Dependency Graph

```
types ──> constants
config ──> (environment)
logger ──> config
crypto ──> (node:crypto)
key-management ──> config, crypto
auth ──> config, types, logger, key-management
db/repositories ──> config, types, converters
virus-scanner ──> config, logger, storage
storage ──> config, crypto, key-management, types
qr ──> (qrcode)
pdf ──> config, qr, types, crypto, key-management
  └── signature-placement ──> pdf-lib (AcroForm), layout analysis
jobs ──> db/repositories, storage, pdf, qr, audit, types
validators ──> (zod), types
middleware ──> auth, rate-limiter, validators, db/repositories
audit ──> db/repositories, logger, types
API routes ──> middleware, validators, db, storage, jobs, audit, types
Components ──> types, lib, ui
Pages ──> components, lib, types
```

---

End of MASTER_SPEC.md
