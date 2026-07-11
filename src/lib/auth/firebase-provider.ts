import { getAuth } from "firebase-admin/auth";
import type { AuthProvider, AuthUser, MfaChallenge } from "./provider";

export class FirebaseAuthProvider implements AuthProvider {
  async verifyToken(token: string): Promise<AuthUser> {
    const decoded = await getAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || "",
      displayName: decoded.name || decoded.email?.split("@")[0] || "Unknown",
      photoURL: decoded.picture,
      emailVerified: decoded.email_verified || false,
      createdAt: new Date(decoded.auth_time * 1000),
    };
  }

  async getUser(uid: string): Promise<AuthUser | null> {
    try {
      const user = await getAuth().getUser(uid);
      return {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || user.email?.split("@")[0] || "Unknown",
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        createdAt: new Date(user.metadata.creationTime || Date.now()),
      };
    } catch {
      return null;
    }
  }

  async createUser(email: string, password: string, displayName: string): Promise<AuthUser> {
    const user = await getAuth().createUser({ email, password, displayName });
    return {
      uid: user.uid,
      email: user.email || email,
      displayName: user.displayName || displayName,
      emailVerified: false,
      createdAt: new Date(),
    };
  }

  async updateUser(uid: string, data: Partial<AuthUser>): Promise<void> {
    const updates: Record<string, string | boolean> = {};
    if (data.email) updates.email = data.email;
    if (data.displayName) updates.displayName = data.displayName;
    if (Object.keys(updates).length > 0) {
      await getAuth().updateUser(uid, updates);
    }
  }

  async deleteUser(uid: string): Promise<void> {
    await getAuth().deleteUser(uid);
  }

  async isMfaEnabled(userId: string): Promise<boolean> {
    try {
      const user = await getAuth().getUser(userId);
      const mfaInfo = (user as unknown as Record<string, unknown>).mfaInfo;
      return Array.isArray(mfaInfo) && mfaInfo.length > 0;
    } catch {
      return false;
    }
  }

  async requireMfaChallenge(_userId: string): Promise<MfaChallenge> {
    throw new Error("MFA challenge requires client-side Firebase SDK interaction");
  }

  async verifyMfaChallenge(_userId: string, _sessionInfo: string, _code: string): Promise<boolean> {
    throw new Error("MFA verification requires client-side Firebase SDK interaction");
  }
}

let providerInstance: AuthProvider | null = null;

export function getAuthProvider(): AuthProvider {
  if (!providerInstance) {
    providerInstance = new FirebaseAuthProvider();
  }
  return providerInstance;
}
