import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/server/db";
export const CASE_COOKIE = "veloce_case";
export const CASE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CASE_FILE = /^[a-z0-9-]{1,80}\.webp$/;
export const grantHash = (token: string) => createHash("sha256").update(`private-case:${token}`).digest("hex");
export async function caseGrant(slug: string, token: string | undefined) {
  if (!CASE_SLUG.test(slug) || slug.length > 60 || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const grant = await db.privateAccessGrant.findUnique({ where: { tokenHash: grantHash(token) }, select: { id: true, caseSlug: true, expiresAt: true, revokedAt: true } });
  return grant && grant.caseSlug === slug && !grant.revokedAt && grant.expiresAt.getTime() > Date.now() ? grant : null;
}
export async function currentCaseGrant(slug: string) { return caseGrant(slug, (await cookies()).get(CASE_COOKIE)?.value); }
export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
