import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdminConfig } from "@/config/firebase";

function initAdmin() {
  if (getApps().length > 0) return;

  const hasAdminCreds = firebaseAdminConfig.clientEmail && firebaseAdminConfig.privateKey;

  try {
    if (hasAdminCreds) {
      initializeApp({
        credential: cert({
          projectId: firebaseAdminConfig.projectId,
          clientEmail: firebaseAdminConfig.clientEmail,
          privateKey: firebaseAdminConfig.privateKey,
        }),
      });
    } else {
      initializeApp({
        projectId: firebaseAdminConfig.projectId,
      });
    }
  } catch {
    initializeApp({
      projectId: firebaseAdminConfig.projectId,
    });
  }
}

let _db: ReturnType<typeof getFirestore> | null = null;

export function getAdminDb() {
  if (!_db) {
    initAdmin();
    _db = getFirestore();
  }
  return _db;
}
