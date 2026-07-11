import { AppError, ErrorCodes } from "@/constants/errors";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
];

export function validateCsrf(request: Request): void {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return;

  if (origin) {
    const allowed = ALLOWED_ORIGINS.some((a) => origin.startsWith(a));
    if (!allowed) {
      throw new AppError(ErrorCodes.FORBIDDEN, "Cross-origin request blocked", 403);
    }
  }
}
