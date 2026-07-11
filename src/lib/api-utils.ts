import { NextResponse } from "next/server";
import { AppError } from "@/constants/errors";
import { logger } from "@/lib/logger/logger";
import { v4 as uuid } from "uuid";

export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    { success: true, data, correlationId: uuid() },
    { status }
  );
}

export function errorResponse(error: unknown, correlationId?: string): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: { code: error.code, message: error.message, details: error.details },
        correlationId: correlationId || uuid(),
      },
      { status: error.statusCode }
    );
  }

  logger.error("Unhandled error", { metadata: { error: String(error) } });

  return NextResponse.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      correlationId: correlationId || uuid(),
    },
    { status: 500 }
  );
}

export function handleRouteError(error: unknown, correlationId?: string): NextResponse {
  return errorResponse(error, correlationId);
}
