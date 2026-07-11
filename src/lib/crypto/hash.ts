import { createHash } from "crypto";

export function sha256(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashDocument(fileBuffer: Buffer): string {
  return sha256(fileBuffer);
}

export function hashPayload(payload: Record<string, unknown>): string {
  return sha256(JSON.stringify(payload));
}
