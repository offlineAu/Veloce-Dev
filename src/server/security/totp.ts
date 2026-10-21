import { createHmac, timingSafeEqual } from "node:crypto";

/** RFC 6238 SHA-1, six digits, 30-second period, with one step of clock drift. */
export function validTotpSecret(secret: string): boolean { return /^[A-Z2-7]{32,128}$/.test(secret); }
function secretBytes(secret: string): Buffer {
  if (!validTotpSecret(secret)) throw new Error("Invalid authenticator secret");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const char of secret) {
    value = (value << 5) | "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char);
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((value >>> bits) & 255); }
  }
  return Buffer.from(out);
}
export function totpCode(secret: string, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", secretBytes(secret)).update(message).digest();
  const offset = hash[hash.length - 1]! & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
export function verifyTotp(secret: string, code: unknown, now = Date.now()): number | null {
  if (!validTotpSecret(secret) || typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30_000);
  for (const counter of [step, step - 1, step + 1]) {
    if (counter >= 0 && timingSafeEqual(Buffer.from(code), Buffer.from(totpCode(secret, counter)))) return counter;
  }
  return null;
}
