import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/db/firebase";
const adminDb = getAdminDb();
import { getAuth } from "firebase-admin/auth";
import { successResponse, handleRouteError } from "@/lib/api-utils";

export async function GET(_request: NextRequest) {
  try {
    const checks = {
      firestore: false,
      cloudinary: false,
      auth: false,
    };

    try {
      await adminDb.collection("health").doc("_check").get();
      checks.firestore = true;
    } catch { /* skip */ }

    try {
      const { v2: cloudinary } = await import("cloudinary");
      const ping = await cloudinary.api.ping();
      checks.cloudinary = ping.status === "ok";
    } catch { /* skip */ }

    try {
      await getAuth().listUsers(1);
      checks.auth = true;
    } catch { /* skip */ }

    const status = checks.firestore && checks.cloudinary && checks.auth ? "healthy" : "degraded";

    return successResponse({
      status,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    return handleRouteError(error, "health");
  }
}