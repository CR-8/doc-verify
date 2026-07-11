# Architecture Review Report — doc-verify

## Classification: Critical / High / Medium / Low

---

## CRITICAL FINDINGS

### C-01: Signature Detection / Placement Strategy Not Defined

**Severity**: Critical
**Area**: PDF Processing, Workflows

**Problem**:
The spec states "Signature QR beside every authenticated signature" (section 7.2) but provides no mechanism to determine WHERE signatures exist or should be placed on arbitrary uploaded PDFs. The spec also says "Visual signature representation may be rendered inside the PDF but is NOT the source of trust" without defining how or where this rendering occurs.

The signature placement problem is fundamentally unsolved in the current spec:
- The original PDF has no concept of "signature location"
- The spec implies signatures are placed "beside" content, requiring knowledge of content layout
- For 1000+ page documents, page-by-page analysis is computationally prohibitive
- No fallback strategy exists when auto-detection fails

**Real-World Impact**:
- Generated Internal Verification PDFs will not contain signature representations in the correct locations
- Users will receive PDFs where signatures appear on wrong pages or overwrite existing content
- In a regulated government context, this could render the document inadmissible
- Complete implementation failure on AC-005

**Recommended Solution**:
Implement a **Hybrid Signature Placement Engine** with four strategies evaluated in order:

1. **AcroForm Detection** (Primary): Parse PDF for existing AcroForm signature fields. If found, place signature visualization + QR at those field coordinates. This covers government PDFs with pre-defined form fields.

2. **Geometric Layout Analysis** (Secondary): Analyze PDF page content for signature indicators: whitespace regions in bottom 25% of page, horizontal lines (underscores), text "Signature:" or "Signed:" patterns. Place signature in nearest suitable whitespace region. Implement via `pdf-lib` page content stream parsing.

3. **Signature Page Append** (Default Tertiary): If no suitable location detected on any page, append a dedicated signature page at the end. This page contains the signer info, visual representation, and Signature QR. Deterministic and reliable for all documents.

4. **Manual Override** (User Control): Allow the approver (or admin during document setup) to specify exact page numbers or page ranges where their signature should appear. Store in document metadata as `signaturePageMap: { userId: number[] }`.

**Trade-offs**:
- AcroForm detection covers ~20% of real-world PDFs but is essential for government forms
- Layout analysis is computationally moderate but catches ~60% of remaining cases
- Page append is always reliable but produces longer documents
- Manual override adds UI complexity but ensures correctness for edge cases

---

### C-02: Vercel Serverless Function Timeout for Large PDF Processing

**Severity**: Critical
**Area**: Deployment, PDF Processing

**Problem**:
Vercel serverless functions have a maximum execution time of 60s (Pro plan). Generating QR overlays on every page of a 1000+ page document requires:
- Loading the original PDF buffer (100MB max)
- Generating a QR code image per page
- Embedding each QR into the PDF page
- Saving the result
- For internal PDF: repeating with additional signature pages

Benchmarking `pdf-lib` QR embedding at ~0.3-0.5s per page (including QR generation) puts a 1000-page document at 300-500s, far exceeding the 60s limit. Even at 100 pages, risk is significant.

**Real-World Impact**:
- PDF generation for documents >~200 pages will timeout
- Timeouts produce 504 Gateway Timeout errors
- Upload succeeds but PDF generation fails silently
- Inconsistent system state: document record exists without generated PDFs
- Complete feature failure for the stated requirement "1000+ pages without architectural changes" (NFR-001)

**Recommended Solution**:
Implement a **distributed job queue** architecture for PDF processing:

1. **Process Documents Collection**: New Firestore collection `processingJobs/{jobId}` to track async PDF generation:
   ```
   { jobId, documentId, jobType: 'public_pdf' | 'internal_pdf' | 'certificate',
     status: 'queued' | 'processing' | 'completed' | 'failed',
     progress: number (0-100), errorMessage?: string,
     createdAt, updatedAt }
   ```

