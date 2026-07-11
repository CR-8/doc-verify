import { AppError, ErrorCodes } from "@/constants/errors";
import { siteConfig } from "@/config/site";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "POST:/api/documents/upload-url": { limit: 10, windowMs: 60000 },
  "POST:/api/documents/complete": { limit: 10, windowMs: 60000 },
  "POST:/api/documents/*/approve": { limit: 5, windowMs: 60000 },
  "GET:/api/documents/*/download/*": { limit: 30, windowMs: 60000 },
  "GET:/api/verify/*": { limit: 60, windowMs: 60000 },
  "POST:/api/auth/*": { limit: 20, windowMs: 60000 },
  "GET:/api/certificates/*/download": { limit: 20, windowMs: 60000 },
  "POST:/api/users": { limit: 5, windowMs: 60000 },
  "PATCH:/api/settings": { limit: 10, windowMs: 60000 },
  "GET:/api/audit-logs": { limit: 30, windowMs: 60000 },
};

function matchRoute(method: string, path: string): string | null {
  const key = `${method}:${path}`;
  if (LIMITS[key]) return key;

  for (const pattern of Object.keys(LIMITS)) {
    const regex = new RegExp("^" + pattern.replace(/:\*/g, "[^/]+").replace(/\*/g, "[^/]+") + "$");
    if (regex.test(key)) return pattern;
  }
  return null;
}

export async function checkRateLimit(method: string, path: string, ip: string): Promise<void> {
  if (siteConfig.rateLimiting.disabled) return;

  const pattern = matchRoute(method, path);
  if (!pattern) return;

  const { limit, windowMs } = LIMITS[pattern];
  const storeKey = `${pattern}:${ip}`;
  const now = Date.now();

  const entry = store.get(storeKey);
  if (!entry || now > entry.resetAt) {
    store.set(storeKey, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count++;
  if (entry.count > limit) {
    throw new AppError(
      ErrorCodes.RATE_LIMITED,
      "Too many requests. Please try again later.",
      429,
      { retryAfterMs: entry.resetAt - now }
    );
  }
}

export function getRateLimitStore(): Map<string, RateLimitEntry> {
  return store;
}
