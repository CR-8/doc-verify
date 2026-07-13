import { AppError, ErrorCodes } from "@/constants/errors";

/**
 * Extra origins allowed in addition to the request's own origin.
 * Same-origin requests are always allowed (validated against the Host the
 * request actually arrived on), so this is only needed for legitimate
 * cross-origin callers.
 */
const EXTRA_ALLOWED_ORIGINS = (process.env.CSRF_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_BASE_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/** The host the request was actually served on, honoring proxy headers (Vercel, etc.). */
function getRequestHost(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    null
  );
}

function hostFromUrl(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export function validateCsrf(request: Request): void {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // No Origin/Referer at all: non-browser client (or a same-origin GET-like
  // request). There is no cross-site vector to block here.
  if (!origin && !referer) return;

  const sourceHost = origin ? hostFromUrl(origin) : referer ? hostFromUrl(referer) : null;
  if (!sourceHost) {
    throw new AppError(ErrorCodes.FORBIDDEN, "Cross-origin request blocked", 403);
  }

  // Same-origin: the request's origin host matches the host it was served on.
  const requestHost = getRequestHost(request);
  if (requestHost && sourceHost === requestHost) return;

  // Otherwise, allow only explicitly configured cross-origin callers.
  const allowed = EXTRA_ALLOWED_ORIGINS.some((a) => {
    const allowedHost = hostFromUrl(a) || a;
    return sourceHost === allowedHost;
  });
  if (!allowed) {
    throw new AppError(ErrorCodes.FORBIDDEN, "Cross-origin request blocked", 403);
  }
}
