import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/* Plain crypto (no "server-only"), so `npm run template:password` can use it outside Next. */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/** "scrypt:N:r:p:salt:hash" (base64url), for TEMPLATE_UPLOAD_PASSWORD_HASH. No "$", which .env files would expand. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), hash.toString("base64url")].join(":");
}

export function verifyPassword(password: string, stored: string): boolean {
  const [kind, n, r, p, salt, hash] = stored.split(":");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  let actual: Buffer;
  try {
    actual = scryptSync(password.slice(0, 200), Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
