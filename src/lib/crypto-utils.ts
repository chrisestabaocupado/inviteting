import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

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

function pinKey(): Buffer {
  const secret = process.env.PIN_ENCRYPTION_KEY;
  if (!secret) throw new Error("PIN_ENCRYPTION_KEY no configurada");
  return createHash("sha256").update(secret).digest();
}

export function encryptPin(pin: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", pinKey(), iv);
  const enc = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptPin(payload: string): string {
  const [iv, tag, data] = payload.split(".");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    pinKey(),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