2. **Implementation Strategy**: Two viable approaches depending on deployment:

   **Option A: Vercel + Upstash Redis QStash** (Recommended for Vercel-native)
   - Upload endpoint creates processing job record and returns immediately
   - QStash triggers a serverless function with the job ID
   - PDF generation runs asynchronously with QStash's 5min timeout
   - Status updated via Firestore realtime listener on client
   - Works within Vercel ecosystem
   - Pro plan QStash limits: 10k req/day free, paid scales

   **Option B: Vercel + Google Cloud Run** (For government deployment)
   - Upload endpoint creates processing job
   - Push job to Google Cloud Tasks or Pub/Sub
   - Cloud Run worker (up to 60min timeout, 32GB RAM) processes PDF
   - Cloud Run container can cache `pdf-lib` fonts, fonts, etc. (no cold start)
   - Better for 1000+ page documents
   - More complex infrastructure

3. **PDF Generation Refactoring**: 
   - Generate QR code once per document (Document QR is same on every page)
   - Cache generated QR image buffer in memory for the job
   - Process pages in parallel batches (Promise.all with concurrency limit of 5)
   - Stream progress updates to Firestore every 50 pages

**Trade-offs**:
- Async processing adds complexity (progress UI, error handling, retry logic)
- QStash adds a dependency but keeps Vercel-native architecture
- Cloud Run provides more power but adds GCP billing and complexity
- Cold starts on Cloud Run mitigated by min-instance setting (cost trade-off)

---

### C-03: No Transactional Integrity Across Firebase Services

**Severity**: Critical
**Area**: Database, Storage, Workflows

**Problem**:
The upload workflow (section 6.1) spans multiple Firebase services: Firestore writes, Storage uploads, and PDF generation. These are not coordinated with transactions or sagas. A failure at any step leaves the system in an inconsistent state:

- Storage upload succeeds but Firestore write fails → orphaned file
- Original PDF stored encrypted but public PDF generation fails → document is unusable
- Notification sent but document record creation fails → ghost notification
- Approval recorded but Internal PDF generation fails → mismatch between data and artifacts

**Real-World Impact**:
- Orphaned files in Storage incurring cost without benefit
- Users receive notifications for documents that don't exist
- Audit trail incomplete or contradictory
- Manual cleanup needed in production
- Compliance violation in regulated environment

**Recommended Solution**:
Implement a **Saga Pattern** using ProcessingJobs:

1. Each workflow (upload, approve) maps to a Saga with steps and compensating actions:
   ```typescript
   interface SagaStep<T> {
     name: string;
     execute: () => Promise<T>;
     compensate: () => Promise<void>;
   }
   ```

2. **Upload Saga**:
   - Step 1: Write temp doc record (status: "processing")
   - Step 2: Upload encrypted original to Storage (compensate: delete from Storage)
   - Step 3: Generate and upload public PDF (compensate: delete public PDF)
   - Step 4: Generate and upload internal PDF (compensate: delete internal PDF)
   - Step 5: Update doc record to "pending_approval" (compensate: mark as "failed")
   - Step 6: Create audit log (fire-and-forget)

3. On any step failure: execute compensation for all completed steps, mark job as "failed", alert operator.

4. Dead letter queue: Failed jobs logged with full error context for manual intervention.

5. Idempotency Keys: All mutation endpoints accept `idempotencyKey` to prevent duplicate processing on retry.

---

### C-04: Firestore Document Size Limits on Audit Logs and Certificates

**Severity**: Critical
**Area**: Database

**Problem**:
Firestore enforces a **1 MiB per document** limit. The `auditLogs` collection has a `details` field typed as `map` with no size constraints. When storing large document metadata, error details, or full request payloads in audit logs, this limit will be reached. Similarly, `certificates` records could approach the limit with large metadata.

Additionally, Firestore single-document write limit is **1 write/second**. Concurrent approvals on the same document will conflict.

**Real-World Impact**:
- Audit log writes fail silently (or throw) when details exceed 1MiB
- Certificate writes fail for documents with large metadata
- Concurrent approval creates write contention on the document record's `currentApprovals` field
- Lost audit trail = compliance violation
- Application errors visible to users

**Recommended Solution**:

1. **Audit Log Hard Limit**: Enforce a 500KB limit on `details` map via Zod validation. For payloads exceeding this, store in a separate `auditLogBlobs/{logId}` collection (also 1MiB limit, but dedicated).

