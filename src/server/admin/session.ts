import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { validTotpSecret } from "@/server/security/totp";
import { registerSession, sessionActive, revokeSession } from "@/server/security/sessions";
import { cookies } from "next/headers";

export const OWNER_COOKIE = "veloce_owner";
export const OWNER_SESSION_SECONDS = 8 * 60 * 60;
export function ownerConfigured() {
  return (process.env.NODE_ENV !== "production" || validTotpSecret(process.env.ANALYTICS_OWNER_TOTP_SECRET ?? "")) && !!process.env.ANALYTICS_OWNER_PASSWORD_HASH && (process.env.ANALYTICS_OWNER_SESSION_SECRET?.length ?? 0) >= 32;
}
const mac = (body: string) => createHmac("sha256", process.env.ANALYTICS_OWNER_SESSION_SECRET!).update(`analytics-owner:v3:${process.env.ANALYTICS_OWNER_PASSWORD_HASH}:${process.env.ANALYTICS_OWNER_TOTP_SECRET ?? ""}:${process.env.OWNER_SESSION_VERSION ?? "1"}:${body}`).digest("base64url");
export function encodeOwnerSession(expiresAt: number, sid = randomUUID()) {
  if (!ownerConfigured()) throw new Error("Owner access unavailable");
  const body = Buffer.from(JSON.stringify({ exp: expiresAt, sid })).toString("base64url");
  return `${body}.${mac(body)}`;
}
export function decodeOwnerSession(token?: string, now = Date.now()): { exp: number; sid: string } | null {
  if (!ownerConfigured() || !token || token.length > 1024) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  const expected = Buffer.from(mac(body)), given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString());
    return Number.isSafeInteger(s.exp) && s.exp > now && s.exp <= now + OWNER_SESSION_SECONDS * 1000 && typeof s.sid === "string" && /^[0-9a-f-]{36}$/.test(s.sid) ? { exp: s.exp, sid: s.sid } : null;
  } catch { return null; }
}
export function validOwnerSession(token?: string, now = Date.now()) { return !!decodeOwnerSession(token, now); }
export async function newOwnerSession() {
  const sid = randomUUID(), expiresAt = Date.now() + OWNER_SESSION_SECONDS * 1000;
  await registerSession(sid, "owner", expiresAt);
  return encodeOwnerSession(expiresAt, sid);
}
export async function isOwner() {
  const session = decodeOwnerSession((await cookies()).get(OWNER_COOKIE)?.value);
  return !!session && await sessionActive(session.sid, "owner");
}
export async function requireOwner() { if (!await isOwner()) throw new Error("Owner session required"); }
export async function endOwnerSession() {
  const jar = await cookies();
  const session = decodeOwnerSession(jar.get(OWNER_COOKIE)?.value);
  try { await revokeSession(session?.sid, "owner"); } finally { jar.delete(OWNER_COOKIE); }
}
