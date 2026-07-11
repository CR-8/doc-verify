import { AppError, ErrorCodes } from "@/constants/errors";
import { getAuthProvider } from "@/lib/auth/firebase-provider";
import type { AuthUser } from "@/lib/auth/provider";

export interface AuthContext {
  user: AuthUser;
  token: string;
}

export async function authenticateRequest(request: Request): Promise<AuthContext> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Missing or invalid authorization header", 401);
  }

  const token = authHeader.slice(7);
  if (!token) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Empty token", 401);
  }

  try {
    const provider = getAuthProvider();
    const user = await provider.verifyToken(token);
    return { user, token };
  } catch {
    throw new AppError(ErrorCodes.UNAUTHORIZED, "Invalid or expired token", 401);
  }
}

export function optionalAuth(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Promise.resolve(null);
  }
  return authenticateRequest(request).catch(() => null);
}
