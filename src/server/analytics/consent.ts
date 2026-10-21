import { isOwner } from "@/server/admin/session";
import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { hmac } from "@/server/security/hash";
import { readDevSession } from "@/server/security/dev-session";
import { ANALYTICS_COOKIE } from "@/lib/analytics/shared";
import { PRIVACY_NOTICE_VERSION } from "@/lib/legal";
import { analyticsConfig } from "./config";

export function signVisitor(id: string) { return `${id}.${hmac(`analytics:${id}`)}`; }
export function verifiedVisitor(token?: string) {
  if (!token) return undefined;
  const [id, signature, extra] = token.split(".");
  if (!id || !/^[0-9a-f-]{36}$/.test(id) || !signature || extra) return undefined;
  const expected = hmac(`analytics:${id}`);
  return Buffer.byteLength(signature) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : undefined;
}
export async function currentVisitor(includeInactive = false) {
  if (!includeInactive && (!analyticsConfig().enabled || await readDevSession() || await isOwner())) return null;
  const id = verifiedVisitor((await cookies()).get(ANALYTICS_COOKIE)?.value);
  if (!id) return null;
  const visitor = await db.analyticsVisitor.findUnique({ where: { id } });
  if (!visitor) return null;
  return includeInactive || isActive(visitor) ? visitor : null;
}
export function isActive(visitor: { revokedAt: Date | null; expiresAt: Date; noticeVersion: string; deletionRequestedAt: Date | null }) {
  return !visitor.revokedAt && !visitor.deletionRequestedAt && visitor.expiresAt > new Date() && visitor.noticeVersion === PRIVACY_NOTICE_VERSION;
}
