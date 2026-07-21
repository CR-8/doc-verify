import { NextRequest } from "next/server";
import { successResponse, handleRouteError } from "@/lib/api-utils";
import { authenticateRequest } from "@/lib/middleware/auth-guard";
import { requireRole } from "@/lib/middleware/role-guard";
import { validateCsrf } from "@/lib/middleware/csrf";
import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import { createAuditLog } from "@/lib/audit/audit-logger";

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "admin");
    const settingsSnapshot = await adminDb.collection("settings").get();
    const settings: Record<string, unknown> = {};
    settingsSnapshot.docs.forEach((doc) => {
      settings[doc.id] = doc.data().value;
    });
    return successResponse(settings);
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}

export async function PATCH(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    validateCsrf(request);
    const { user } = await authenticateRequest(request);
    await requireRole(user.uid, "admin");
    const body = await request.json();

    // API key regeneration is an action, not a stored value.
    let apiKey: string | undefined;
    if (body.regenerateApiKey) {
      delete body.regenerateApiKey;
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      apiKey = "dv_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      body.apiKey = apiKey;
    }

    for (const [key, value] of Object.entries(body)) {
      await adminDb.collection("settings").doc(key).set({ value, updatedBy: user.uid, updatedAt: new Date() }, { merge: true });
    }
    await createAuditLog({
      action: "SETTINGS_UPDATED",
      actorId: user.uid,
      targetId: "system",
      targetType: "settings",
      details: { keys: Object.keys(body) },
      correlationId,
    });
    return successResponse({ updated: true, ...(apiKey ? { apiKey } : {}) });
  } catch (error) {
    return handleRouteError(error, correlationId);
  }
}
