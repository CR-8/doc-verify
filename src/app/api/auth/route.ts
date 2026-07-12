import { NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/middleware/rate-limiter";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { validateCsrf } from "@/lib/middleware/csrf";
import { getAdminDb } from "@/lib/db/firebase";
import { createAuditLog } from "@/lib/audit/audit-logger";
import type { UserRole } from "@/types/user";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    await checkRateLimit("GET", "/api/auth/*", request.headers.get("x-forwarded-for") || "unknown");
    const { user } = await authenticateRequest(request);
    return successResponse({ uid: user.uid, email: user.email, displayName: user.displayName });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}

// Provisions the Firestore user profile for an authenticated Firebase user.
// Idempotent: creates the users/{uid} document on first call, refreshes
// lastLoginAt on subsequent calls. The very first user in the system is
// bootstrapped as super_admin; everyone else starts as viewer until promoted.
export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    await checkRateLimit("POST", "/api/auth/*", request.headers.get("x-forwarded-for") || "unknown");
    const { user } = await authenticateRequest(request);

    const adminDb = getAdminDb();
    const userRef = adminDb.collection("users").doc(user.uid);

    const result = await adminDb.runTransaction(async (tx) => {
      const snapshot = await tx.get(userRef);
      if (snapshot.exists) {
        const data = snapshot.data()!;
        tx.update(userRef, { lastLoginAt: Timestamp.now() });
        return {
          created: false,
          role: (data.role ?? "viewer") as UserRole,
          isActive: data.isActive !== false,
        };
      }

      const anyUser = await tx.get(adminDb.collection("users").limit(1));
      const role: UserRole = anyUser.empty ? "super_admin" : "viewer";
      const now = Timestamp.now();
      tx.set(userRef, {
        email: user.email,
        displayName: user.displayName,
        role,
        designation: "",
        department: "",
        clearance: "unclassified",
        isActive: true,
        emailVerified: user.emailVerified ?? false,
        mfaEnabled: false,
        photoURL: user.photoURL ?? "",
        phone: "",
        createdAt: now,
        lastLoginAt: now,
      });
      return { created: true, role, isActive: true };
    });

    if (result.created) {
      await createAuditLog({
        action: "USER_REGISTERED",
        actorId: user.uid,
        targetId: user.uid,
        targetType: "user",
        details: { email: user.email, role: result.role },
        ipAddress: request.headers.get("x-forwarded-for") || "",
        userAgent: request.headers.get("user-agent") || "",
        correlationId,
      });
    }

    return successResponse(
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: result.role,
        isActive: result.isActive,
      },
      result.created ? 201 : 200
    );
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
