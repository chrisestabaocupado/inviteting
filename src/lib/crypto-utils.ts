import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashHuella(input: string): string {
  return createHash("sha256").update(input).digest("base64url").slice(0, 32);
}

export function safeCompare(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateQrToken(): string {
  return randomBytes(16).toString("base64url");
}