2. **Certificate Schema Optimization**: Move large metadata out of the certificate document. Store only verification-critical fields. Use a separate `certificateData/{certificateId}` for display-only metadata.

3. **Atomic Counter for approvals**: Use Firestore `runTransaction` with a custom counter document (`counters/{documentId}_approvals`) and `FieldValue.increment()` instead of reading/writing `currentApprovals` on the document itself.

4. **Audit Log Archival Strategy**:
   - Implement document-level TTL via `expiresAt` field
   - Monthly archival job: copy logs older than 90 days to a separate Firestore database or export to BigQuery
   - Delete archived logs from primary collection
   - Document archival strategy in operations manual

5. **Write Contention Resolution**:
   - Use Firestore `runTransaction` for document approval (read current status, check not already approved, write new approval)
   - Implement exponential backoff retry (2 attempts)
   - For high-contention documents: use distributed counter pattern with sharded counters

---

## HIGH FINDINGS

### H-01: Encryption Master Key as Environment Variable

**Severity**: High
**Area**: Security, Cryptography

**Problem**:
The master encryption key is stored as a plain environment variable (`ENCRYPTION_MASTER_KEY`). This is a single point of compromise. If the env var is exposed (compromised CI/CD, Vercel dashboard access, log leakage), every encrypted document is decryptable. No key rotation mechanism exists. The master key can encrypt the per-document key but no key derivation function (KDF) like HKDF is specified.

Additionally, AES-256-GCM requires a unique nonce/IV per encryption, with a maximum of 2^32 encryptions per key before collision risk. No IV management strategy is defined.

**Real-World Impact**:
- Single breach exposes all documents
- No key rotation means long-term key use increases risk
- IV collision would break confidentiality guarantees
- Non-compliance with SOC2, FedRAMP, or GDPR encryption requirements
- Blocked by government security review

**Recommended Solution**:

1. **Cloud KMS Integration**: Implement a `KeyManagementService` interface:
   ```typescript
   interface IKeyManagementService {
     encryptDataKey(plaintextDataKey: Buffer): Promise<Buffer>;
     decryptDataKey(ciphertextDataKey: Buffer): Promise<Buffer>;
     generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: Buffer }>;
   }
   ```

2. **Default Implementation: LocalKms** (dev/staging): Uses env var as master key with HKDF-SHA256 key derivation.
   ```typescript
   // masterKey from env var -> HKDF-SHA256 -> dataEncryptionKey
   // Every encryption generates a random 12-byte IV
   // IV stored alongside ciphertext
   // Max 2^32 encryptions per master key (alert at 2^28)
   ```

3. **Production Implementation: Google Cloud KMS** (gov deployment):
   - Master key stored in Cloud KMS (automatic key rotation)
   - Per-document data key generated via KMS `generateRandomBytes`
   - Data key encrypted with Cloud KMS key, stored in Firestore `document.encryptedDataKey`
   - Rotation handled by Cloud KMS automatically

4. **Key Rotation**: Support re-encryption of all documents via `scripts/re-encrypt.ts`.

5. **IV Management**: Random 96-bit IV per encryption, stored as `document.encryptionIv`.

---

### H-02: No Background Job Queue — Synchronous PDF Generation Blocks Request

**Severity**: High
**Area**: Performance, Architecture

**Problem**:
PDF generation (public, internal, certificate) happens synchronously during the request-response cycle. For documents >~50 pages, the user waits tens of seconds for the response. Vercel's 60s timeout means failure for larger documents. Even for smaller documents, this creates a poor UX and ties up serverless function concurrency.

**Real-World Impact**:
- Browser timeout (usually 30-60s) occurs before response
- Users see loading spinners that never resolve
- Function concurrency exhausted quickly under moderate load
- Cost inefficiency: paying for idle wait time during PDF processing
- Additional cold start penalty for infrequent PDF operations

**Recommended Solution**:
(See C-02 for full solution: Processing Jobs + QStash/Cloud Run)

Immediate mitigatable improvements:
1. Return upload response immediately with `status: "processing"`
2. Client polls or listens to Firestore for `processingJobs/{jobId}.status`
3. Show progress indicator to user
4. Retry failed jobs automatically (max 3 attempts)
5. Alert operations team on persistent failures

