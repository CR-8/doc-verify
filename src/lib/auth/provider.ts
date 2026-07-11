export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  createdAt: Date;
}

export interface MfaChallenge {
  sessionInfo: string;
}

export interface AuthProvider {
  verifyToken(token: string): Promise<AuthUser>;
  getUser(uid: string): Promise<AuthUser | null>;
  createUser(email: string, password: string, displayName: string): Promise<AuthUser>;
  updateUser(uid: string, data: Partial<AuthUser>): Promise<void>;
  deleteUser(uid: string): Promise<void>;
  isMfaEnabled(userId: string): Promise<boolean>;
  requireMfaChallenge(userId: string): Promise<MfaChallenge>;
  verifyMfaChallenge(userId: string, sessionInfo: string, code: string): Promise<boolean>;
}
