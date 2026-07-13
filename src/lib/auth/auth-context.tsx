"use client";

import * as React from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onIdTokenChanged,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/hooks/use-toast";

type UserRole = "super_admin" | "admin" | "approver" | "viewer" | "auditor";

interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  isActive: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

interface ServerProfile {
  role: UserRole;
  isActive: boolean;
}

function mapFirebaseUser(u: User, profile: ServerProfile): AuthUser {
  return {
    uid: u.uid,
    email: u.email ?? "",
    displayName: u.displayName ?? u.email?.split("@")[0] ?? "User",
    photoURL: u.photoURL ?? undefined,
    role: profile.role,
    isActive: profile.isActive,
  };
}

// Ensures the server-side Firestore profile (users/{uid}) exists before any
// authenticated API call is made; without it every route returns 403. Returns
// the provisioned role/isActive so the client can gate the UI by role.
const provisionPromises = new Map<string, Promise<ServerProfile>>();

function ensureProvisioned(firebaseUser: User): Promise<ServerProfile> {
  const existing = provisionPromises.get(firebaseUser.uid);
  if (existing) return existing;

  const promise = (async () => {
    const idToken = await firebaseUser.getIdToken();
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error?.message ?? "Failed to set up your account");
    }
    const data = json?.data ?? json;
    return {
      role: (data?.role ?? "viewer") as UserRole,
      isActive: data?.isActive !== false,
    };
  })();

  promise.catch(() => provisionPromises.delete(firebaseUser.uid));
  provisionPromises.set(firebaseUser.uid, promise);
  return promise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let profile: ServerProfile = { role: "viewer", isActive: true };
        try {
          profile = await ensureProvisioned(firebaseUser);
        } catch {
          toast({
            title: "Account setup incomplete",
            description: "Some features may be unavailable. Try signing in again.",
            variant: "destructive",
          });
        }
        setUser(mapFirebaseUser(firebaseUser, profile));
        setToken(await firebaseUser.getIdToken());
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });

    const interval = setInterval(async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const newToken = await currentUser.getIdToken(true);
        setToken(newToken);
      }
    }, 10 * 60 * 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await ensureProvisioned(cred.user);
    setUser(mapFirebaseUser(cred.user, profile));
    setToken(await cred.user.getIdToken());
  }, []);

  const signup = React.useCallback(async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const profile = await ensureProvisioned(cred.user);
    setUser(mapFirebaseUser(cred.user, profile));
    setToken(await cred.user.getIdToken());
  }, []);

  const logout = React.useCallback(async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