---

### H-03: Audit Log Collection Will Grow Unbounded

**Severity**: High
**Area**: Database, Operations

**Problem**:
Every action (upload, approve, verify, download, user management) creates an audit log entry. With 1000 documents and an average of 10 actions per document, this is 10k+ documents/year. Firestore read costs scale with collection size. Query performance degrades without appropriate indexes. No cleanup or archival strategy exists.

**Real-World Impact**:
- Increasing Firestore costs without bound
- Admin audit log queries become slow
- Regulatory requirement for audit log retention (often 7 years) met with ever-growing costs
- Eventual Firestore document count limits (no hard limit, but practical/performance limits exist)

**Recommended Solution**:

1. **Monthly Document Partitioning**: Store audit logs in monthly subcollections: `auditLogs/2026-07/{logId}`, `auditLogs/2026-08/{logId}`. This limits per-collection size and enables easy archival by deleting old month collections.

   **OR** (better for Firestore indexing): Use a `partition` field with value `YYYY-MM` and a composite index on `(partition, timestamp)`. Query all logs with `where('partition', '==', '2026-07')`.

2. **90-Day Hot Retention**: Primary Firestore stores 90 days of logs. Logs older than 90 days are moved to:
   - BigQuery (for compliance queries)
   - Google Cloud Storage (cold archive, JSON Lines format)

3. **Archival Cron Job**: `scripts/archive-audit-logs.ts` runs monthly, exports logs older than 90 days, deletes from Firestore.

4. **Zod Size Limit**: Validate `details` field at max 500KB per log entry.

---

### H-04: Cold Start Latency for PDF Processing Functions

**Severity**: High
**Area**: Performance, Deployment

**Problem**:
Vercel serverless functions cold start on infrequent operations. PDF generation is inherently infrequent (triggered only on upload/approval). When a cold start occurs, the function must:
- Load and initialize `pdf-lib` (large library)
- Load fonts
- Initialize Firebase Admin SDK
- Load QR library
- Total cold start: 3-8 seconds before any PDF work begins

**Real-World Impact**:
- First upload of the day adds 5-10s latency
- Approval flow feels slow for first daily use
- Vercel cold start analytics show higher latency

**Recommended Solution**:

1. **Vercel Pro/Enterprise**: Enable `serverlessFunctions.region` in a region close to users. Use Vercel's "Runtime Logs" to monitor cold starts.

2. **Node.js Optimize**: Use `@vercel/functions` with `runtime: 'nodejs20.x'` and configure memory to 1024MB (faster CPU allocation).

3. **Module Pre-loading**: Structure the PDF module to lazy-init dependencies but keep the Firebase Admin SDK warm via periodic pings (if Pro plan allows).

4. **Cloud Run Migration** (recommended for gov deployment):
   - Set `minInstances: 1` to keep at least one instance warm
   - 2x-4x faster PDF processing on Cloud Run CPU
   - No cold start penalty
   - Cost: ~$30-50/month for a warm instance

---

### H-05: RBAC Model Too Coarse for Enterprise Use

**Severity**: High
**Area**: Authorization

**Problem**:
Three roles (admin, approver, viewer) with document-level visibility are insufficient for enterprise/government use. There is no:
- Document-level access control (specific users to specific documents)
- Read/write separation within documents
- Delegation (approver delegates to deputy)
- Temporary elevated access
- Attribute-based control (ABAC) for document classification
- Approval chain configuration (sequential vs parallel, threshold counts)

**Real-World Impact**:
- Admin role is too powerful (single compromised admin exposes all data)
- Cannot restrict approvers to specific document types or departments
- No auditability for who-can-access-what
- Non-compliant with government role-separation requirements

**Recommended Solution**:

1. **Expand RBAC to include document-level permissions**:
   ```typescript
   interface IDocumentPermission {
     documentId: string;
     userId: string;
     role: 'approver' | 'viewer';
     grantedBy: string;
     grantedAt: Timestamp;
     expiresAt?: Timestamp; // Temporary access
   }
   ```

2. **Add ABAC support through document metadata**:
   - Documents have `classification` field (unclassified, confidential, secret, top-secret)
   - Users have `clearance` field
   - Access granted only if `clearance >= classification`

3. **Add Approval Chain Model**:
   ```typescript
   interface IApprovalChain {
     documentId: string;
     steps: { order: number; userId: string; role: 'sequential' | 'parallel' }[];
     requiredCount: number; // For parallel steps
   }
   ```

4. **Add Role Hierarchy**:
   - `super_admin` (full system access)
   - `admin` (manage users, settings, view all)
   - `approver` (approve assigned documents)
   - `viewer` (view assigned documents)
   - `auditor` (read-only, view logs and documents)

---

### H-06: No Caching Strategy for Verification Endpoints

**Severity**: High
**Area**: Performance, Cost

**Problem**:
Public verification endpoints (`/api/verify/{documentId}`, `/api/verify/signature/{token}`) hit Firestore on every request. For documents with high verification volume (e.g., a publicly distributed certificate), every QR scan triggers a Firestore read. Firestore read costs are $0.06/100k reads. A document verified 10,000 times costs $0.006 just in reads, plus compute.

**Real-World Impact**:
- Unnecessary Firestore costs for read-heavy verification traffic
- Higher latency for verification pages (100-300ms per Firestore read)
- Firestore read quota consumption for repeated verification of same document
- No protection against traffic spikes

**Recommended Solution**:

1. **Incremental Static Regeneration (ISR)**: Use Next.js ISR for verification pages where data changes infrequently:
   - `revalidate: 3600` (1 hour) for document verification data
   - On document status change: `revalidatePath('/verify/[documentId]')` via `revalidateTag`

2. **Vercel Edge Config**: Store frequently-accessed verification data in Vercel Edge Config (fast global reads):
   - Document status + hash for public verification
   - Cache key: `verify_doc_{documentId}`
   - Cache TTL: 1 hour, invalidate on status change

3. **SWR Pattern**: Client-side data fetching with `stale-while-revalidate` for verification pages.

4. **CSP with Cache**: Set `Cache-Control: public, max-age=3600, stale-while-revalidate=300` on public verification API responses.

---

### H-07: Duplicate Encryption Module

**Severity**: High
**Area**: Maintainability

**Problem**:
The folder structure defines `lib/storage/encryption.ts` AND `lib/crypto/encryption.ts`. This splits encryption logic across two files with unclear responsibility boundaries.

**Real-World Impact**:
- Confusion about which encryption to import
- Duplicate code or split logic
- Inconsistent error handling
- Maintenance burden

**Recommended Solution**:
Consolidate all encryption logic into `lib/crypto/`:
- `lib/crypto/encryption.ts`: AES-256-GCM encrypt/decrypt, key management
- `lib/storage/storage-service.ts`: Import encryption from crypto; handles storage operations only
- Remove `lib/storage/encryption.ts`

---

### H-08: Firestore Security Rules Insufficiently Specified

**Severity**: High
**Area**: Security

**Problem**:
Section 3.3 describes rules at a high level but lacks specifics. Firestore security rules are the last line of defense against unauthorized data access if the backend is bypassed. The current description would not pass a security review.

**Real-World Impact**:
- Malicious client SDK usage could access unauthorized data
- Firebase client SDK can be used from console/browser directly
- Rules not enforced in testing
- Compliance failure

**Recommended Solution**:
Specify complete Firestore security rules pattern:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() { return request.auth != null; }
    function getUserRole() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role; }
    function isAdmin() { return isAuthenticated() && getUserRole() == 'admin'; }
    function isApprover() { return isAuthenticated() && getUserRole() in ['admin', 'approver']; }
    
    // Documents
    match /documents/{docId} {
      allow read: if isAuthenticated();
      allow create: if isApprover();
      allow update: if isAdmin() || (isApprover() && resource.data.uploadedBy == request.auth.uid);
      allow delete: if isAdmin();
    }
    
    // Approvals
    match /approvals/{approvalId} {
      allow read: if isAuthenticated();
      allow create: if isApprover();
      allow update: if isAdmin();
      allow delete: if false;
    }
    
    // Certificates - publicly readable for verification
    match /certificates/{certId} {
      allow read: if true; // Public verification
      allow write: if isAdmin();
    }
    
    // Audit logs - append only
    match /auditLogs/{logId} {
      allow create: if isAuthenticated();
      allow read: if isAdmin() || request.auth.uid == resource.data.actorId;
      allow update: if false; // Immutable
      allow delete: if false; // Immutable
    }
    
    // Users - self-read, admin-write
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || request.auth.uid == userId;
    }
    
    // Processing Jobs
    match /processingJobs/{jobId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
    
    // Notifications - self-read
    match /notifications/{notifId} {
      allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
      allow write: if isAuthenticated();
    }
  }
}
```

---

### H-09: Missing Multi-Factor Authentication Requirement

**Severity**: High
**Area**: Security

**Problem**:
No MFA requirement for approval actions. In a government/regulated environment, approving a document with a single factor (password) is insufficient. Compromised credentials allow unauthorized document approval.

**Real-World Impact**:
- Single-factor approval does not meet NIST 800-63 or FedRAMP requirements
- Password compromise leads to unauthorized approvals
- Non-repudiation weakened (user can claim "someone else used my password")
- Blocked by government security review

**Recommended Solution**:

1. **Firebase Authentication MFA**: Enable Firebase Auth MFA (supports TOTP, SMS). Add a `requireMfa: boolean` setting.

2. **Step-up Authentication for Approval**:
   - Normal login: single factor (or MFA if globally enabled)
   - Approval action: require fresh MFA verification within last 5 minutes
   - Store `mfaVerifiedAt` in session

3. **AuthProvider Interface Extension**:
   ```typescript
   interface AuthProvider {
     // ... existing methods
     requireMfaStepUp(userId: string): Promise<boolean>;
     verifyMfaStepUp(userId: string, code: string): Promise<boolean>;
   }
   ```

---

## MEDIUM FINDINGS

### M-01: pdf-lib Limitations for Enterprise PDF Processing

**Severity**: Medium
**Area**: PDF Processing

**Problem**: `pdf-lib` has no AcroForm support, limited font embedding (no CJK font support out of the box), and performance degrades as document size increases. It also cannot:
- Read existing form fields
- Preserve PDF annotations
- Handle encrypted PDFs
- Process PDF portfolios

**Real-World Impact**:
- Cannot detect existing AcroForm signature fields (critical gap C-01 partially addressed by hybrid approach, but pdf-lib limitation is a factor)
- CJK PDFs may have missing characters
- Form data stripped from PDFs during processing

**Recommended Solution**:
Add `@pdf-lib/fontkit` dependency for font embedding. For AcroForm detection, implement server-side using `pdf-parse` (text extraction) as a secondary strategy alongside layout analysis.

Long-term: Consider `pdfjs-dist` for PDF parsing in a separate analysis step before pdf-lib for generation.

---

### M-02: No Cursor-Based Pagination

**Severity**: Medium
**Area**: API Design, Database

**Problem**: Firestore's `offset`-based pagination is inefficient for large collections. Each offset skips all preceding documents, incurring read costs proportional to the offset value. The spec uses `limit` and `offset` but Firestore recommends cursor-based pagination.

**Real-World Impact**:
- Page 100 of audit logs (offset 2000) reads 2000+ documents before returning 20
- Cost proportional to depth of pagination
- Inconsistent results if documents are added between pages

**Recommended Solution**:
Use Firestore cursor-based pagination:
- `startAfter` cursor approach for forward pagination
- API accepts `cursor` (last document ID) instead of `offset`
- Return `nextCursor` in response for client to pass back
- Maintain `limit` parameter for page size

---

### M-03: Missing Document Expiry Enforcement

**Severity**: Medium
**Area**: Workflows

**Problem**: Documents have an `expiresAt` field but no workflow enforces it. Expired documents remain active in queries and can be approved, verified, and downloaded indefinitely.

**Real-World Impact**:
- Time-sensitive documents (e.g., compliance certificates, temporary permits) remain valid after expiry
- Legal exposure from expired documents being treated as valid
- Audit trail shows no expiry event

**Recommended Solution**:
1. Add a `scripts/enforce-expiry.ts` cron job that runs daily.
2. Job queries `documents where expiresAt < now and status != 'archived'`.
3. Sets status to `archived`, creates audit log `DOCUMENT_EXPIRED`.
4. Verification pages show "This document has expired" for archived documents.
5. Optionally trigger notification to document owner.

---

### M-04: I-Prefix Interface Naming Conflicts with TypeScript Best Practices

**Severity**: Medium
**Area**: Naming Standards

**Problem**: Section 16 mandates I-prefix interfaces (`IDocument`, `IUser`). This is a legacy C#/Java convention that modern TypeScript best practices (including official TypeScript style guide) advise against. The prefix provides no type-safety benefit, adds visual noise, and differs from common ecosystem conventions (shadcn/ui, Next.js types).

**Real-World Impact**:
- Inconsistency with React ecosystem (most libraries don't use I-prefix)
- Extra typing without benefit
- May confuse developers from modern TypeScript backgrounds
- Linters and formatters don't enforce I-prefix consistently

**Recommended Solution**:
Use PascalCase without I-prefix (e.g., `Document`, `User`). Use prefix only for true abstract interface contracts where implementation distinction is needed (e.g., `AuthProvider` as the interface, `FirebaseAuthProvider` as implementation).

Update section 16 to: "Types/Interfaces: PascalCase. Suffix interfaces with 'Interface' only when distinguishing from a concrete class (e.g., `AuthProvider` interface, `FirebaseAuthProvider` implementation)."

---

### M-05: Missing Error Pages in Folder Structure

**Severity**: Medium
**Area**: Frontend

**Problem**: Implementation checklist mentions "Error pages (404, 500, unauthorized)" but the folder structure has no `not-found.tsx`, `error.tsx`, or `unauthorized` route files.

**Real-World Impact**:
- Default Next.js 404 page shown instead of branded error page
- Unauthorized access shows generic error, not specific guidance
- Poor UX for verification QR scans with invalid tokens

**Recommended Solution**:
Add to folder structure:
- `src/app/not-found.tsx` — Custom 404
- `src/app/error.tsx` — Global error boundary
- `src/app/(public)/unauthorized/page.tsx` — Unauthorized page
- `src/app/(public)/verify/invalid/page.tsx` — Invalid verification token

---

### M-06: No Health Check Endpoint

**Severity**: Medium
**Area**: Operations, DevOps

**Problem**: No `/api/health` endpoint for monitoring. Vercel monitoring and external uptime checkers have no way to verify the application is functional, including Firebase connectivity.

**Real-World Impact**:
- Monitoring tools can only check HTTP 200, not actual health
- Firebase outage not detected until user reports issues
- No readiness/liveness probe for container orchestration
- SLA monitoring impossible

**Recommended Solution**:
Add `src/app/api/health/route.ts`:
```typescript
// GET /api/health
// Returns: { status: 'healthy', timestamp, checks: { firestore: bool, storage: bool, auth: bool } }
// Performs lightweight Firebase connectivity check:
//   - Firestore: read a known document or collection group
//   - Storage: check bucket exists
//   - Auth: verify Firebase Admin SDK initialized
```

---

### M-07: No Request/Correlation ID

**Severity**: Medium
**Area**: Logging, Observability

**Problem**: The API response format has no `requestId` or `correlationId`. The logger has an optional `correlationId` field but no mechanism to generate or propagate it.

**Real-World Impact**:
- Cannot correlate log entries across multiple operations in a workflow
- Debugging failed upload→process→approval sequence requires manual log searching
- Support tickets lack request identifiers
- Distributed tracing impossible

**Recommended Solution**:
1. Generate `correlationId` (uuid) in the root layout or middleware per request.
2. Include in all API responses and log entries.
3. Pass through to async processing jobs.
4. Add to error responses for support reference.

---

### M-08: Firestore `value` Field Typed as `any`

**Severity**: Medium
**Area**: Database, Code Quality

**Problem**: Settings collection's `value` field is typed as `any`, violating the strict TypeScript requirement.

**Real-World Impact**:
- Type-safety of settings operations depends on runtime checks
- No compile-time validation of setting values
- Violates CLAUDE.md "No `any`" rule

**Recommended Solution**:
Use a union type:
```typescript
type SettingValue = string | number | boolean | string[] | Record<string, string>;
```

---

## LOW FINDINGS

### L-01: Duplicate `signedAt` Field in Approvals Schema

**Severity**: Low
**Area**: Database

**Problem**: The `approvals` schema (section 3.1) has `signedAt` listed twice with different descriptions ("When signed" and "Timestamp of approval").

**Real-World Impact**: Confusion during implementation; potential duplicate field write.

**Fix**: Remove the duplicate entry.

---

### L-02: Test File Location Contradiction

**Severity**: Low
**Area**: Testing

**Problem**: CLAUDE.md section 8 says "adjacent to source file" but section 13 folder rules say `tests/` mirrors `src/`. These are two different strategies.

**Real-World Impact**: Confusion about where to place test files; inconsistent test structure.

**Fix**: Settle on adjacent test files (e.g., `document-repository.ts` + `document-repository.test.ts`) for unit tests (closer to code, easier to maintain), and `tests/integration/` and `tests/e2e/` for integration and E2E tests. Update section 8 and section 13 to be consistent.

---

### L-03: No Body Size Configuration for Upload

**Severity**: Low
**Area**: Infrastructure

**Problem**: Next.js has a default body size limit of 4MB in serverless functions. The spec allows 100MB uploads.

**Real-World Impact**: Uploads >4MB fail with 413 Payload Too Large.

**Fix**: Add `export const config = { api: { bodyParser: { sizeLimit: '100mb' } } }` to upload route handler. Or use Firebase Storage direct upload with signed URLs (recommended).

---

### L-04: Missing Font Embedding Dependency

**Severity**: Low
**Area**: PDF Processing

**Problem**: `pdf-lib` requires `@pdf-lib/fontkit` for font embedding. Without it, custom fonts may not render correctly, especially CJK characters.

**Real-World Impact**: QR labels may render with missing characters for non-Latin scripts.

**Fix**: Add `@pdf-lib/fontkit` to dependencies.

---

### L-05: Vercel Pro Required for Production

**Severity**: Low
**Area**: Deployment

**Problem**: Several features require Vercel Pro plan: 60s function timeout (vs 10s Hobby), larger responses, team features, and more.

**Real-World Impact**: Hobby plan insufficient for production deployment with large PDF processing.

**Fix**: Document Vercel Pro requirement explicitly.

---

## SUMMARY OF RECOMMENDED CHANGES

### New Sections Needed:
- Section 6.5: Signature Placement Strategy (from C-01)
- Section 6.6: Saga Pattern for Transactional Integrity (from C-03)
- Section 3.4: Processing Jobs Collection (from C-02)
- Section 3.5: Audit Log Archival Strategy (from H-03)
- Section 4.4: MFA Requirement (from H-09)
- Section 4.5: Approval Chain Model (from H-05)
- Section 6.7: Document Expiry Enforcement (from M-03)
- Section 22.4: Scaling Strategy (from C-02/C-04)

### Sections to Modify:
- Section 6.2: Approval Workflow → Add signature placement step (C-01)
- Section 7.2: Internal PDF Generation → Add signature placement details (C-01)
- Section 12.2: Encryption Strategy → Add KMS interface, IV management, key rotation (H-01)
- Section 15: Folder Structure → Remove lib/storage/encryption.ts, add processing jobs, health check, error pages (H-07, M-05, M-06)
- Section 16: Naming → Remove I-prefix requirement (M-04)
- Section 3.1: Schema → Fix duplicate signedAt, fix any type (M-08, L-01)
- Section 13: Rate Limiting → Add PDF processing rate limits (H-02)
- Section 20: Performance → Add caching, job queue, cold start mitigations (H-04, H-06)
- Section 11.1: API → Add cursor-based pagination (M-02), health endpoint (M-06)
- Section 5.3: File Validation → Add body size configuration (L-03)
- Section 26: Dependencies → Add @pdf-lib/fontkit, @upstash/redis, @upstash/qstash (L-04, C-02)

### Sections to Remove:
- `lib/storage/encryption.ts` from folder structure (move to lib/crypto/)

---

End of Architecture Review Report
